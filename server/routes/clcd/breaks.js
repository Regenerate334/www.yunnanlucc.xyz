/**
 * 分级断点计算路由
 * 端点：/breaks (统一支持单年和变化模式)
 * 核心算法：Jenks 自然断点、分位数、等间隔
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import {
    ATTR_PREFIX_MAP,
    getAvailableYears,
    getTableColumns,
    getJenksBreaks
} from './utils.js';

const router = express.Router();

/**
 * 统一分级断点接口
 * 单年模式: GET /breaks?attr=cropland&year=1990&unit=county
 * 变化模式: GET /breaks?attr=cropland&yearFrom=1985&yearTo=2023&unit=county
 */
router.get('/', async (req, res) => {
    const {
        attr = 'cropland',
        year,
        yearFrom,
        yearTo,
        unit = 'county',
        method = 'quantile',
        classes = 9,
        // Transfer mode params
        mode,
        year_start,
        year_end,
        from_class,
        to_class
    } = req.query;

    // ===== 转移矩阵模式 =====
    if (mode === 'transfer') {
        try {
            if (!year_start || !year_end || !from_class || !to_class) {
                return res.status(400).json({ error: 'Missing transfer params: year_start, year_end, from_class, to_class' });
            }

            const tableName = unit === 'grid'
                ? 'spatial_grid_yunnan_transfer'
                : 'spatial_county_yunnan_transfer';
            const numClasses = Math.min(Math.max(parseInt(classes), 3), 12);
            const start = parseInt(year_start);
            const end = parseInt(year_end);
            const from = parseInt(from_class);
            const to = parseInt(to_class);

            // 1. 构建列名
            const columns = [];
            for (let y = start; y < end; y++) {
                if (y === 1985 && end >= 1990) {
                    columns.push(`y8590_${from}${to}`);
                    y = 1989;
                    continue;
                }
                const yy1 = y % 100;
                const yy2 = (y + 1) % 100;
                const s1 = yy1 < 10 ? `0${yy1}` : `${yy1}`;
                const s2 = yy2 < 10 ? `0${yy2}` : `${yy2}`;
                columns.push(`y${s1}${s2}_${from}${to}`);
            }

            if (columns.length === 0) {
                return res.json({ breaks: [], sumExpr: '', stats: {} });
            }

            // 2. 验证列存在性
            const validColsRes = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = $1
                AND column_name = ANY($2)
            `, [tableName, columns]);
            const validCols = validColsRes.rows.map(r => r.column_name);

            if (validCols.length === 0) {
                return res.json({ breaks: [], sumExpr: '', stats: {}, message: 'No matching columns found' });
            }

            // 3. 构建 SUM 表达式
            const sumExpr = validCols.map(c => `COALESCE("${c}", 0)`).join(' + ');

            // 4. 查询统计 + 数据（单位 m²，转 km²）
            const statsSql = `
                SELECT 
                    min(val) / 1000000.0 as min_val,
                    max(val) / 1000000.0 as max_val,
                    avg(val) / 1000000.0 as avg_val,
                    count(*) as count_val
                FROM (
                    SELECT (${sumExpr}) as val 
                    FROM public."${tableName}" 
                    WHERE (${sumExpr}) > 0
                ) sub
            `;
            const { rows: [statsRow] } = await pool.query(statsSql);
            const stats = {
                min: Number(statsRow?.min_val || 0),
                max: Number(statsRow?.max_val || 0),
                avg: Number(statsRow?.avg_val || 0),
                count: Number(statsRow?.count_val || 0)
            };

            // 5. Jenks 分级
            const dataSql = `
                SELECT (${sumExpr}) / 1000000.0 as val 
                FROM public."${tableName}" 
                WHERE (${sumExpr}) > 0
                ORDER BY val ASC
            `;
            const { rows: allRows } = await pool.query(dataSql);
            let dataValues = allRows.map(r => Number(r.val));

            // 采样防内存溢出（grid 表可能有 4000+ 行）
            if (dataValues.length > 3000) {
                const step = Math.ceil(dataValues.length / 3000);
                dataValues = dataValues.filter((_, i) => i % step === 0);
            }

            let breaks = dataValues.length <= numClasses
                ? dataValues
                : getJenksBreaks(dataValues, numClasses);

            breaks = breaks.map(v => Math.round(v * 1000000) / 1000000);

            console.log(`[breaks] Transfer mode: ${validCols.length} cols, ${stats.count} rows, breaks:`, breaks);

            // 6. 将计算结果写入 _transfer_sum 列（供 GeoServer WMS 直接读取）
            try {
                // 确保列存在
                await pool.query(`
                    ALTER TABLE public."${tableName}" 
                    ADD COLUMN IF NOT EXISTS _transfer_sum double precision DEFAULT 0
                `);
                // 写入计算值
                await pool.query(`
                    UPDATE public."${tableName}" 
                    SET _transfer_sum = (${sumExpr}) / 1000000.0
                `);
                console.log(`[breaks] Updated _transfer_sum in ${tableName}`);
            } catch (updateErr) {
                console.error('[breaks] Failed to update _transfer_sum:', updateErr.message);
                // 不中断响应，breaks 数据仍然有效
            }

            return res.json({
                mode: 'transfer',
                year_start: start,
                year_end: end,
                from_class: from,
                to_class: to,
                unit,
                validCols,
                sumExpr,
                field: '_transfer_sum',
                method: 'jenks',
                classes: numClasses,
                breaks,
                stats,
                unit_label: 'km²'
            });

        } catch (err) {
            console.error('[breaks] Transfer mode error:', err);
            return handleError(res, err);
        }
    }

    // ===== 原有面积/变化模式 =====
    const isChangeMode = yearFrom && yearTo;
    const prefix = ATTR_PREFIX_MAP[attr];

    if (!prefix) {
        return res.status(400).json({ error: `Invalid attribute: ${attr}` });
    }

    const tableName = unit === 'grid' ? 'spatial_grid_yunnan_stats' : 'spatial_county_yunnan_stats';

    try {
        const dbCols = await getTableColumns(tableName);
        const years = await getAvailableYears();

        // 年份到字段名的映射
        const resolveField = (y) => {
            const yInt = Number(y);
            const idx = years.indexOf(yInt);
            if (idx === -1) return null;

            const relevantCols = dbCols
                .filter(c => c.startsWith(`${prefix}_sq_`))
                .sort((a, b) => {
                    const numA = parseInt(a.split('_').pop());
                    const numB = parseInt(b.split('_').pop());
                    return numA - numB;
                });

            if (idx < relevantCols.length) return relevantCols[idx];
            return null;
        };

        let breaks = [];
        let stats = {};
        let field1, field2, fieldName;
        const numClasses = Math.min(Math.max(parseInt(classes), 3), 12);

        if (isChangeMode) {
            // ===== 变化分析模式 =====
            field1 = resolveField(yearFrom);
            field2 = resolveField(yearTo);

            if (!field1 || !field2) {
                return res.status(400).json({
                    error: `Cannot resolve fields for years ${yearFrom} or ${yearTo}`
                });
            }

            console.log(`[breaks] Change mode: ${field1} → ${field2}`);

            // 计算差值统计
            const statsSql = `
                SELECT 
                    min(${field2} - ${field1}) as min_val,
                    max(${field2} - ${field1}) as max_val,
                    avg(${field2} - ${field1}) as avg_val,
                    stddev(${field2} - ${field1}) as std_val,
                    count(*) as count_val
                FROM public.${tableName}
                WHERE ${field1} IS NOT NULL AND ${field2} IS NOT NULL
            `;
            const { rows: [statsRow] } = await pool.query(statsSql);
            stats = {
                min: Number(statsRow.min_val) / 1000000,
                max: Number(statsRow.max_val) / 1000000,
                avg: Number(statsRow.avg_val) / 1000000,
                std: Number(statsRow.std_val) / 1000000,
                count: Number(statsRow.count_val)
            };

            // 获取差值数据进行分级
            const dataSql = `
                SELECT (${field2} - ${field1}) as val
                FROM public.${tableName}
                WHERE ${field1} IS NOT NULL AND ${field2} IS NOT NULL
                ORDER BY val ASC
            `;
            const { rows: allRows } = await pool.query(dataSql);
            let dataValues = allRows.map(r => Number(r.val) / 1000000);

            // 采样
            if (dataValues.length > 5000) {
                const step = Math.ceil(dataValues.length / 5000);
                dataValues = dataValues.filter((_, i) => i % step === 0);
            }

            breaks = dataValues.length <= numClasses
                ? dataValues
                : getJenksBreaks(dataValues, numClasses);

        } else {
            // ===== 单年面积模式 =====
            const targetYear = year || 2023;
            fieldName = resolveField(targetYear);

            if (!fieldName) {
                return res.json({
                    breaks: [],
                    min: 0,
                    max: 0,
                    unit: 'km²',
                    message: 'No data column available'
                });
            }

            console.log(`[breaks] Single year mode: ${fieldName}`);

            if (!dbCols.includes(fieldName)) {
                return res.status(400).json({ error: `Field ${fieldName} not found` });
            }

            const whereClause = `${fieldName} IS NOT NULL AND ${fieldName} > 0`;

            const statsSql = `
                SELECT 
                    min(${fieldName}) as min_val,
                    max(${fieldName}) as max_val,
                    avg(${fieldName}) as avg_val,
                    stddev(${fieldName}) as std_val,
                    count(${fieldName}) as count_val
                FROM public.${tableName}
                WHERE ${whereClause}
            `;
            const { rows: [statsRow] } = await pool.query(statsSql);
            stats = {
                min: Number(statsRow.min_val) / 1000000,
                max: Number(statsRow.max_val) / 1000000,
                avg: Number(statsRow.avg_val) / 1000000,
                std: Number(statsRow.std_val) / 1000000,
                count: Number(statsRow.count_val)
            };

            if (method === 'quantile' || method === 'percentile') {
                const percentiles = Array.from({ length: numClasses - 1 }, (_, i) => (i + 1) / numClasses);

                const percentileSql = `
                    SELECT percentile_cont(ARRAY[${percentiles.join(',')}]) 
                    WITHIN GROUP (ORDER BY ${fieldName}) as breaks
                    FROM public.${tableName}
                    WHERE ${whereClause}
                `;
                const { rows: [percRow] } = await pool.query(percentileSql);
                breaks = [stats.min, ...percRow.breaks.map(v => Number(v) / 1000000), stats.max];
            } else if (method === 'jenks' || method === 'natural_breaks') {
                const allDataSql = `
                    SELECT ${fieldName} as val
                    FROM public.${tableName}
                    WHERE ${whereClause}
                    ORDER BY ${fieldName} ASC
                `;
                const { rows: allRows } = await pool.query(allDataSql);
                let dataValues = allRows.map(r => Number(r.val) / 1000000);

                if (dataValues.length > 3000) {
                    const step = Math.ceil(dataValues.length / 3000);
                    dataValues = dataValues.filter((_, i) => i % step === 0);
                }

                breaks = dataValues.length <= numClasses
                    ? dataValues
                    : getJenksBreaks(dataValues, numClasses);
            } else {
                // 等间隔分级
                const range = stats.max - stats.min;
                const step = range / numClasses;
                breaks = Array.from({ length: numClasses + 1 }, (_, i) => stats.min + step * i);
            }
        }

        // 格式化：增加精度到 6 位小数，确保小面积地类（如冰雪、湿地）不会因为舍入变为 0
        breaks = breaks.map(v => Math.round(v * 1000000) / 1000000);

        res.json({
            attribute: attr,
            isChangeMode,
            yearFrom: isChangeMode ? Number(yearFrom) : null,
            yearTo: isChangeMode ? Number(yearTo) : null,
            year: isChangeMode ? null : Number(year || 2023),
            field: isChangeMode ? `${field2} - ${field1}` : fieldName,
            field1: isChangeMode ? field1 : null,
            field2: isChangeMode ? field2 : null,
            method,
            classes: numClasses,
            breaks,
            stats,
            unit: 'km²'
        });
    } catch (err) {
        console.error('[breaks] API Error:', err);
        handleError(res, err);
    }
});

export default router;
