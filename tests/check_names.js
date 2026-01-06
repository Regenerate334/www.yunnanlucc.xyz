import pool from './server/config/db.js';

async function checkNames() {
    try {
        const pref = await pool.query('SELECT DISTINCT region_name FROM public.clcd_prefecture LIMIT 5');
        console.log('Prefecture Names:', pref.rows.map(r => r.region_name));

        const county = await pool.query('SELECT DISTINCT region_name FROM public.clcd_county LIMIT 5');
        console.log('County Names:', county.rows.map(r => r.region_name));

        const boundary = await pool.query('SELECT DISTINCT "地级", "县级" FROM public.yunnan_country_level_city_boundaries WHERE "省级" = \'云南省\' LIMIT 5');
        console.log('Boundary Names:', boundary.rows);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkNames();
