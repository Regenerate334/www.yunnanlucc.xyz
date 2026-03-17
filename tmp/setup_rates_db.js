import pool from '../server/config/db.js';

async function setupTables() {
    try {
        console.log('[db] Starting Database Setup...');

        // 1. Create County Rates Table
        // Definition: 
        // Reclamation Rate = Cropland Area (from clcd_county) / Total Land Area (approx by summing all classes)
        // Conversion Rate = Total pixels changed / Total pixels

        console.log('[db] Creating spatial_rates_county...');
        await pool.query(`
            DROP TABLE IF EXISTS public.spatial_rates_county;
            CREATE TABLE public.spatial_rates_county AS
            SELECT 
                s.name,
                s.adcode,
                s.geom,
                c.year,
                (c.cropland / (c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland)) as reclamation_rate,
                (t._transfer_sum / (c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland)) as conversion_rate
            FROM public.spatial_county_yunnan_stats s
            JOIN public.clcd_county c ON TRIM(CAST(s.name AS TEXT)) = TRIM(c.region_name)
            LEFT JOIN public.spatial_county_yunnan_transfer t ON TRIM(CAST(s.name AS TEXT)) = TRIM(t.name);
        `);

        // 2. Create Grid Rates Table
        console.log('[db] Creating spatial_rates_grid...');
        await pool.query(`
            DROP TABLE IF EXISTS public.spatial_rates_grid;
            CREATE TABLE public.spatial_rates_grid AS
            SELECT 
                s.id,
                s.geom,
                c.year,
                (c.cropland / NULLIF((c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland), 0)) as reclamation_rate,
                (t._transfer_sum / NULLIF((c.cropland + c.forest + c.shrub + c.grassland + c.water + c.snow_ice + c.barren + c.impervious + c.wetland), 0)) as conversion_rate
            FROM public.spatial_grid_yunnan_stats s
            JOIN public.clcd_county c ON s.id::text = c.region_name
            LEFT JOIN public.spatial_grid_yunnan_transfer t ON s.id::text = t.id::text;
        `);

        console.log('[db] Database Setup Completed Successfully.');
    } catch (err) {
        console.error('[db] Error setting up tables:', err);
    } finally {
        await pool.end();
    }
}

setupTables();
