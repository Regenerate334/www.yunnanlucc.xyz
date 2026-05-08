/**
 * 分析模块路由聚合入口 (Analysis Routes Gateway)
 * 职责：聚合仪表盘、转移矩阵、流向分析及空间统计等各类地理空间分析子路由。
 *
 * 修改提示：
 * 1. 该文件仅负责将相关功能模块路由映射到对应的子路径，不应包含具体业务逻辑。
 * 2. 新增的特定分析模块（如时空演变、生态评估）应新建路由文件并在此处注册挂载。
 * 3. 注意各子路由的中间件挂载顺序，确保不会相互影响。
 */
/**
 * Analysis 模块入口
 * 聚合仪表盘和转移矩阵路由
 */
import express from 'express';
import dashboardRouter from './dashboard.js';
import transferRouter from './transfer.js';
import transferFlowRouter from './transfer_flow.js';
import spatialStatsRouter from './spatial_stats.js';

const router = express.Router();

router.use('/dashboard', dashboardRouter);
router.use('/transfer-matrix', transferRouter);
router.use('/transfer-flow', transferFlowRouter);
router.use('/spatial-stats', spatialStatsRouter);

export default router;
