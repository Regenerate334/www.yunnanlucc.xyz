import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/db.js';
import { getPublicKey, decrypt } from '../utils/cryptoHelper.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// [Security] 严格校验 JWT_SECRET，禁止在生产环境或未配置情况下启动核心认证
if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        console.error('FATAL ERROR: JWT_SECRET environment variable is missing in production!');
        process.exit(1); // 生产环境缺密钥必须宕机保护
    } else {
        console.warn('WARNING: JWT_SECRET is missing. Authentication may be unstable.');
    }
}

/**
 * 获取传输加密用的公钥
 */
router.get('/public-key', (req, res) => {
    try {
        const publicKey = getPublicKey();
        res.json({ success: true, publicKey });
    } catch (err) {
        res.status(500).json({ success: false, message: '无法获取加密密钥' });
    }
});

// 登录接口
router.post('/login', [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    let { username, password } = req.body;

    try {
        // [Security] 强制对传输过程中加密的密码进行 RSA 私钥解密，对齐前端 Web Crypto 加密协议
        password = decrypt(password);
    } catch (err) {
        return res.status(400).json({ message: '传输协议加固异常，请刷新页面后重试' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: '用户名或密码错误' });
        }

        // 生成 JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        console.error('\x1b[31m[auth] 登录失败:\x1b[0m', err);
        res.status(500).json({ message: '服务器内部错误: ' + err.message });
    }
});

/*
// 注册接口
router.post('/register', [
    body('username').isLength({ min: 3 }).withMessage('用户名至少3个字符'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6个字符')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        // 检查用户是否已存在
        const userExists = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: '用户名已存在' });
        }

        // 加密密码
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 插入新用户
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
            [username, hashedPassword, 'admin']
        );

        res.status(201).json({
            success: true,
            message: '注册成功',
            user: result.rows[0]
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '服务器错误' });
    }
});
*/

// 验证 Token 接口
router.get('/verify', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '未提供 Token' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ success: true, user: decoded });
    } catch (err) {
        res.status(401).json({ message: 'Token 无效或已过期' });
    }
});

export default router;
