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
