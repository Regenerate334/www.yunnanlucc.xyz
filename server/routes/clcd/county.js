/**
 * 县级数据路由
 * 端点：/county, /county/name/:name, /county/year/:year, /county/prefecture/:prefecture
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';

const router = express.Router();

// 获取所有区县数据
router.get('/', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_county ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定区县的全量时间序列数据
router.get('/name/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_county WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
        const { rows } = await pool.query(sql, [name.trim()]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定地级市下所有区县的全量时间序列数据
router.get('/prefecture/:prefecture', async (req, res) => {
    const { prefecture } = req.params;
    try {
        const sql = `
            SELECT c.* 
            FROM public.clcd_county c
            JOIN public.yunnan_country_level_city_boundaries b ON TRIM(c.region_name) = TRIM(b.县级)
            WHERE b.地级 = $1
            ORDER BY c.year ASC, c.region_name ASC
        `;
        const { rows } = await pool.query(sql, [prefecture.trim()]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取某年份所有区县数据
router.get('/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_county WHERE year = $1 ORDER BY region_name`;
        const { rows } = await pool.query(sql, [Number(year)]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

export default router;
