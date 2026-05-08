/**\n * 业务模块路由 (Business Feature Routes)\n * 职责：负责 index 相关业务接口的 URL 映射及请求派发。\n *\n * 修改提示：\n * 1. 路由内禁止堆叠复杂逻辑，严格践行"瘦路由、胖服务"的开发范式。\n * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。\n * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。\n */\n/**
 * AI 模块入口
 * 聚合聊天、会话管理和报告生成路由
 */
import express from 'express';
import chatRouter from './chat.js';
import sessionRouter from './session.js';

const router = express.Router();

router.use('/chat', chatRouter);
router.use('/sessions', sessionRouter);

// 兼容性路由（旧 /api/ai/analyze-stream）
router.use('/', chatRouter);

export default router;
