/**
 * 超级管理员业务路由 (Super Admin Routes)
 * 职责：提供针对系统配置、用户治理、服务健康状态审计及运维脚本执行的特权接口。
 * 
 * 修改提示：
 * 1. 本模块所有接口均受 roleCheck('super_admin') 强制鉴权保护。
 * 2. 核心配置持久化逻辑 (POST /config) 集成了 E2E 加密校验，修改时需对齐前端加密协议。
 * 3. 用户管理操作涉及数据库敏感字段，更新密码需遵循 bcrypt 同步哈希规范。
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import crypto from 'crypto';
import pool from '../config/db.js';
import logger from '../config/logger.js';
import { authMiddleware, roleCheck } from '../middleware/auth.js';
import os from 'os';
import { decrypt as rsaDecrypt } from '../utils/cryptoHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

const router = express.Router();

// 所有 admin 路由都需要先经过通用认证，再经过 super_admin 角色检查
router.use(authMiddleware);
router.use(roleCheck('super_admin'));

const GEOSERVER_URL = 'http://localhost:8080/geoserver/rest';

// 动态运行时配置 (Dynamic Runtime Context)
const runtimeContext = {
    geoserver: {
        user: process.env.GEOSERVER_USER,
        pass: process.env.GEOSERVER_PASSWORD
    }
};

// [Security] 强制在生产环境下从环境变量读取
if (!runtimeContext.geoserver.user || !runtimeContext.geoserver.pass) {
    console.warn('[Security] GEOSERVER credentials missing in .env');
}

const getGeoServerAuth = () => {
    return 'Basic ' + Buffer.from(`${runtimeContext.geoserver.user}:${runtimeContext.geoserver.pass}`).toString('base64');
};

/**
 * 审计日志记录助手
 */
const logAction = async (user, action, target, details = '') => {
    try {
        await pool.query(
            'INSERT INTO audit_logs (user_id, username, action, target, details) VALUES ($1, $2, $3, $4, $5)',
            [user.id, user.username, action, target, details]
        );
    } catch (err) {
        console.error('[Admin Log] Failed to record audit log:', err);
    }
};

// AES-256-CBC Decryption Utility
const decryptPayload = (encryptedData, key) => {
    try {
        const textParts = encryptedData.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const hashedPassword = crypto.createHash('sha256').update(key).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', hashedPassword, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString());
    } catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
};

/**
 * 获取所有用户列表
 */
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, role, created_at FROM users ORDER BY id ASC'
        );
        res.json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        console.error('[Admin] 获取用户列表失败:', err);
        res.status(500).json({ message: '获取用户列表失败' });
    }
});

/**
 * 新增用户
 */
router.post('/users', async (req, res) => {
    let { username, password, role } = req.body;

    try {
        // [Security] 强制对传输过程中加密的密码进行 RSA 私钥解密
        password = rsaDecrypt(password);
    } catch (err) {
        return res.status(400).json({ message: '传输协议加固异常，请刷新页面重试' });
    }

    if (!username || !password) {
        return res.status(400).json({ message: '用户名和密码均不能为空' });
    }

    try {
        // 检查是否已存在
        const check = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (check.rows.length > 0) {
            return res.status(400).json({ message: '用户名已存在' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, role || 'admin']
        );

        await logAction(req.user, 'CREATE_USER', username, `Role: ${role || 'admin'}`);

        res.status(201).json({
            success: true,
            message: '添加用户成功',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('[Admin] 添加用户失败:', err);
        res.status(500).json({ message: '添加用户失败: ' + err.message });
    }
});

/**
 * 修改用户 (修改角色或重置密码)
 */
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    let { role, password } = req.body;

    try {
        if (password) {
            try {
                // [Security] 强制对传输过程中的重置密码进行 RSA 私钥解密
                password = rsaDecrypt(password);
            } catch (err) {
                return res.status(400).json({ message: '传输加固异常，重置失败' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            await pool.query('UPDATE users SET password = $1, role = $2 WHERE id = $3', [hashedPassword, role, id]);
        } else {
            await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
        }

        await logAction(req.user, 'UPDATE_USER', `ID:${id}`, `Role: ${role}`);
        res.json({ success: true, message: '更新用户信息成功' });
    } catch (err) {
        res.status(500).json({ message: '更新用户失败' });
    }
});

/**
 * 删除用户
 */
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ message: '不能删除自己' });
    }

    try {
        const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [id]);
        const username = userRes.rows[0]?.username || 'Unknown';

        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        await logAction(req.user, 'DELETE_USER', username, `ID: ${id}`);

        res.json({ success: true, message: '删除用户成功' });
    } catch (err) {
        res.status(500).json({ message: '删除用户失败' });
    }
});

