/**
 * 空间数据路由
 * 端点：/spatial/county/:year, /spatial/grid/:year
 * 返回 GeoJSON 格式数据用于地图渲染
 */
import express from 'express';
import pool from '../../config/db.js';
import { handleError } from '../../middleware/logger.js';
import { getTableColumns } from './utils.js';
import { buildRateQueryFragments, buildSafeRateExpression, quoteIdentifier } from './rateHelper.js';


const router = express.Router();

// 获取县级空间数据（GeoJSON格式）
router.get('/county/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const colNames = await getTableColumns('spatial_county_yunnan_stats');
        console.log('[spatial] Columns in county table:', colNames.slice(0, 10));

        // 智能映射列名
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
            LEFT JOIN public.clcd_county c ON ${colNames.includes(nameCol) ? `TRIM(CAST(s.${nameCol} AS TEXT))` : `s.${nameCol}::text`} = TRIM(c.region_name) AND c.year = $1
            WHERE s.${geomCol} IS NOT NULL
        `;
        const { rows } = await pool.query(finalSql, [Number(year)]);

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

        res.json({ type: 'FeatureCollection', features });
    } catch (err) {
        console.error('[spatial] County API Error:', err);
        handleError(res, err);
    }
});

// 获取格网级空间数据（GeoJSON格式）
router.get('/grid/:year', async (req, res) => {
    const { year } = req.params;
    try {
        const colNames = await getTableColumns('spatial_grid_yunnan_stats');

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

        res.json({ type: 'FeatureCollection', features });
    } catch (err) {
        console.error('[spatial] Grid API Error:', err);
        handleError(res, err);
    }
});

// 获取垦殖率和转换率空间数据（GeoJSON格式）
router.get('/rates/:unit/:year', async (req, res) => {
    const { unit, year } = req.params;
    const targetYear = Number(year);

    if (!['county', 'grid'].includes(unit)) {
        return res.status(400).json({ error: 'unit must be county or grid' });
    }

    try {
        const fragments = await buildRateQueryFragments(unit, targetYear);
        const {
            spatialTable,
            transferTable,
            nameCol,
            geomCol,
            adcodeCol,
            conversionExpr,
            totalAreaExpr,
            clcdJoin,
            transferJoin,
            conversionPeriod
        } = fragments;

        const selectFields = [
            `s.${quoteIdentifier(nameCol)} as name`,
            unit === 'county' && adcodeCol ? `s.${quoteIdentifier(adcodeCol)} as adcode` : null,
            `ST_AsGeoJSON(s.${quoteIdentifier(geomCol)}) as geometry`,
            `${conversionExpr} as conversion_sum`,
            `${totalAreaExpr} as total_area`,
            fragments.landUseSelect
        ].filter(Boolean).join(', ');

        const finalSql = `
            SELECT ${selectFields}
            FROM public.${spatialTable} s
            ${fragments.hasStatsInSpatial ? '' : `LEFT JOIN public.clcd_county c ON ${clcdJoin}`}
            LEFT JOIN public.${transferTable} t ON ${transferJoin}
            WHERE s.${quoteIdentifier(geomCol)} IS NOT NULL
        `;

        const { rows } = await pool.query(finalSql, [targetYear]);
        const features = rows
            .map(row => {
                if (!row.geometry) return null;
                let geometry;
                try {
                    geometry = JSON.parse(row.geometry);
                } catch (e) {
                    console.warn('[spatial] Malformed geometry', e);
                    return null;
                }

                const totalArea = Number(row.total_area) || 0;
                const cropland = Number(row.cropland) || 0;
                const conversionSum = Number(row.conversion_sum) || 0;
                const reclamationRate = totalArea ? cropland / totalArea : 0;
                const conversionRate = totalArea ? conversionSum / totalArea : 0;

                return {
                    type: 'Feature',
                    geometry,
                    properties: {
                        name: row.name,
                        adcode: row.adcode,
                        total_area: totalArea,
                        cropland,
                        reclamation_rate: reclamationRate,
                        conversion_rate: conversionRate,
                        period: conversionPeriod
                    }
                };
            })
            .filter(Boolean);

        res.json({ type: 'FeatureCollection', features });
    } catch (err) {
        console.error('[spatial] Rates API Error:', err);
        handleError(res, err);
    }
});

export default router;
