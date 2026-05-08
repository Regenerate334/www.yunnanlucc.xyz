/**
 * 用户认证与安全路由 (Authentication & Security Routes)
 * 职责：负责系统的无状态登录鉴权、公钥下发以及 JWT 令牌的生成与验证。
 *
 * 修改提示：
 * 1. 登录接口 (/login) 接收前端 RSA 加密后的密码，需调用 cryptoHelper 解密。
 * 2. 密码比对使用 bcrypt 算法，修改哈希轮数时必须对齐数据库中已有用户的格式。
 * 3. 令牌生成默认 24 小时过期，需包含用户核心角色信息供鉴权中间件使用。
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import pool from '../config/db.js';
import { getPublicKey, decrypt } from '../utils/cryptoHelper.js';
import { JWT_SECRET } from '../config/jwt.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * 获取传输加密用公钥
 */
router.get('/public-key', (_req, res) => {
  try {
    const publicKey = getPublicKey();
    res.json({ success: true, publicKey });
  } catch (_err) {
    res.status(500).json({ success: false, message: '无法获取加密密钥' });
  }
});

/**
 * 登录
 */
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
    password = decrypt(password);
  } catch (_err) {
    return res.status(400).json({ message: '传输协议异常，请刷新页面后重试' });
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
    logger.error('[auth] 登录失败', { message: err?.message || String(err), stack: err?.stack });
    res.status(500).json({ message: `服务器内部错误: ${err.message}` });
  }
});

/**
 * 验证 token
 */
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: '未提供 Token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, user: decoded });
  } catch (_err) {
    res.status(401).json({ message: 'Token 无效或已过期' });
  }
});

export default router;