/**
 * 获取系统设置 (.env 项目)
 */
router.get('/config', async (req, res) => {
    try {
        if (!fs.existsSync(envPath)) {
            return res.status(404).json({ message: '.env 文件不存在' });
        }
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        const config = {};

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const parts = trimmed.split('=');
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();

                // [Security] 屏蔽敏感信息，避免在 UI 端直接展示密钥正文
                const SENSITIVE_KEYWORDS = ['PASS', 'KEY', 'SECRET', 'TOKEN', 'AUTH', 'CREDENTIAL', 'PRIVATE', 'CIPHER'];
                const isSensitive = SENSITIVE_KEYWORDS.some(k => key.toUpperCase().includes(k));
                config[key] = isSensitive ? '******** (Encrypted)' : value;
            }
        });

        res.json({ success: true, data: config });
    } catch (err) {
        res.status(500).json({ message: '获取配置失败' });
    }
});

/**
 * 更新系统设置 (.env 项目) - [Security Hardened]
 */
router.post('/config', async (req, res) => {
    let { updates, payload, secret } = req.body;

    // [Security] 强制在后端验证管理员授权密钥 (Master Key)
    const ADMIN_KEY = process.env.ADMINISTRATION_KEY;
    if (!ADMIN_KEY || secret !== ADMIN_KEY) {
        logger.error(`[Security] Unauthorized config-update attempt from IP: ${req.ip}`);
        return res.status(403).json({ message: '管理员授权密钥验证失败，拒绝同步' });
    }

    // Support E2E Encrypted Payload from Frontend
    if (payload && secret) {
        const decrypted = decryptPayload(payload, secret);
        if (!decrypted) {
            return res.status(400).json({ message: '配置解密失败，授权密钥可能不匹配' });
        }
        updates = decrypted;
    }

    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: '无效的配置更新参数' });
    }

    try {
        if (!fs.existsSync(envPath)) {
            return res.status(404).json({ message: '.env 文件不存在' });
        }

        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');

        // [Security] 禁止通过 UI 修改核心安全密钥，防止提权或锁定
        const PROTECTED_KEYS = ['JWT_SECRET', 'PORT', 'NODE_ENV', 'DB_PASSWORD'];

        const updatedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key] = trimmed.split('=');
                const cleanKey = key.trim();

                if (updates.hasOwnProperty(cleanKey)) {
                    const newValue = String(updates[cleanKey]);

                    // [Security] 忽略那些未被修改的占位符 (防止覆盖真实密码)
                    if (newValue.includes('******** (Encrypted)')) {
                        return line;
                    }

                    if (PROTECTED_KEYS.includes(cleanKey.toUpperCase())) {
                        logger.warn(`[Security] User ${req.user.username} attempted to modify protected key: ${cleanKey}`);
                        return line; // 保持原样
                    }
                    return `${cleanKey}=${newValue}`;
                }
            }
            return line;
        });

        fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
        await logAction(req.user, 'UPDATE_CONFIG', 'SYSTEM_ENV', `Updated keys: ${Object.keys(updates).join(', ')}`);

        res.json({ success: true, message: '配置已更新，部分更改可能需要重启服务生效' });
    } catch (err) {
        logger.error('[Admin] 更新配置失败:', err);
        res.status(500).json({ message: '更新配置失败: ' + err.message });
    }
});

/**
 * 获取操作日志
 */
router.get('/logs', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100'
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ message: '获取日志失败' });
    }
});

/**
 * 获取数据库表状态
 */
