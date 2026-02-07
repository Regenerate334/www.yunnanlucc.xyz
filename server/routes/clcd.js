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
        const { rows } = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
        res.json(rows.map(r => r.year));
    } catch (err) { handleError(res, err); }
});

// 获取某年份各地类面积统计
router.get('/:year/summary', async (req, res) => {
    const year = Number(req.params.year);
    try {
        // 改为从 clcd_province 静态表获取，不再需要 SUM 计算
        const sql = `
            SELECT land_use_type as class_name, area as area_km2
            FROM public.clcd_province
            WHERE year = $1
            ORDER BY land_use_type
        `;
        const { rows } = await pool.query(sql, [year]);
        res.json(rows.map(r => ({
            class_name: r.class_name,
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

// 获取所有地级市数据
router.get('/prefecture', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_prefecture ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取所有区县数据
router.get('/county', async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_county ORDER BY year, region_name');
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定地级市的全量时间序列数据
router.get('/prefecture/name/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_prefecture WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
        const { rows } = await pool.query(sql, [name.trim()]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定区县的全量时间序列数据
router.get('/county/name/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_county WHERE TRIM(region_name) = $1 ORDER BY year ASC`;
        const { rows } = await pool.query(sql, [name.trim()]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取特定地级市下所有区县的全量时间序列数据
router.get('/county/prefecture/:prefecture', async (req, res) => {
    const { prefecture } = req.params;
    try {
        // 使用关联查询，通过边界表找到该地级市下的所有区县
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

// 获取某年份所有地级市数据 (用于地图初始化展示)
router.get('/prefecture/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_prefecture WHERE year = $1 ORDER BY region_name`;
        const { rows } = await pool.query(sql, [Number(year)]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取某年份所有区县数据
router.get('/county/year/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const sql = `SELECT * FROM public.clcd_county WHERE year = $1 ORDER BY region_name`;
        const { rows } = await pool.query(sql, [Number(year)]);
        res.json(rows);
    } catch (err) { handleError(res, err); }
});

// 获取县级空间数据（GeoJSON格式，用于区域检测分析）
router.get('/spatial/county/:year', async (req, res) => {
    const { year } = req.params;
    try {
        // 从空间表获取几何数据，并关联统计属性
        // 修正: 经过排查，空间表字段名为 name_zh 而非 name
        // 动态探测列名以解决 500 报错 (column s.name/s.name_zh does not exist)
        const colSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'spatial_county_yunnan_stats'
        `;
        const { rows: columns } = await pool.query(colSql);
        const colNames = columns.map(c => c.column_name);
        console.log('[clcd] Actual columns in spatial table:', colNames);

        // 智能映射
        const nameCol = colNames.find(c => ['name_zh', '县级', 'name', 'region_name', 'NAME'].includes(c)) || colNames[0];
        const geomCol = colNames.find(c => ['geom', 'geometry', 'shape', 'the_geom'].includes(c)) || 'geom';
        const adcodeCol = colNames.find(c => ['adcode', 'code', 'ADCODE'].includes(c)) || 'adcode';

        const finalSql = `
            SELECT 
                s.${nameCol} as name,
                ${colNames.includes(adcodeCol) ? `s.${adcodeCol}` : 'NULL'} as adcode,
                ST_AsGeoJSON(s.${geomCol}) as geometry,
                c.cropland, c.forest, c.shrub, c.grassland, c.water,
                c.snow_ice, c.barren, c.impervious, c.wetland
            FROM public.spatial_county_yunnan_stats s
            LEFT JOIN public.clcd_county c ON ${colNames.includes(nameCol) && typeof nameCol === 'string' ? `TRIM(CAST(s.${nameCol} AS TEXT))` : `s.${nameCol}::text`} = TRIM(c.region_name) AND c.year = $1
            WHERE s.${geomCol} IS NOT NULL
        `;
        const { rows } = await pool.query(finalSql, [Number(year)]);

        // 构建 GeoJSON FeatureCollection
        const features = rows.map(row => ({
            type: 'Feature',
            properties: {
                name: row.name,
                adcode: row.adcode,
                cropland: Number(row.cropland) || 0,
                forest: Number(row.forest) || 0,
                shrub: Number(row.shrub) || 0,
                grassland: Number(row.grassland) || 0,
                water: Number(row.water) || 0,
                snow_ice: Number(row.snow_ice) || 0,
                barren: Number(row.barren) || 0,
                impervious: Number(row.impervious) || 0,
                wetland: Number(row.wetland) || 0
            },
            geometry: JSON.parse(row.geometry)
        }));

        res.json({
            type: 'FeatureCollection',
            features
        });
    } catch (err) {
        console.error('[clcd] Spatial API Error:', err);
        handleError(res, err);
    }
});

// 获取格网级空间数据（GeoJSON格式，用于区域检测分析）
router.get('/spatial/grid/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const colSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'spatial_grid_yunnan_stats'
        `;
        const { rows: columns } = await pool.query(colSql);
        const colNames = columns.map(c => c.column_name);

        const nameCol = colNames.find(c => ['id', 'fid', 'gid', 'grid_id', 'OBJECTID'].includes(c)) || colNames[0];
        const geomCol = colNames.find(c => ['geom', 'geometry', 'shape', 'the_geom'].includes(c)) || 'geom';

        const finalSql = `
            SELECT 
                s.${nameCol} as name,
                ST_AsGeoJSON(s.${geomCol}) as geometry,
                c.cropland, c.forest, c.shrub, c.grassland, c.water,
                c.snow_ice, c.barren, c.impervious, c.wetland
            FROM public.spatial_grid_yunnan_stats s
            LEFT JOIN public.clcd_county c ON s.${nameCol}::text = c.region_name AND c.year = $1
            WHERE s.${geomCol} IS NOT NULL
            LIMIT 10000 
        `;
        const { rows } = await pool.query(finalSql, [Number(year)]);

        const features = rows.map(row => ({
            type: 'Feature',
            properties: {
                name: `格网 ${row.name}`,
                cropland: Number(row.cropland) || 0,
                forest: Number(row.forest) || 0,
                shrub: Number(row.shrub) || 0,
                grassland: Number(row.grassland) || 0,
                water: Number(row.water) || 0,
                snow_ice: Number(row.snow_ice) || 0,
                barren: Number(row.barren) || 0,
                impervious: Number(row.impervious) || 0,
                wetland: Number(row.wetland) || 0
            },
            geometry: JSON.parse(row.geometry)
        }));

        res.json({
            type: 'FeatureCollection',
            features
        });
    } catch (err) {
        console.error('[clcd] Grid Spatial API Error:', err);
        handleError(res, err);
    }
});

// 计算分级断点（用于WMS样式动态分级）
// GET /api/clcd/breaks?attr=cropland&year=1990&unit=county&method=quantile&classes=8
router.get('/breaks', async (req, res) => {
    const { attr = 'cropland', year = 1990, unit = 'county', method = 'quantile', classes = 8 } = req.query;

    // 属性名到数据库字段前缀的映射
    const attrPrefixMap = {
        cropland: 'cro', forest: 'for', shrub: 'shr', grassland: 'gra',
        water: 'wat', wetland: 'wet', impervious: 'imp', barren: 'bar', snow_ice: 'ice'
    };

    const prefix = attrPrefixMap[attr];
    if (!prefix) {
        return res.status(400).json({ error: `Invalid attribute: ${attr}` });
    }

    // 智能字段名映射逻辑
    // 由于数据库列名可能被截断 (如 cro_sq_198 等)，不能简单使用 slice(-3)
    let fieldName = `${prefix}_sq_${String(year).slice(-3)}`;

    try {
        // 1. 获取该属性所有相关列名 (Strict match for sq columns)
        const colsSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = $1 
              AND column_name LIKE '${prefix}_sq_%'
            ORDER BY column_name 
        `;
        const tableName = unit === 'grid' ? 'spatial_grid_yunnan_stats' : 'spatial_county_yunnan_stats';
        const { rows: colRows } = await pool.query(colsSql, [tableName]);

        // Custom sort to handle numeric suffixes if needed
        const dbCols = colRows.map(r => r.column_name).sort();

        // 2. 获取所有可用年份
        const yearSql = 'SELECT DISTINCT year FROM public.clcd_province ORDER BY year';
        const { rows: yearRows } = await pool.query(yearSql);
        const years = yearRows.map(r => r.year);

        // 3. Establish index-based mapping with Alignment Fix
        // Grid Table lacks 1985. Years: 1985 (idx 0), 1990 (idx 1)...
        // Columns: 34 cols (1990-2023).

        let targetIndex = years.indexOf(Number(year));

        // Column mapping logic simplified: The years array (35 items) matches the columns array (35 items) 1:1.
        // Index 0 -> 1985 -> bar_sq_198
        // Index 1 -> 1990 -> bar_sq_199
        // No shifting needed.
        if (tableName === 'spatial_grid_yunnan_stats') {
            // Verify alignment just in case
            // console.log(`[clcd] Mapping year ${year} (Index ${targetIndex}) to column...`);
        }

        if (targetIndex !== -1) {
            if (targetIndex < dbCols.length) {
                // Happy path: Column now aligns perfectly (e.g. 2023 -> imp_sq_231)
                fieldName = dbCols[targetIndex];
            } else if (dbCols.length > 0) {
                // Fallback only if genuinely out of bounds (e.g. 2024)
                fieldName = dbCols[dbCols.length - 1];
                console.warn(`[clcd] Missing column for year ${year}. Fallback to: ${fieldName}`);
            }
        } else {
            // Year not available (e.g. grid mode 1985)
            fieldName = null;
        }

        if (fieldName) {
            console.log(`[clcd] Mapped year ${year} to column ${fieldName}`);
        } else {
            console.warn(`[clcd] No spatial column found for year ${year} (Index ${targetIndex}, Cols ${dbCols.length})`);
            // Default to a safe fallback or return empty stats to prevent crash
            return res.json({
                breaks: [],
                min: 0,
                max: 0,
                unit: 'km²',
                message: 'No data column available'
            });
        }


        // 验证字段是否存在
        const colCheck = await pool.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        `, [tableName, fieldName]);

        if (colCheck.rows.length === 0) {
            // 如果还找不到，返回第一个作为 fallback 避免崩盘，或者报错
            // 尝试在前20个列里找
            return res.status(400).json({ error: `Field ${fieldName} not found in ${tableName} (Mapped from year ${year})` });
        }


        let breaks = [];
        let stats = {};

        // 获取基本统计信息
        const numClasses = Math.min(Math.max(parseInt(classes), 3), 12);

        // 获取基本统计信息
        const statsSql = `
            SELECT 
                min(${fieldName}) as min_val,
                max(${fieldName}) as max_val,
                avg(${fieldName}) as avg_val,
                stddev(${fieldName}) as std_val,
                count(${fieldName}) as count_val
            FROM public.${tableName}
            WHERE ${fieldName} IS NOT NULL AND ${fieldName} > 0
        `;
        const { rows: [statsRow] } = await pool.query(statsSql);
        stats = {
            min: Number(statsRow.min_val) / 1000000, // 转为km²
            max: Number(statsRow.max_val) / 1000000,
            avg: Number(statsRow.avg_val) / 1000000,
            std: Number(statsRow.std_val) / 1000000,
            count: Number(statsRow.count_val)
        };

        if (method === 'quantile' || method === 'percentile') {
            // 百分位数分级（等分位）
            const percentiles = [];
            for (let i = 1; i < numClasses; i++) {
                percentiles.push(i / numClasses);
            }

            const percentileSql = `
                SELECT percentile_cont(ARRAY[${percentiles.join(',')}]) 
                WITHIN GROUP (ORDER BY ${fieldName}) as breaks
                FROM public.${tableName}
                WHERE ${fieldName} IS NOT NULL AND ${fieldName} > 0
            `;
            const { rows: [percRow] } = await pool.query(percentileSql);

            // 添加首尾值
            breaks = [stats.min, ...percRow.breaks.map(v => Number(v) / 1000000), stats.max];
        } else if (method === 'jenks' || method === 'natural_breaks') {
            // 自然断点法 (Jenks)
            // 1. 获取所有数据点
            const allDataSql = `
                SELECT ${fieldName} as val
                FROM public.${tableName}
                WHERE ${fieldName} IS NOT NULL AND ${fieldName} > 0
                ORDER BY ${fieldName} ASC
            `;
            const { rows: allRows } = await pool.query(allDataSql);
            // 限制数据量，防止 O(N^2) 过慢
            // 如果数据超过 3000 条，进行抽样或回退到 quantile
            let dataValues = allRows.map(r => Number(r.val) / 1000000);

            if (dataValues.length > 3000) {
                console.warn('[clcd] Too many points for Jenks, sampling 3000 points...');
                // 简单均匀抽样
                const step = Math.ceil(dataValues.length / 3000);
                dataValues = dataValues.filter((_, i) => i % step === 0);
            }

            if (dataValues.length <= numClasses) {
                breaks = dataValues; // 数据点太少，直接用
            } else {
                breaks = getJenksBreaks(dataValues, numClasses);
            }

        } else if (method === 'stddev') {
            // 标准差分级
            const mean = stats.avg;
            const std = stats.std;
            breaks = [
                stats.min,
                Math.max(stats.min, mean - 1.5 * std),
                Math.max(stats.min, mean - 0.5 * std),
                mean,
                Math.min(stats.max, mean + 0.5 * std),
                Math.min(stats.max, mean + 1.5 * std),
                stats.max
            ];
        } else {
            // 等间隔分级 (equal)
            const range = stats.max - stats.min;
            const step = range / numClasses;
            breaks = Array.from({ length: numClasses + 1 }, (_, i) => stats.min + step * i);
        }

        // 格式化为易读数值
        breaks = breaks.map(v => Math.round(v * 100) / 100);

        res.json({
            attribute: attr,
            field: fieldName,
            year: Number(year),
            method,
            classes: numClasses,
            breaks,
            stats,
            unit: 'km²'
        });
    } catch (err) {
        console.error('[clcd] Breaks API Error:', err);
        handleError(res, err);
    }
});

/**
 * 获取变化检测的分级断点 (年份B - 年份A)
 * 仅支持数值差值统计
 */
router.get('/breaks/diff', async (req, res) => {
    const { attr = 'cropland', year1, year2, unit = 'county', method = 'jenks', classes = 10 } = req.query;

    if (!year1 || !year2) {
        return res.status(400).json({ error: 'year1 and year2 are required for diff analysis' });
    }

    const tableName = unit === 'grid' ? 'spatial_grid_yunnan_stats' : 'spatial_county_yunnan_stats';

    try {
        // 1. 获取所有列名以辅助映射
        const { rows: cols } = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1
        `, [tableName]);
        const dbCols = cols.map(c => c.column_name);

        // 2. 映射字段名的辅助函数 (简化版，复用逻辑)
        const getFieldForYear = (targetYear) => {
            const attrPrefixMap = {
                cropland: 'cro', forest: 'for', shrub: 'shr', grassland: 'gra',
                water: 'wat', wetland: 'wet', impervious: 'imp', barren: 'bar', snow_ice: 'ice'
            };
            const prefix = attrPrefixMap[attr] || 'cro';

            // 策略1：标准映射 (假设年份和列是严格对应的，或者使用后缀匹配)
            // 简单匹配：prefix + '_sq_' + year的后3位 (适用于 1xx, 2xx)
            // 例如 1990 -> cro_sq_199? 不一定。
            // 之前的逻辑比较复杂，这里使用“最强匹配”：
            // 如果列名包含 year 的后3位，优先匹配
            const suffix = String(targetYear).slice(-3); // "022", "990"
            const match = dbCols.find(c => c.startsWith(`${prefix}_sq_`) && c.endsWith(suffix));
            if (match) return match;

            // 策略2：按顺序映射（如果第一步失败）
            // 需要先获取所有年份列表来确定 index... 比较繁琐。
            // 这里我们假设后缀匹配是有效的，因为 check_year_mapping.js 显示 2022 -> cro_sq_231 (BAD!)
            // 等等，check_year_mapping.js 显示:
            // 1990 -> cro_sq_199 (匹配 '199' 吗？ 1990 string slice(-3) is '990'. NO match!)
            // 1990 -> 数据库列 cro_sq_199.  
            // 2022 -> cro_sq_231.
            // 这种映射是 *索引偏移* (Offset) 的！

            // 必须重新获取年份列表来做索引映射
            return null;
        };

        // 重新获取年份列表以进行索引映射 (最稳妥)
        const yearSql = 'SELECT DISTINCT year FROM public.clcd_province ORDER BY year';
        const { rows: yearRows } = await pool.query(yearSql);
        const years = yearRows.map(r => r.year);

        const resolveField = (y) => {
            const yInt = Number(y);
            const idx = years.indexOf(yInt);
            if (idx === -1) return null;

            const attrPrefixMap = {
                cropland: 'cro', forest: 'for', shrub: 'shr', grassland: 'gra',
                water: 'wat', wetland: 'wet', impervious: 'imp', barren: 'bar', snow_ice: 'ice'
            };
            const prefix = attrPrefixMap[attr] || 'cro';

            // 过滤出该属性的所有列 (按字母/数字顺序排序?)
            // 注意：cro_sq_198, cro_sq_199... 需要按后缀数字排序
            const relevantCols = dbCols
                .filter(c => c.startsWith(`${prefix}_sq_`))
                .sort((a, b) => {
                    const numA = parseInt(a.split('_').pop());
                    const numB = parseInt(b.split('_').pop());
                    return numA - numB;
                });

            // 假设索引一致
            if (idx < relevantCols.length) return relevantCols[idx];
            return null;
        };

        const field1 = resolveField(year1);
        const field2 = resolveField(year2);

        if (!field1 || !field2) {
            return res.status(400).json({ error: `Cannot resolve fields for years ${year1} or ${year2}` });
        }

        // 3. 计算差值统计 (Diff = field2 - field1)
        // 使用 CTE 或直接查询
        const statsSql = `
            SELECT 
                min(${field2} - ${field1}) as min_val,
                max(${field2} - ${field1}) as max_val,
                avg(${field2} - ${field1}) as avg_val
            FROM public.${tableName}
            WHERE ${field1} IS NOT NULL AND ${field2} IS NOT NULL
        `;
        const { rows: [statsRow] } = await pool.query(statsSql);
        const stats = {
            min: Number(statsRow.min_val) / 1000000,
            max: Number(statsRow.max_val) / 1000000,
            avg: Number(statsRow.avg_val) / 1000000
        };

        // 4. 获取所有差值数据进行 Jenks/Quantile 分级
        const dataSql = `
            SELECT (${field2} - ${field1}) as val
            FROM public.${tableName}
            WHERE ${field1} IS NOT NULL AND ${field2} IS NOT NULL
            ORDER BY val ASC
        `;
        const { rows: allRows } = await pool.query(dataSql);
        let dataValues = allRows.map(r => Number(r.val) / 1000000);

        // 采样逻辑
        if (dataValues.length > 5000) {
            const step = Math.ceil(dataValues.length / 5000);
            dataValues = dataValues.filter((_, i) => i % step === 0);
        }

        let breaks = [];
        // 强制使用 Jenks 或等间距，因为差值分布可能很奇特（正态或双峰）
        // 或者是 'diverging' 逻辑？
        if (dataValues.length <= classes) {
            breaks = dataValues;
        } else {
            breaks = getJenksBreaks(dataValues, classes);
        }

        res.json({
            attribute: attr,
            year1: Number(year1),
            year2: Number(year2),
            field1,
            field2,
            breaks,
            stats,
            unit: 'km²'
        });

    } catch (err) {
        console.error('[clcd] Diff API Error:', err);
        handleError(res, err);
    }
});

function getJenksBreaks(data, n_classes) {
    if (n_classes > data.length) return data;

    data.sort((a, b) => a - b);

    const mat1 = [];
    const mat2 = [];
    const st = data.length + 1;
    const cl = n_classes + 1;

    for (let y = 0; y < cl; y++) {
        mat1[y] = [];
        mat2[y] = [];
        for (let x = 0; x < st; x++) {
            mat1[y][x] = 0;
            mat2[y][x] = 0;
        }
    }

    for (let x = 1; x < st; x++) {
        mat1[1][x] = 1;
        mat2[1][x] = 0;
        for (let y = 2; y < cl; y++) mat2[y][x] = Infinity;
    }

    let v = 0;
    for (let l = 2; l < st; l++) {
        let s1 = 0;
        let s2 = 0;
        let w = 0;
        for (let m = 1; m <= l; m++) {
            const i3 = l - m + 1;
            const val = data[i3 - 1];
            s2 += val * val;
            s1 += val;
            w++;
            v = s2 - (s1 * s1) / w;
            const i4 = i3 - 1;
            if (i4 !== 0) {
                for (let j = 2; j < cl; j++) {
                    if (mat2[j][l] >= (v + mat2[j - 1][i4])) {
                        mat1[j][l] = i3;
                        mat2[j][l] = v + mat2[j - 1][i4];
                    }
                }
            }
        }
        mat1[1][l] = 1;
        mat2[1][l] = v;
    }

    const kclass = [];
    let k = data.length;
    kclass[n_classes] = data[data.length - 1];
    kclass[0] = data[0];

    for (let countNum = n_classes; countNum >= 2; countNum--) {
        const id = parseInt(mat1[countNum][k], 10) - 2;
        if (id >= 0 && id < data.length) {
            kclass[countNum - 1] = data[id];
        } else {
            kclass[countNum - 1] = data[0]; // fallback
        }
        k = parseInt(mat1[countNum][k], 10) - 1;
    }

    // 确保结果单调递增并去重
    return [...new Set(kclass)].sort((a, b) => a - b);
}

export default router;
