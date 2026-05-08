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
 * CLCD 模块统一入口
 * 聚合所有子模块路由
 */
import express from 'express';
import provinceRouter from './province.js';
import prefectureRouter from './prefecture.js';
import countyRouter from './county.js';
import spatialRouter from './spatial.js';
import breaksRouter from './breaks.js';

const router = express.Router();

// 挂载子路由
router.use('/', provinceRouter);              // /years, /province, /trend, /:year/summary
router.use('/prefecture', prefectureRouter);  // /prefecture, /prefecture/name, /prefecture/year
router.use('/county', countyRouter);          // /county, /county/name, /county/year, /county/prefecture
router.use('/spatial', spatialRouter);        // /spatial/county, /spatial/grid
router.use('/breaks', breaksRouter);          // /breaks (统一接口)

export default router;
