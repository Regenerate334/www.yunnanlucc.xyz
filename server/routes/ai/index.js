/**
 * AI 模块入口
 * 聚合聊天、会话管理和报告生成路由
 */
import express from 'express';
import chatRouter from './chat.js';
import sessionRouter from './session.js';
import reportRouter from './report.js';

const router = express.Router();

router.use('/chat', chatRouter);
router.use('/sessions', sessionRouter);
router.use('/report', reportRouter);

// 兼容性路由（旧 /api/ai/analyze-stream）
router.use('/', chatRouter);

export default router;
