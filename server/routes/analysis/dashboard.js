/**
 * 仪表盘数据路由
 * 端点：/dashboard/:year
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import { calculateDynamicDegree, calculateSingleDynamicDegree } from '../../utils/indices/dynamicDegree.js';

const router = express.Router();

// 获取仪表盘综合数据
router.get('/:year', async (req, res) => {
    const year = Number(req.params.year);
    const type = req.query.type || 'comprehensive';
    const baseYear = 1985;

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
            const yearDiff = Math.abs(year - baseYear);
            let dynamicDegree = 0;

            if (type === 'comprehensive') {
                const startData = {
                    cropland: r.c2, forest: r.f2, shrub: r.s2, grassland: r.g2,
                    water: r.w2, snow_ice: r.i2, barren: r.b2, impervious: r.m2, wetland: r.t2
                };
                const endData = {
                    cropland: r.c1, forest: r.f1, shrub: r.s1, grassland: r.g1,
                    water: r.w1, snow_ice: r.i1, barren: r.b1, impervious: r.m1, wetland: r.t1
                };
                dynamicDegree = calculateDynamicDegree(startData, endData, yearDiff);
            } else {
                const typeMap = {
                    cropland: 'c', forest: 'f', grassland: 'g', impervious: 'm', water: 'w'
                };
                const alias = typeMap[type] || 'c';
                const startArea = Number(r[alias + '2'] || 0);
                const endArea = Number(r[alias + '1'] || 0);
                dynamicDegree = calculateSingleDynamicDegree(startArea, endArea, yearDiff);
            }

            return {
                name: r.region_name.replace('市', '').replace('自治州', '').replace('地区', ''),
                value: parseFloat(Math.abs(dynamicDegree).toFixed(4))
            };
        }).sort((a, b) => b.value - a.value).slice(0, 10);

        // 3. 预警信息
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

        console.log(`[Dashboard] Year: ${year}, Type: ${type}, Top1: ${ranking[0]?.name} (${ranking[0]?.value}%)`);

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
