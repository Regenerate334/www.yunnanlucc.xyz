import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

const CLCD_CLASS_MAP = {
    1: 'Cropland', 2: 'Forest', 3: 'Shrub', 4: 'Grassland', 5: 'Water',
    6: 'Snow/Ice', 7: 'Barren', 8: 'Impervious', 9: 'Wetland'
};

// 获取年份列表
router.get('/years', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT DISTINCT year FROM public.yunnan_clcd_merged_table ORDER BY year');
        res.json(rows.map(r => r.year));
    } catch (err) { handleError(res, err); }
});

// 获取某年份各地类面积统计
router.get('/:year/summary', async (req, res) => {
    const year = Number(req.params.year);
    try {
        const sql = `
      SELECT landuse_type, SUM(area_sqm) / 1e6 AS area_km2
      FROM public.yunnan_clcd_merged_table
      WHERE year = $1
      GROUP BY landuse_type
      ORDER BY landuse_type
    `;
        const { rows } = await pool.query(sql, [year]);
        res.json(rows.map(r => ({
            class_code: Number(r.landuse_type),
            class_name: CLCD_CLASS_MAP[Number(r.landuse_type)] || String(r.landuse_type),
            area_km2: Number(r.area_km2)
        })));
    } catch (err) { handleError(res, err); }
});

// 获取省份数据（宽表格式）
router.get('/province', async (_req, res) => {
    try {
        const { rows } = await pool.query(`SELECT year, land_use_type, area FROM public.clcd_province ORDER BY year, land_use_type`);
        const yearMap = {};
        rows.forEach(row => {
            if (!yearMap[row.year]) yearMap[row.year] = { year: row.year };
            yearMap[row.year][row.land_use_type] = Number(row.area);
        });
        res.json(Object.values(yearMap).sort((a, b) => a.year - b.year));
    } catch (err) { handleError(res, err); }
});

// 获取区域趋势数据
router.get('/trend/:level/:name', async (req, res) => {
    const { level, name } = req.params;
    try {
        const tableName = level === 'prefecture' ? 'public.clcd_prefecture' : 'public.clcd_county';
        const sql = `SELECT * FROM ${tableName} WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
        const { rows } = await pool.query(sql, [name.trim()]);
        res.json(rows.map(row => ({
            year: row.year,
            cropland: Number(row.cropland),
            forest: Number(row.forest),
            shrub: Number(row.shrub),
            grassland: Number(row.grassland),
            water: Number(row.water),
            snow_ice: Number(row.snow_ice),
            barren: Number(row.barren),
            impervious: Number(row.impervious),
            wetland: Number(row.wetland)
        })));
    } catch (err) { handleError(res, err); }
});

// 获取地级市/区县原始数据
router.get('/prefecture', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_prefecture ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

router.get('/county', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_county ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

export default router;
