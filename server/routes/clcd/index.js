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
