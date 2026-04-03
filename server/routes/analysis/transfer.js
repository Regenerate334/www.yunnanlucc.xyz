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