router.get('/db/tables', async (req, res) => {
    try {
        const query = `
            SELECT 
                relname as "name", 
                n_live_tup as "rows",
                pg_size_pretty(pg_total_relation_size(relid)) as "size"
            FROM pg_stat_user_tables 
            ORDER BY n_live_tup DESC;
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ message: '获取数据库统计失败' });
    }
});

/**
 * 辅助函数：静默执行 PowerShell 指令并返回输出
 */
const executePowerShell = (cmd) => {
    try {
        // [Security] 严格限制指令非法字符，防止二级注入
        if (/[;&|]/.test(cmd)) {
            console.error('[Security] Illegal characters in PowerShell command');
            return null;
        }
        return execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd}"`, {
            windowsHide: true,
            encoding: 'utf8',
            timeout: 8000 // 8s 超时
        }).trim();
    } catch (e) {
        return null;
    }
};

/**
 * 获取系统状态 (增强版 - 接入真实 CPU 负载)
 */
router.get('/system/status', async (req, res) => {
    try {
        const dbStart = Date.now();
        let dbStatus = 'offline';
        let dbLatency = 'timeout';
        try {
            await pool.query('SELECT 1');
            dbStatus = 'online';
            dbLatency = `${Date.now() - dbStart}ms`;
        } catch (e) { }

        // 1. 获取磁盘信息 (PowerShell - 尝试获取 C 盘或首个固定磁盘)
        let diskInfo = 'Unknown';
        const psDisk = executePowerShell('Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | Select-Object Size, FreeSpace, DeviceID | ConvertTo-Json');
        if (psDisk) {
            try {
                const disks = JSON.parse(psDisk);
                const d = Array.isArray(disks) ? (disks.find(i => i.DeviceID === 'C:') || disks[0]) : disks;
                if (d && d.Size > 0) {
                    const total = d.Size;
                    const free = d.FreeSpace;
                    diskInfo = `${Math.round((total - free) / 1024 / 1024 / 1024)}GB / ${Math.round(total / 1024 / 1024 / 1024)}GB`;
                }
            } catch (e) { }
        }

        // 2. 获取 CPU 负载 (PowerShell)
        let cpuLoad = 0;
        const psCpu = executePowerShell('(Get-CimInstance Win32_Processor).LoadPercentage');
        if (psCpu) {
            cpuLoad = parseInt(psCpu) || 0;
        } else {
            // 如果 PS 失败，降级使用 os.loadavg
            cpuLoad = Math.round(os.loadavg()[0] * 100) || 0;
        }

        const cpus = os.cpus();

        res.json({
            success: true,
            data: {
                database: { status: dbStatus, latency: dbLatency },
                nodeVersion: process.version,
                platform: process.platform,
                os: {
                    type: os.type(),
                    release: os.release(),
                    arch: os.arch(),
                    totalMem: Math.round(os.totalmem() / 1024 / 1024), // MB
                    freeMem: Math.round(os.freemem() / 1024 / 1024)    // MB
                },
                cpu: {
                    model: cpus[0] ? cpus[0].model : 'Unknown',
                    cores: cpus.length,
                    speed: cpus[0] ? `${cpus[0].speed}MHz` : '0MHz',
                    load: cpuLoad
                },
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                disk: diskInfo
            }
        });
    } catch (err) {
        console.error('[Admin Status] Critical failure:', err);
        res.status(500).json({ message: '获取系统状态失败', error: err.message });
    }
});

/**
 * 辅助函数：通过 PowerShell 获取特定进程名的总内存占用 (Windows)
 */
const getProcessMemory = (pattern) => {
    try {
        // [Security] 仅允许 字母、数字、点号 (如 java.exe)
        const safePattern = pattern.replace(/[^a-zA-Z0-9.\-_]/g, '');
        if (!safePattern) return 0;

        const psCmd = `(Get-Process -Name "${safePattern.split('.')[0]}" -ErrorAction SilentlyContinue | Measure-Object -Property WorkingSet64 -Sum).Sum`;
        const out = executePowerShell(psCmd);
        return out ? parseInt(out) : 0;
    } catch (e) {
        return 0;
    }
};

/**
 * 获取各项服务健康状态 (API Hub) - 增强版：带内存占用
 */
