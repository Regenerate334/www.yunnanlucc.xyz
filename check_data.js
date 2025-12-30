import pool from './server/config/db.js';

async function checkData() {
    try {
        const res = await pool.query('SELECT DISTINCT "省级", "地级", "县级" FROM public.yunnan_country_level_city_boundaries LIMIT 20');
        console.log('Sample Data:', res.rows);

        const count = await pool.query('SELECT COUNT(*) FROM public.yunnan_country_level_city_boundaries WHERE "省级" != \'云南省\'');
        console.log('Non-Yunnan count:', count.rows[0].count);

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkData();
