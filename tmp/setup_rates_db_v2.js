import pool from '../server/config/db.js';

async function setupTables() {
    try {
        console.log('[db] Starting Final Database Setup...');

        // 1. Create County Rates Table
        console.log('[db] Creating spatial_rates_county...');
        await pool.query(`
            DROP TABLE IF EXISTS public.spatial_rates_county;
            CREATE TABLE public.spatial_rates_county AS
            SELECT 
                s."地名" as name,
                s."区划码" as adcode,
                s.geom,
                c.year,
                (c.cropland / NULLIF((c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland), 0)) as reclamation_rate,
                (t._transfer_sum / NULLIF((c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland), 0)) as conversion_rate
            FROM public.spatial_county_yunnan_stats s
            JOIN public.clcd_county c ON TRIM(CAST(s."地名" AS TEXT)) = TRIM(c.region_name)
            LEFT JOIN public.spatial_county_yunnan_transfer t ON TRIM(CAST(s."地名" AS TEXT)) = TRIM(t."地名");
        `);

        // 2. Create Grid Rates Table
        console.log('[db] Creating spatial_rates_grid...');
        await pool.query(`
            DROP TABLE IF EXISTS public.spatial_rates_grid;
            CREATE TABLE public.spatial_rates_grid AS
            SELECT 
                s.gid as id,
                s.geom,
                c.year,
                (c.cropland / NULLIF((c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland), 0)) as reclamation_rate,
                (t._transfer_sum / NULLIF((c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland), 0)) as conversion_rate
            FROM public.spatial_grid_yunnan_stats s
            JOIN public.clcd_county c ON s.gid::text = c.region_name
            LEFT JOIN public.spatial_grid_yunnan_transfer t ON s.gid::text = t.gid::text;
        `);

        console.log('[db] Database Setup Completed Successfully.');
    } catch (err) {
        console.error('[db] Error setting up tables:', err);
    } finally {
        await pool.end();
    }
}

setupTables();
