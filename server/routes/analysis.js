import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

router.get('/transfer-matrix/periods', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT DISTINCT period FROM public.clcd_transfer_matrix ORDER BY period');
        res.json(rows.map(r => r.period));
    } catch (err) { handleError(res, err); }
});

router.get('/transfer-matrix/:period', async (req, res) => {
    const { period } = req.params;
    try {
        const { rows } = await pool.query(`SELECT * FROM public.clcd_transfer_matrix WHERE period = $1`, [period]);
        const matrix = {};
        const landTypes = new Set();
        rows.forEach(row => {
            landTypes.add(row.from_class);
            landTypes.add(row.to_class);
            if (!matrix[row.from_class]) matrix[row.from_class] = {};
            matrix[row.from_class][row.to_class] = Number(row.area);
        });
        const percentageMatrix = {};
        const types = Array.from(landTypes);
        types.forEach(from => {
            percentageMatrix[from] = {};
            let total = 0;
            types.forEach(to => { total += (matrix[from]?.[to] || 0); });
            types.forEach(to => {
                percentageMatrix[from][to] = total > 0 ? parseFloat(((matrix[from]?.[to] || 0) / total * 100).toFixed(2)) : 0;
            });
        });
        res.json({ absoluteMatrix: matrix, percentageMatrix, landTypes: types, period });
    } catch (err) { handleError(res, err); }
});

router.get('/dashboard/:year', async (req, res) => {
    const year = Number(req.params.year);
    const baseYear = 1985; // 基准年
    try {
        // 1. 获取当前年份省份汇总数据
        const provinceSql = `SELECT * FROM public.clcd_province WHERE year = $1`;
        const { rows: currentRows } = await pool.query(provinceSql, [year]);
        const { rows: baseRows } = await pool.query(provinceSql, [baseYear]);

        const formatProvince = (rows) => {
            const obj = {};
            rows.forEach(r => { obj[r.land_use_type] = Number(r.area); });
            return obj;
        };

        const currentSummary = formatProvince(currentRows);
        const baseSummary = formatProvince(baseRows);

        // 2. 获取地级市动态度排行 (Top 10)
        // 简单起见，计算当前年相对于基准年的综合动态度
        const prefectureSql = `
            SELECT p1.region_name, 
                   p1.cropland as c1, p1.forest as f1, p1.shrub as s1, p1.grassland as g1, 
                   p1.water as w1, p1.snow_ice as i1, p1.barren as b1, p1.impervious as m1, p1.wetland as t1,
                   p2.cropland as c2, p2.forest as f2, p2.shrub as s2, p2.grassland as g2, 
                   p2.water as w2, p2.snow_ice as i2, p2.barren as b2, p2.impervious as m2, p2.wetland as t2
            FROM public.clcd_prefecture p1
            JOIN public.clcd_prefecture p2 ON p1.region_name = p2.region_name
            WHERE p1.year = $1 AND p2.year = $2
        `;
        const { rows: prefRows } = await pool.query(prefectureSql, [year, baseYear]);

        const ranking = prefRows.map(r => {
            const totalStart = r.c2 + r.f2 + r.s2 + r.g2 + r.w2 + r.i2 + r.b2 + r.m2 + r.t2;
            const totalChange = Math.abs(r.c1 - r.c2) + Math.abs(r.f1 - r.f2) + Math.abs(r.s1 - r.s2) +
                Math.abs(r.g1 - r.g2) + Math.abs(r.w1 - r.w2) + Math.abs(r.i1 - r.i2) +
                Math.abs(r.b1 - r.b2) + Math.abs(r.m1 - r.m2) + Math.abs(r.t1 - r.t2);
            const dynamicDegree = totalStart > 0 ? (totalChange / (2 * totalStart)) / (year - baseYear) * 100 : 0;
            return { name: r.region_name, value: parseFloat(dynamicDegree.toFixed(4)) };
        }).sort((a, b) => b.value - a.value).slice(0, 10);

        // 3. 预警信息 (示例：耕地减少超过一定比例)
        const alerts = [];
        if (currentSummary.cropland < baseSummary.cropland * 0.95) {
            alerts.push({
                id: Date.now(),
                type: 'danger',
                title: '耕地红线预警',
                content: `当前耕地面积较1985年减少超过5%，请加强保护。`,
                time: new Date().toISOString()
            });
        }

        res.json({
            year,
            summary: currentSummary,
            baseSummary,
            ranking,
            alerts
        });
    } catch (err) { handleError(res, err); }
});

export default router;
