/**
 * 分级断点计算路由
 * 端点：/breaks (统一支持单年和变化模式)
 * 核心算法：Jenks 自然断点、分位数、等间隔
 */
import express from 'express';
import pool from '../../config/db.js';
import logger from '../../config/logger.js';
import { handleError } from '../../middleware/logger.js';
import { query, validationResult } from 'express-validator';
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
router.get('/', [
    query('attr').optional().isIn(['cropland', 'forest', 'shrub', 'grassland', 'water', 'snow_ice', 'barren', 'impervious', 'wetland', 'reclamation', 'conversion']),
    query('unit').optional().isIn(['county', 'grid', 'clcd']),
    query('year').optional().isInt({ min: 1980, max: 2030 }),
    query('yearFrom').optional().isInt({ min: 1980, max: 2030 }),
    query('yearTo').optional().isInt({ min: 1980, max: 2030 }),
    query('mode').optional().isIn(['transfer', 'rate']),
    query('classes').optional().isInt({ min: 3, max: 12 }),
    query('year_start').optional().isInt({ min: 1980, max: 2030 }),
    query('year_end').optional().isInt({ min: 1980, max: 2030 }),
    query('from_class').optional().isInt({ min: 1, max: 9 }),
    query('to_class').optional().isInt({ min: 1, max: 9 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid parameters', details: errors.array() });
    }

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

    logger.info('[breaks] Incoming request:', { mode, attr, year, unit, method });

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

            logger.info(`[breaks] Transfer mode: ${validCols.length} cols, ${stats.count} rows, breaks:`, breaks);

            // [Security] 移除副作用：不再向物理表写入 _transfer_sum。
            // WMS 渲染应通过 SLD 环境变量或 SQL 视图动态处理复杂表达式。
            logger.info(`[breaks] Transfer mode computed: ${validCols.length} cols, ${stats.count} rows`);

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
            logger.error('[breaks] Transfer mode error:', err);
            return handleError(res, err);
        }
    }

    // ===== 垦殖率 / 转换率模式 =====
    // 仅支持县域尺度（格网每个单元面积相同，率值无意义）
    if (mode === 'rate') {
        const STATS_TABLE = 'spatial_county_yunnan_stats';
        const TRANSFER_TABLE = 'spatial_county_yunnan_transfer';
        const RATE_COL = '_rate_val';           // 临时中间列
        const numClasses = Math.min(Math.max(parseInt(classes || 10), 3), 12);

        try {
            // 1. 确保临时列已存在
            await pool.query(`
                ALTER TABLE public."${STATS_TABLE}"
                ADD COLUMN IF NOT EXISTS "${RATE_COL}" double precision DEFAULT 0
            `);

            // ---- 垦殖率 ----
            if (attr === 'reclamation') {
                if (!year) {
                    return res.status(400).json({ error: 'reclamation rate requires year param' });
                }
                const targetYear = parseInt(year);
                const years = await getAvailableYears();
                const dbCols = await getTableColumns(STATS_TABLE);
                const prefix = ATTR_PREFIX_MAP['cropland'];

                // 找出与目标年份对应的耕地面积列（按年份索引排序）
                const croplandCols = dbCols
                    .filter(c => c.startsWith(`${prefix}_sq_`))
                    .sort((a, b) => parseInt(a.split('_').pop()) - parseInt(b.split('_').pop()));
                const croplandCol = croplandCols[years.indexOf(targetYear)];

                if (!croplandCol) {
                    return res.status(400).json({ error: `Cannot find cropland column for year ${targetYear}` });
                }

                // [Security] 移除副作用：不再向物理表写入 _rate_val。
                logger.info(`[breaks/rate] Reclamation calculated for col=${croplandCol}, year=${targetYear}`);

                logger.info(`[breaks/rate] Reclamation updated: col=${croplandCol}, year=${targetYear}`);

                // ---- 转换率 ----
            } else if (attr === 'conversion') {
                const start = parseInt(year_start);
                const end = parseInt(year_end);
                const from = from_class !== undefined && from_class !== '' ? parseInt(from_class) : null;
                const to = to_class !== undefined && to_class !== '' ? parseInt(to_class) : null;

                if (!start || !end || start >= end) {
                    return res.status(400).json({ error: 'conversion rate requires valid year_start and year_end' });
                }

                // 构建需要累加的转换列名（与 transfer 模式列名逻辑完全一致）
                const columns = [];
                if (from !== null && to !== null) {
                    // 指定流转方向
                    for (let y = start; y < end; y++) {
                        if (y === 1985 && end >= 1990) { columns.push(`y8590_${from}${to}`); y = 1989; continue; }
                        const yy1 = String(y % 100).padStart(2, '0');
                        const yy2 = String((y + 1) % 100).padStart(2, '0');
                        columns.push(`y${yy1}${yy2}_${from}${to}`);
                    }
                } else {
                    // 全类型转换（排除自身到自身）
                    const periods = [];
                    for (let y = start; y < end; y++) {
                        if (y === 1985 && end >= 1990) { periods.push('y8590'); y = 1989; continue; }
                        const yy1 = String(y % 100).padStart(2, '0');
                        const yy2 = String((y + 1) % 100).padStart(2, '0');
                        periods.push(`y${yy1}${yy2}`);
                    }
                    const allTransferCols = await getTableColumns(TRANSFER_TABLE);
                    const regex = new RegExp(`^(${periods.join('|')})_\\d{2}$`);
                    allTransferCols.filter(c => {
                        if (!regex.test(c)) return false;
                        const ft = c.split('_').pop();
                        return ft[0] !== ft[1]; // 排除同类转换
                    }).forEach(c => columns.push(c));
                }

                if (columns.length === 0) {
                    return res.json({ mode: 'rate', attr, breaks: [], message: 'No transfer columns found for the given range' });
                }

                // 验证列实际存在于转换表
                const validRes = await pool.query(`
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2)
                `, [TRANSFER_TABLE, columns]);
                const validCols = validRes.rows.map(r => r.column_name);

                if (validCols.length === 0) {
                    return res.json({ mode: 'rate', attr, breaks: [], message: 'No valid transfer columns found' });
                }

                // 转换面积累加：单位 m²（保持与 shape_area 一致）
                const sumExpr = validCols.map(c => `COALESCE(t."${c}", 0)`).join(' + ');

                // 转换率 = SUM(转换面积 m²) / shape_area(m²)，结果为 0~1 小数
                // JOIN 条件与 transfer 模式一致（地名匹配）
                await pool.query(`
                    UPDATE public."${STATS_TABLE}" s
                    SET "${RATE_COL}" = CASE
                        WHEN s."shape_area" > 0
                        THEN (${sumExpr}) / s."shape_area"
                        ELSE 0
                    END
                    FROM public."${TRANSFER_TABLE}" t
                    WHERE TRIM(CAST(s."地名" AS TEXT)) = TRIM(CAST(t."地名" AS TEXT))
                `);

                logger.info(`[breaks/rate] Conversion updated: ${validCols.length} cols, ${start}-${end}, from=${from}, to=${to}`);

            } else {
                return res.status(400).json({ error: `Unknown rate attribute: ${attr}. Supported: reclamation, conversion` });
            }

            // 3. 读取写入结果，进行 Jenks 分级
            const { rows: dataRows } = await pool.query(`
                SELECT "${RATE_COL}" AS val
                FROM public."${STATS_TABLE}"
                WHERE "${RATE_COL}" > 0
                ORDER BY "${RATE_COL}" ASC
            `);

            if (dataRows.length === 0) {
                return res.json({ mode: 'rate', attr, breaks: [], stats: { min: 0, max: 0, count: 0 } });
            }

            let dataValues = dataRows.map(r => Number(r.val));

            const stats = {
                min: dataValues[0],
                max: dataValues[dataValues.length - 1],
                avg: dataValues.reduce((a, b) => a + b, 0) / dataValues.length,
                count: dataValues.length
            };

            // 采样防内存溢出
            if (dataValues.length > 3000) {
                const step = Math.ceil(dataValues.length / 3000);
                dataValues = dataValues.filter((_, i) => i % step === 0);
            }

            const rawBreaks = dataValues.length <= numClasses
                ? dataValues
                : getJenksBreaks(dataValues, numClasses);

            // 保留 6 位小数精度
            const breaks = rawBreaks.map(v => Math.round(v * 1000000) / 1000000);

            logger.info(`[breaks/rate] attr=${attr}, ${stats.count} rows, classes=${numClasses}, breaks:`, breaks);

            return res.json({
                mode: 'rate',
                attr,
                unit: 'county',
                field: RATE_COL,
                method: 'jenks',
                classes: numClasses,
                breaks,
                stats,
                unit_label: '%'
            });

        } catch (err) {
            logger.error('[breaks] Rate mode error:', err);
            return handleError(res, err);
        }
    }

    // ===== 原有面积/变化模式 =====
    const isChangeMode = yearFrom && yearTo;

    // 关键修复：从复合属性名中提取核心地类 (如 "1985__land_transfer_cropland" -> "cropland")
    let baseAttr = attr;
    if (attr.includes('__')) {
        const parts = attr.split('__');
        baseAttr = parts[parts.length - 1].toLowerCase();
        // 处理类似 "land_transfer_cropland" 的后缀
        if (baseAttr.includes('_')) {
            baseAttr = baseAttr.split('_').pop();
        }
    }

    const prefix = ATTR_PREFIX_MAP[baseAttr];

    if (!prefix) {
        logger.warn(`[breaks] Unsupported attribute parsing: ${attr} -> ${baseAttr}`);
        return res.status(400).json({ error: `Invalid attribute: ${attr} (Parsed as: ${baseAttr})` });
    }

    const tableName = unit === 'grid' ? 'spatial_grid_yunnan_stats' : 'spatial_county_yunnan_stats';

    try {
        const dbCols = await getTableColumns(tableName);
        const years = await getAvailableYears();

        /**
         * 将物理年份映射为标准化数据库字段 (方案: [地类]_[年份])
         * 示例: 1985 -> wat_1985, 1990 -> wat_1990
         */
        const resolveStandardField = (targetYear) => {
            const cleanYear = Number(targetYear);
            const targetColumnName = `${prefix}_${cleanYear}`;

            // 验证字段是否存在 (防止请求 2000, 2002 等空缺年份)
            return dbCols.includes(targetColumnName) ? targetColumnName : null;
        };

        let breaks = [];
        let stats = {};
        let field1, field2, fieldName;
        const numClasses = Math.min(Math.max(parseInt(classes), 3), 12);

        if (isChangeMode) {
            // ===== 变化分析模式 =====
            field1 = resolveStandardField(yearFrom);
            field2 = resolveStandardField(yearTo);

            if (!field1 || !field2) {
                return res.status(400).json({
                    error: `Cannot resolve fields for years ${yearFrom} or ${yearTo}`
                });
            }

            logger.info(`[breaks] Change mode: ${field1} → ${field2}`);

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
            fieldName = resolveStandardField(isChangeMode ? yearTo : (year || 2023));

            logger.info(`[breaks] Single year mode: ${fieldName}`);

            if (!fieldName || !dbCols.includes(fieldName)) {
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
        logger.error('[breaks] API Error:', err);
        handleError(res, err);
    }
});

export default router;
