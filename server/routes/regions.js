import express from 'express';
import pool from '../config/db.js';
import { handleError } from '../middleware/logger.js';

const router = express.Router();

router.get('/:level', async (req, res) => {
    const { level } = req.params;
    try {
        if (level === 'hierarchy') {
            // 增加省级过滤，只保留云南省的数据
            const sql = `
                SELECT DISTINCT "地级" as prefecture, "县级" as county 
                FROM public.yunnan_country_level_city_boundaries 
                WHERE "省级" = '云南省' 
                ORDER BY "地级", "县级"
            `;
            const { rows } = await pool.query(sql);

            // 构建树形结构
            const hierarchy = {};
            rows.forEach(row => {
                if (row.prefecture) {
                    if (!hierarchy[row.prefecture]) {
                        hierarchy[row.prefecture] = [];
                    }
                    if (row.county) {
                        hierarchy[row.prefecture].push(row.county);
                    }
                }
            });

            const result = Object.keys(hierarchy).map(pref => ({
                name: pref,
                children: hierarchy[pref]
            }));

            res.json(result);
        } else {
            const tableName = level === 'prefecture' ? 'public.clcd_prefecture' : 'public.clcd_county';
            const sql = `SELECT DISTINCT region_name FROM ${tableName} ORDER BY region_name ASC`;
            const { rows } = await pool.query(sql);
            res.json(rows.map(r => r.region_name));
        }
    } catch (err) { handleError(res, err); }
});

export default router;