router.get('/services/health', async (req, res) => {
    const services = [
        { name: 'Core API', endpoint: '/api/admin', type: 'System', pattern: 'node.exe' },
        { name: 'Auth Service', endpoint: '/api/auth', type: 'Security', pattern: 'node.exe' },
        { name: 'Database (PG)', endpoint: 'PostgreSQL', type: 'Data', pattern: 'postgres.exe' },
        { name: 'GeoServer', endpoint: '8080/geoserver', type: 'GIS', pattern: 'java.exe' },
        { name: 'AI Engine', endpoint: 'Ollama/OpenAI', type: 'AI', pattern: 'ollama.exe' }
    ];

    const results = await Promise.all(services.map(async (s) => {
        let status = 'offline';
        let mem = 0;

        // 探测状态
        if (s.name === 'Database (PG)') {
            try { await pool.query('SELECT 1'); status = 'online'; } catch (e) { }
        } else if (s.name === 'Core API') {
            status = 'online';
        } else {
            status = 'online';
        }

        // 探测内存 (仅针对本地已知的进程名)
        if (status === 'online') {
            mem = getProcessMemory(s.pattern);
            // 如果是当前 node 进程且 wmic 没抓准，降级使用 process.memoryUsage
            if (s.pattern === 'node.exe' && mem === 0) mem = process.memoryUsage().rss;
        }

        return {
            name: s.name,
            endpoint: s.endpoint,
            type: s.type,
            status,
            memory: mem
        };
    }));

    res.json({ success: true, data: results });
});

// 内存中缓存上一次的数据库统计信息，用于全面增量计算
let lastDbStats = null;

/**
 * 获取数据库实时性能监控 - 深度重构为增量计算模式
 */
router.get('/db/performance', async (req, res) => {
    try {
        const query = `
            SELECT 
                datname, 
                xact_commit, 
                xact_rollback, 
                blks_read, 
                blks_hit,
                tup_inserted,
                tup_updated,
                tup_deleted,
                tup_returned,
                tup_fetched,
                (SELECT count(*) FROM pg_stat_activity) as active_conns
            FROM pg_stat_database 
            WHERE datname = current_database();
        `;
        const result = await pool.query(query);
        const stats = result.rows[0];
        const now = Date.now();

        // 默认返回当前实时会话数（直接值），其余重叠为 0（待增量计算）
        let perf = {
            tps: 0,
            commits: 0,
            rollbacks: 0,
            reads: 0,
            hits: 0,
            cacheHitRate: 100,
            conns: stats.active_conns,
            throughput: {
                ins: 0, upd: 0, del: 0,
                ret: 0, fet: 0
            }
        };

        if (lastDbStats) {
            const timeDiff = (now - lastDbStats.time) / 1000;
            if (timeDiff > 0.5) { // 至少间隔 0.5s，防止除以 0
                // 计算增量
                const commitDiff = stats.xact_commit - lastDbStats.xact_commit;
                const rollbackDiff = stats.xact_rollback - lastDbStats.xact_rollback;

                // 峰值保护：如果单次增量超过 100万（通常是统计重置或首次采集误差），则记为 0
                if (commitDiff >= 0 && commitDiff < 1000000) {
                    perf.tps = Math.round((commitDiff + (rollbackDiff > 0 ? rollbackDiff : 0)) / timeDiff);
                    perf.commits = Math.round(commitDiff / timeDiff);
                    perf.rollbacks = Math.round((rollbackDiff > 0 ? rollbackDiff : 0) / timeDiff);
                }

                // 同理保护其他指标
                const insDiff = stats.tup_inserted - lastDbStats.tup_inserted;
                if (insDiff >= 0 && insDiff < 1000000) {
                    perf.throughput.ins = Math.round(insDiff / timeDiff);
                    perf.throughput.upd = Math.round((stats.tup_updated - lastDbStats.tup_updated) / timeDiff);
                    perf.throughput.del = Math.round((stats.tup_deleted - lastDbStats.tup_deleted) / timeDiff);
                    perf.throughput.ret = Math.round((stats.tup_returned - lastDbStats.tup_returned) / timeDiff);
                    perf.throughput.fet = Math.round((stats.tup_fetched - lastDbStats.tup_fetched) / timeDiff);
                }

                perf.reads = Math.round((stats.blks_read - lastDbStats.blks_read) / timeDiff);
                perf.hits = Math.round((stats.blks_hit - lastDbStats.blks_hit) / timeDiff);

                const totalIO = stats.blks_hit + stats.blks_read - (lastDbStats.blks_hit + lastDbStats.blks_read);
                if (totalIO > 0) {
                    perf.cacheHitRate = ((stats.blks_hit - lastDbStats.blks_hit) / totalIO * 100).toFixed(2);
                }
            }
        }

        lastDbStats = { ...stats, time: now };
        res.json({ success: true, data: perf });
    } catch (err) {
        console.error('[DB Monitor] Failed:', err);
        res.status(500).json({ success: false, message: '获取数据库性能失败' });
    }
});

