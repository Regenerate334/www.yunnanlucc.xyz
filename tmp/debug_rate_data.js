import pool from '../server/config/db.js';

async function checkData() {
    try {
        console.log('Checking spatial_rates_county...');
        const resCounty = await pool.query('SELECT year, count(*) FROM public.spatial_rates_county GROUP BY year ORDER BY year');
        console.log('County stats:', resCounty.rows);

        console.log('Checking spatial_rates_grid...');
        const resGrid = await pool.query('SELECT year, count(*) FROM public.spatial_rates_grid GROUP BY year ORDER BY year');
        console.log('Grid stats:', resGrid.rows);

        if (resCounty.rows.length > 0) {
            const sample = await pool.query('SELECT * FROM public.spatial_rates_county LIMIT 1');
            console.log('Sample row (County):', sample.rows[0]);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkData();
