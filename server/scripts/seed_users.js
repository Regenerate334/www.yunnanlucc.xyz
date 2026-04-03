/**
 * 数据库用户初始化脚本 (Seed Users)
 * 用于在禁用注册功能后，手动添加默认账号。
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量 (指向根目录的 .env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'yunnan_CLCD',
});

// [Security] 现已废弃前端同步 Hash 逻辑。
// 密码应由后端直接接收原始明文并进行 BCrypt 处理。

async function seedUsers() {
    const adminPass = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!adminPass) {
        console.error('FATAL: DEFAULT_ADMIN_PASSWORD is not set in .env');
        process.exit(1);
    }

    const users = [
        { username: 'admin', password: adminPass, role: 'super_admin' }
    ];

    console.log('--- Starting Database Seeding ---');

    try {
        // [Cleanup] 1. 先清除关联的会话数据 (避免外键约束冲突)
        // 找出即将保留的用户以外的 ID
        const userNames = users.map(u => u.username);

        // 级联删除关联表
        await pool.query('DELETE FROM chat_sessions WHERE user_id IN (SELECT id FROM users WHERE username NOT IN (' + userNames.map((_, i) => '$' + (i + 1)).join(',') + '))', userNames);

        // [Cleanup] 2. 删除除即将创建/更新的账号以外的所有旧账号
        const cleanupRes = await pool.query('DELETE FROM users WHERE username NOT IN (' + userNames.map((_, i) => '$' + (i + 1)).join(',') + ')', userNames);
        console.log(`[Cleanup] Removed ${cleanupRes.rowCount} legacy/weak accounts.`);

        for (const user of users) {
            // [Security] 直接对原始名文密码进行 BCrypt 加密
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);

            // 检查用户是否已存在
            const checkRes = await pool.query('SELECT id FROM users WHERE username = $1', [user.username]);

            if (checkRes.rows.length > 0) {
                console.log(`[Update] User "${user.username}" already exists. Updating password...`);
                await pool.query(
                    'UPDATE users SET password = $1, role = $2 WHERE username = $3',
                    [hashedPassword, user.role, user.username]
                );
                console.log(`[Success] Updated user: ${user.username}`);
                continue;
            }

            // 插入用户
            await pool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                [user.username, hashedPassword, user.role]
            );
            console.log(`[Success] Created user: ${user.username} (Password: ${user.password})`);
        }
    } catch (err) {
        console.error('[Error] Seeding failed:', err);
    } finally {
        await pool.end();
        console.log('--- Seeding Completed ---');
    }
}

seedUsers();
