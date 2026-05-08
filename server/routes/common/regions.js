/**
 * 行政区划公共路由 (Administrative Regions Routes)
 * 职责：提供全省、地市及区县的三级级联数据结构，供前端下拉框或级联选择器使用。
 *
 * 修改提示：
 * 1. 此类接口数据更新频率极低，建议配合 Redis 或内存缓存机制优化响应速度。
 * 2. 接口返回的层级结构 (`name`, `children`) 必须与前端 `RegionCascader` 组件严格对齐。
 * 3. 若数据库新增区域变更，需同步更新底层缓存触发机制。
 */
/**
 * 区域数据路由
 * 端点：/:level (hierarchy, prefecture, county)
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';

const router = express.Router();

router.get('/:level', async (req, res) => {
    const { level } = req.params;
    try {
        if (level === 'hierarchy') {
            const sql = `
                SELECT DISTINCT "地级" as prefecture, "县级" as county 
                FROM public.yunnan_country_level_city_boundaries 
                WHERE "省级" = '云南省' 
                ORDER BY "地级", "县级"
            `;
            const { rows } = await pool.query(sql);

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
