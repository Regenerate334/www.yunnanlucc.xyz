import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';
import { JWT_SECRET } from '../config/jwt.js';

export const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: '无权访问，请先登录' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token 无效或已过期' });
    }
};

/**
 * 角色检查中间件
 * @param {string} requiredRole 必选角色
 */
export const roleCheck = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: '请先登录' });
        }

        if (req.user.role !== requiredRole) {
            logger.warn(`[Auth] 403 Forbidden: User ${req.user.username} (Role: ${req.user.role}) attempted to access ${req.originalUrl} which requires ${requiredRole}`);
            return res.status(403).json({ message: '权限不足，仅限管理员访问' });
        }

        next();
    };
};
