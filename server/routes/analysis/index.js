/**
 * Analysis 模块入口
 * 聚合仪表盘和转移矩阵路由
 */
import express from 'express';
import dashboardRouter from './dashboard.js';
import transferRouter from './transfer.js';
import transferFlowRouter from './transfer_flow.js';
import reportRouter from './report.js';

const router = express.Router();

router.use('/dashboard', dashboardRouter);
router.use('/transfer-matrix', transferRouter);
router.use('/transfer-flow', transferFlowRouter);
router.use('/report', reportRouter);

export default router;