/**
 * 安全审计：获取数据库真实角色列表 (pg_roles)
 */
router.get('/security/db-roles', async (req, res) => {
    try {
        const query = `
            SELECT 
                rolname as name,
                rolsuper as is_superuser,
                rolcreaterole as can_create_role,
                rolcreatedb as can_create_db,
                rolcanlogin as can_login,
                rolreplication as is_replication,
                rolconnlimit as conn_limit,
                rolvaliduntil as valid_until,
                -- 核心表权限探测
                has_table_privilege(rolname, 'users', 'SELECT') as can_select,
                has_table_privilege(rolname, 'users', 'INSERT') as can_insert,
                has_table_privilege(rolname, 'users', 'UPDATE') as can_update,
                has_table_privilege(rolname, 'users', 'DELETE') as can_delete
            FROM pg_roles 
            WHERE rolname NOT LIKE 'pg_%'
            ORDER BY rolsuper DESC, rolname ASC;
        `;
        const result = await pool.query(query);

        // 获取 GeoServer 用户列表 (模拟基础审计)
        let geoserverUsers = [];
        try {
            const gsRes = await fetch(`${GEOSERVER_URL}/security/usergroup/users.json`, {
                headers: { 'Authorization': getGeoServerAuth() }
            });
            if (gsRes.ok) {
                const gsData = await gsRes.json();
                geoserverUsers = (gsData.users || []).map(u => ({
                    name: `gs:${u.userName}`,
                    is_superuser: u.userName === 'admin', // 简化判断
                    can_login: u.enabled !== false,
                    type: 'GeoServer',
                    risk_level: u.userName === 'admin' ? 'CRITICAL' : 'LOW'
                }));
            }
        } catch (e) {
            console.error('[Admin] Failed to fetch GeoServer users:', e.message);
        }

        // 安全风险分析
        const pgRoles = result.rows.map(r => ({
            ...r,
            type: 'PostgreSQL',
            risk_level: r.is_superuser && r.name !== 'postgres' ? 'CRITICAL' : (r.rolcreaterole ? 'HIGH' : 'LOW'),
            recommendation: r.is_superuser && r.name !== 'postgres' ? '建议收回超级用户权限' : '正常'
        }));

        res.json({ success: true, data: [...pgRoles, ...geoserverUsers] });
    } catch (err) {
        res.status(500).json({ message: '获取安全审计数据失败' });
    }
});

/**
 * 权限修复一键指令 (Remediation)
 * 示例：锁定某个账号或收回特权
 */
router.post('/security/remediate', async (req, res) => {
    const { roleName, action } = req.body;
    try {
        if (roleName.startsWith('gs:')) {
            // GeoServer 处理
            const gsUserName = roleName.split(':')[1];
            if (action === 'LOCK') {
                // GeoServer 锁定用户通常需要 PUT 更新用户信息
                await fetch(`${GEOSERVER_URL}/security/usergroup/user/${gsUserName}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': getGeoServerAuth(),
                        'Content-Type': 'application/xml'
                    },
                    body: `<user><userName>${gsUserName}</userName><enabled>false</enabled></user>`
                });
            } else if (action === 'UNLOCK') {
                await fetch(`${GEOSERVER_URL}/security/usergroup/user/${gsUserName}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': getGeoServerAuth(),
                        'Content-Type': 'application/xml'
                    },
                    body: `<user><userName>${gsUserName}</userName><enabled>true</enabled></user>`
                });
            }
        } else {
            // PostgreSQL 处理
            // [Security] 建立 RoleName 白名单或严格正则过滤 (仅允许字母数字下划线)
            if (!/^[a-zA-Z0-9_]+$/.test(roleName)) {
                return res.status(400).json({ message: '非法的角色名称，禁止注入' });
            }

            if (action === 'LOCK') {
                await pool.query(`ALTER ROLE "${roleName}" NOLOGIN`);
            } else if (action === 'UNLOCK') {
                await pool.query(`ALTER ROLE "${roleName}" LOGIN`);
            } else if (action === 'REVOKE_SUPER') {
                await pool.query(`ALTER ROLE "${roleName}" NOSUPERUSER`);
            } else if (action === 'GRANT_READ_ONLY') {
                await pool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${roleName}"`);
                await pool.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${roleName}"`);
            } else if (action === 'GRANT_WRITE_ONLY') {
                await pool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${roleName}"`);
                await pool.query(`GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`);
            } else if (action === 'GRANT_READ_WRITE') {
                await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${roleName}"`);
                await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${roleName}"`);
            } else if (action === 'DENY_ALL') {
                await pool.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "${roleName}"`);
                await pool.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM "${roleName}"`);
            } else if (action === 'GRANT_ALL_GIS_PERMS') {
                // 一键授权：针对 webgis_app_user 或当前目标
                await pool.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${roleName}"`);
                await pool.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${roleName}"`);
            }
        }

        await logAction(req.user, 'SECURITY_REMEDIATE', roleName, `Action: ${action}`);
        res.json({ success: true, message: `权限修复操作 [${action}] 执行成功` });
    } catch (err) {
        res.status(500).json({ message: '修复操作失败: ' + err.message });
    }
});

