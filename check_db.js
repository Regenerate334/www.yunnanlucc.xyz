import pool from './server/config/db.js';

async function checkData() {
    try {
        const { rows } = await pool.query('SELECT * FROM public.clcd_province WHERE year = 2023');
        console.log(JSON.stringify(rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
