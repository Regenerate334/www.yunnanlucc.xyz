/**
 * 土地转移矩阵路由 (Land Transfer Matrix Routes)
 * 职责：专门处理指定行政区划在不同年份间的土地利用类型转换关系及流失面积统计。
 *
 * 修改提示：
 * 1. 接口处理依赖于 PostgreSQL 中预计算的 `spatial_county_yunnan_transfer` 宽表。
 * 2. 年份参数必须为有效的四位数，查询不到时默认返回空对象而非报错。
 * 3. 若涉及跨度多年的区间查询，必须调用 getTransferMatrixByYearRange 进行累加处理。
 */
/**
 * 转移矩阵路由
 * 端点：/transfer-matrix/periods, /transfer-matrix/:period
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import { calculateTransferMatrix } from '../../utils/indices/transferMatrix.js';

const router = express.Router();

// 获取可用的转移矩阵时间段
router.get('/periods', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT DISTINCT period FROM public.clcd_transfer_matrix ORDER BY period');
        res.json(rows.map(r => r.period));
    } catch (err) { handleError(res, err); }
});

// (已移除 /query 路由，改用 WMS + SQL View 方案)

// 获取指定时间段的转移矩阵
router.get('/:period', async (req, res) => {
    const { period } = req.params;
    try {
        const { rows } = await pool.query(`SELECT * FROM public.clcd_transfer_matrix WHERE period = $1`, [period]).catch(e => ({ rows: [] }));

        const { absoluteMatrix, percentageMatrix, landTypes } = calculateTransferMatrix(rows);
        res.json({ absoluteMatrix, percentageMatrix, landTypes, period });
    } catch (err) { handleError(res, err); }
});

export default router;
