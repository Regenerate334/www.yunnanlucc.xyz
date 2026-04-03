/**
 * 土地流转 GeoJSON API 路由
 * 
 * 端点:
 *   GET /api/analysis/transfer-flow/county?yearStart=&yearEnd=&fromClass=&toClass=
 *   GET /api/analysis/transfer-flow/grid?yearStart=&yearEnd=&fromClass=&toClass=
 * 
 * 响应: GeoJSON FeatureCollection, 每个 feature 含属性 transfer_area (m²)
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import {
    getAvailablePeriods,
    findOverlappingPeriods,
    buildColumnNames
} from '../../utils/period_encoder.js';

const router = express.Router();

/**
 * 核心查询逻辑：查询某空间表在给定年份范围和地类组合下的转移面积
 * @param {string} tableName
 * @param {number} yearStart
 * @param {number} yearEnd
 * @param {number} fromClass
 * @param {number} toClass
 * @param {'county'|'grid'} unit
 * @returns {Promise<Object>} GeoJSON FeatureCollection
 */
export async function queryTransferGeoJSON(tableName, yearStart, yearEnd, fromClass, toClass, unit) {
    // 1. 获取所有可用 period 前缀，并筛出覆盖目标区间的 period
    const allPeriods = await getAvailablePeriods(pool, tableName);
    const activePeriods = findOverlappingPeriods(allPeriods, yearStart, yearEnd);

    if (activePeriods.length === 0) {
        return { type: 'FeatureCollection', features: [], meta: { periods: [], message: '指定年份区间内无数据' } };
    }

    // 2. 构建字段名列表 (如 ['y8590_27', 'y9091_27'])
    const columns = buildColumnNames(activePeriods, fromClass, toClass);

    // 3. 检查字段是否真实存在（防止 SQL 注入 & 字段不存在的错误）
    const existingColsRes = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = ANY($2::text[]);
    `, [tableName, columns]);

    const existingCols = existingColsRes.rows.map(r => r.column_name);

    if (existingCols.length === 0) {
        return {
            type: 'FeatureCollection',
            features: [],
            meta: {
                periods: activePeriods,
                columns_requested: columns,
                message: '匹配字段在数据库中不存在，请确认地类编码是否有效'
            }
        };
    }

    // 4. 构建 SUM 子句 (累加多个 period)
    const sumExpr = existingCols.map(c => `COALESCE("${c}", 0)`).join(' + ');

    // 5. 根据空间单元选择 SQL（加入几何简化防 OOM）
    //    - 县域: 4178行，ST_Simplify(0.001°) 即可，不限行数
    //    - 格网: 可能数万行，仅取转移面积最大的 TOP 2000 格网
    const TOLERANCE = unit === 'county' ? 0.005 : 0.001; // 度（县域适当简化减少内存占用）
    const LIMIT_CLAUSE = unit === 'county' ? '' : 'ORDER BY transfer_area DESC LIMIT 2000';

    // 安全校验: 只允许两个已知合法表名
    const ALLOWED_TABLES = {
        county: 'spatial_county_yunnan_transfer',
        grid: 'spatial_grid_yunnan_transfer'
    };
    if (!ALLOWED_TABLES[unit]) {
        throw new Error(`非法空间单元: ${unit}`);
    }
    const safeName = ALLOWED_TABLES[unit];

    // 6. 执行查询
    const nameField = unit === 'county'
        ? '"地名" AS name, "区划码" AS adcode,'
        : 'grid_id AS name, grid_id AS adcode,';

    const sql = `
        SELECT
            gid,
            ${nameField}
            (${sumExpr}) AS transfer_area,
            ST_AsGeoJSON(
                ST_SimplifyPreserveTopology(ST_Transform(geom, 4326), ${TOLERANCE})
            )::json AS geometry
        FROM public."${safeName}"
        WHERE (${sumExpr}) > 0
        ${LIMIT_CLAUSE};
    `;

    const result = await pool.query(sql);

    // 7. 组装 GeoJSON
    const features = result.rows.map(row => ({
        type: 'Feature',
        id: row.gid,
        geometry: row.geometry,
        properties: {
            gid: row.gid,
            name: row.name,
            adcode: row.adcode,
            transfer_area: parseFloat(row.transfer_area) || 0
        }
    }));

    return {
        type: 'FeatureCollection',
        features,
        meta: {
            yearStart,
            yearEnd,
            fromClass,
            toClass,
            periods: activePeriods,
            columns_used: existingCols,
            feature_count: features.length
        }
    };
}

// ─── 县域端点 ─────────────────────────────────────────────────────────────────
router.get('/county', async (req, res) => {
    const { yearStart, yearEnd, fromClass, toClass } = req.query;

    if (!yearStart || !yearEnd || !fromClass || !toClass) {
        return res.status(400).json({ error: '缺少必要参数: yearStart, yearEnd, fromClass, toClass' });
    }

    try {
        const geoJSON = await queryTransferGeoJSON(
            'spatial_county_yunnan_transfer',
            parseInt(yearStart), parseInt(yearEnd),
            parseInt(fromClass), parseInt(toClass),
            'county'
        );
        res.json(geoJSON);
    } catch (err) {
        handleError(res, err);
    }
});

// ─── 格网端点 ─────────────────────────────────────────────────────────────────
router.get('/grid', async (req, res) => {
    const { yearStart, yearEnd, fromClass, toClass } = req.query;

    if (!yearStart || !yearEnd || !fromClass || !toClass) {
        return res.status(400).json({ error: '缺少必要参数: yearStart, yearEnd, fromClass, toClass' });
    }

    try {
        const geoJSON = await queryTransferGeoJSON(
            'spatial_grid_yunnan_transfer',
            parseInt(yearStart), parseInt(yearEnd),
            parseInt(fromClass), parseInt(toClass),
            'grid'
        );
        res.json(geoJSON);
    } catch (err) {
        handleError(res, err);
    }
});

export default router;
