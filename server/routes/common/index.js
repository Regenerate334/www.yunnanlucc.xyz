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
