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
