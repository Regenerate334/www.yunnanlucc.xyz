/**
 * 业务模块路由 (Business Feature Routes)
 * 职责：负责 index 相关业务接口的 URL 映射及请求派发。
 *
 * 修改提示：
 * 1. 路由内禁止堆叠复杂逻辑，严格践行"瘦路由、胖服务"的开发范式。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
/**
 * Common 模块入口
 * 通用接口：区域、天气等
 */
import express from 'express';
import regionsRouter from './regions.js';
import weatherRouter from './weather.js';

const router = express.Router();

router.use('/regions', regionsRouter);
router.use('/weather', weatherRouter);

export default router;
