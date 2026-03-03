/**
 * 地级市数据路由
 * 端点：/prefecture, /prefecture/name/:name, /prefecture/year/:year
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';

const router = express.Router();

// 获取所有地级市数据
router.get('/', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_prefecture ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定地级市的全量时间序列数据
router.get('/name/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_prefecture WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
        const { rows } = await pool.query(sql, [name.trim()]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取某年份所有地级市数据
router.get('/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_prefecture WHERE year = $1 ORDER BY region_name`;
        const { rows } = await pool.query(sql, [Number(year)]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

export default router;
