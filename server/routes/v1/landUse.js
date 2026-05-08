/**
 * 土地利用分析业务路由 (Land Use Analysis API v1)
 * 职责：处理土地利用数据的查询、统计、多期对比及仪表盘聚合数据的分发。
 *
 * 修改提示：
 * 1. 接口严重依赖 landUseService 服务层，不得在路由内部直接书写 SQL 查询。
 * 2. 各接口需严格校验年份与区域参数 (Year/Region)，并确保前端传入格式被正确转义。
 * 3. 此模块数据量通常较大，需留意流式输出及超时配置，防止堵塞主线程。
 */
/**
 * landUse.js (V1) — 土地利用标准化路由
 * 
 * 对应端点：/api/v1/land-use
 */

import express from 'express';
import landUseController from '../../controllers/landUseController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/land-use/province
 * @desc    获取全省汇总统计
 */
router.get('/province', landUseController.getProvinceSummary);

/**
 * @route   GET /api/v1/land-use/prefecture
 * @desc    获取地级市统计数据
 */
router.get('/prefecture', landUseController.getPrefectureData);

/**
 * @route   GET /api/v1/land-use/trend
 * @desc    获取时空趋势数据
 */
router.get('/trend', landUseController.getTrend);

/**
 * @route   GET /api/v1/land-use/transfer
 * @desc    获取土地利用转移矩阵
 */
router.get('/transfer', landUseController.getTransferMatrix);

export default router;
