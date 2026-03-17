# This script rebuilds the per-year spatial layer that only stores reclamation/conversion rates.
# It mimics a shapefile-derived PostGIS layer so the frontend can treat it like other spatial tables.

import pool from '../../server/config/db.js';
import { buildRateQueryFragments, buildSafeRateExpression, quoteIdentifier } from '../../server/routes/clcd/rateHelper.js';

const UNIT_TABLE_MAP = {
    county: 'spatial_rate_layer_county',
    grid: 'spatial_rate_layer_grid'
};

async function fetchYears() {
    const { rows } = await pool.query('SELECT DISTINCT year FROM public.clcd_county ORDER BY year');
    return rows.map(row => row.year).filter((y) => y !== null);
}

function buildCreateSql(tableName, geomType, srid) {
    return `
        DROP TABLE IF EXISTS public."${tableName}";
        CREATE TABLE public."${tableName}" (
            id SERIAL PRIMARY KEY,
            name TEXT,
            adcode TEXT,
            year INTEGER,
            period TEXT,
            total_area DOUBLE PRECISION,
            cropland DOUBLE PRECISION,
            conversion_sum DOUBLE PRECISION,
            reclamation_rate DOUBLE PRECISION,
            conversion_rate DOUBLE PRECISION,
            geom geometry(${geomType}, ${srid})
        );
        CREATE INDEX ON public."${tableName}" (year);
        CREATE INDEX ON public."${tableName}" USING GIST (geom);
    `;
}

async function inspectGeometry(tableName, geomCol) {
    const sql = `
        SELECT GeometryType(${quoteIdentifier(geomCol)}) AS geom_type,
               ST_SRID(${quoteIdentifier(geomCol)}) AS srid
        FROM public."${tableName}"
        WHERE ${quoteIdentifier(geomCol)} IS NOT NULL
        LIMIT 1
    `;
    const { rows } = await pool.query(sql);
    const row = rows[0] || {};
    return {
        geomType: (row.geom_type || 'MULTIPOLYGON').toUpperCase(),
        srid: row.srid || 4326
    };
}

async function rebuildUnit(unit, years) {
    const tableName = UNIT_TABLE_MAP[unit];
    if (!tableName) {
        throw new Error(`Unknown unit: ${unit}`);
    }

    const sampleYear = years[0];
    if (!sampleYear) {
        console.warn(`[sync_rate_layers] 跳过 ${unit} (没有年份数据)`);
        return;
    }

    console.log(`[sync_rate_layers] 准备 ${unit} (${tableName})`);
    const sampleFragments = await buildRateQueryFragments(unit, sampleYear);
    const { spatialTable, geomCol } = sampleFragments;
    const { geomType, srid } = await inspectGeometry(spatialTable, geomCol);

    await pool.query(buildCreateSql(tableName, geomType, srid));

    for (const year of years) {
        console.log(`[sync_rate_layers] 插入 ${unit} ${year}`);
        const fragments = await buildRateQueryFragments(unit, year);
        const {
            spatialTable: spatialTbl,
            transferTable,
            nameCol,
            geomCol: baseGeomCol,
            adcodeCol,
            conversionExpr,
            totalAreaExpr,
            clcdJoin,
            transferJoin,
            conversionPeriod
        } = fragments;

        const reclamationExpr = buildSafeRateExpression('COALESCE(c.cropland, 0)', totalAreaExpr);
        const conversionRateExpr = buildSafeRateExpression(conversionExpr, totalAreaExpr);
        const periodExpr = conversionPeriod ? `'${conversionPeriod}'` : 'NULL';
        const adcodeExpr = adcodeCol ? `s.${quoteIdentifier(adcodeCol)}::text` : 'NULL';

        const insertSql = `
            INSERT INTO public."${tableName}" (
                name, adcode, year, period, total_area,
                cropland, conversion_sum, reclamation_rate, conversion_rate, geom
            )
            SELECT 
                COALESCE(s.${quoteIdentifier(nameCol)}::text, '') AS name,
                ${adcodeExpr}                    AS adcode,
                $1                               AS year,
                ${periodExpr}                    AS period,
                (${totalAreaExpr})               AS total_area,
                COALESCE(c.cropland, 0)          AS cropland,
                (${conversionExpr})              AS conversion_sum,
                ${reclamationExpr}               AS reclamation_rate,
                ${conversionRateExpr}            AS conversion_rate,
                s.${quoteIdentifier(baseGeomCol)} AS geom
            FROM public.${quoteIdentifier(spatialTbl)} s
            JOIN public.clcd_county c ON ${clcdJoin}
            LEFT JOIN public.${quoteIdentifier(transferTable)} t ON ${transferJoin}
            WHERE s.${quoteIdentifier(baseGeomCol)} IS NOT NULL
              AND (${totalAreaExpr}) > 0
        `;

        await pool.query(insertSql, [year]);
    }
}

async function main() {
    try {
        const years = await fetchYears();
        if (!years.length) {
            console.warn('[sync_rate_layers] 找不到任何年份数据，已退出');
            return;
        }

        await rebuildUnit('county', years);
        await rebuildUnit('grid', years);

        console.log('[sync_rate_layers] 垦殖/转换率层同步完成');
    } catch (err) {
        console.error('[sync_rate_layers] 失败:', err);
        throw err;
    } finally {
        await pool.end();
    }
}

main().catch(() => process.exit(1));