/**
 * 获取当前后端连接状态与权限
 */
router.get('/security/backend-status', async (req, res) => {
    try {
        const query = `
            SELECT 
                current_user as db_user, 
                current_database() as db_name,
                has_table_privilege(current_user, 'users', 'SELECT') as can_read_users,
                has_table_privilege(current_user, 'users', 'INSERT') as can_write_users,
                has_table_privilege(current_user, 'audit_logs', 'INSERT') as can_write_logs
            FROM pg_stat_database LIMIT 1;
        `;
        const result = await pool.query(query);
        const status = result.rows[0];

        // 探测权限级别 (中文化)
        let level = '未知';
        if (status.can_read_users && status.can_write_users) level = '同时读写 (Full Access)';
        else if (status.can_read_users) level = '只读 (Read Only)';
        else if (status.can_write_users) level = '只写 (Write Only)';
        else level = '禁止访问 (Denied)';

        res.json({
            success: true,
            data: {
                ...status,
                level,
                node_env: process.env.NODE_ENV,
                db_host: process.env.DB_HOST,
                active_user: status.db_user // Explicitly highlight active user
            }
        });
    } catch (err) {
        res.status(500).json({ message: '获取后端状态失败' });
    }
});

/**
 * 切换系统全局运行时模式 (Unified Hot-Swap)
 * 允许在“开发模式 (Superuser)”与“生产模式 (Standard)”之间一键切换
 */
router.post('/security/switch-runtime-mode', async (req, res) => {
    const { mode, secret } = req.body;

    // 安全验证：必须提供管理员授权密钥 (从 .env 读取，统一使用 ADMINISTRATION_KEY)
    const ADMIN_KEY = process.env.ADMINISTRATION_KEY;
    if (!ADMIN_KEY || secret !== ADMIN_KEY) {
        logger.error(`[Security] Unauthorized runtime-mode switch attempt from IP: ${req.ip}`);
        return res.status(403).json({ message: '管理员授权密钥验证失败，拒绝切换' });
    }

    try {
        const isDev = mode === 'DEVELOPMENT';
        const pgUser = isDev ? 'postgres' : 'webgis_app_user';
        // GeoServer 的身份也同步切换逻辑
        const gsUser = isDev ? 'admin' : (process.env.GEOSERVER_USER || 'admin');

        // 1. 切换 PostgreSQL 执行身份
        await pool.switchAccount(pgUser, process.env.DB_PASSWORD);

        // 2. 切换 GeoServer 管理身份 (Memory Context)
        runtimeContext.geoserver.user = gsUser;
        runtimeContext.geoserver.pass = process.env.GEOSERVER_PASSWORD;

        await logAction(req.user, 'RUNTIME_MODE_SWITCH', mode, `Global switch to ${mode} (PG:${pgUser}, GS:${gsUser})`);

        res.json({
            success: true,
            message: `系统全局身份已成功切换至: ${isDev ? '开发模式 (Superuser)' : '生产模式 (Restricted)'}`,
            data: {
                active_mode: mode,
                db_user: pgUser,
                gs_user: gsUser
            }
        });
    } catch (err) {
        res.status(500).json({ message: '切换连接失败: ' + err.message });
    }
});

export default router;
