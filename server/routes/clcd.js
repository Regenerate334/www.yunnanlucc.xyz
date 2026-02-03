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

export default router;
