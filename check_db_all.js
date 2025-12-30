import pool from './server/config/db.js';

async function checkData() {
    try {
        const { rows } = await pool.query("SELECT year, land_use_type, area FROM public.clcd_province WHERE land_use_type = 'cropland' ORDER BY year DESC");
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
