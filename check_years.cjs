const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'yunnan_CLCD',
    user: 'postgres',
    password: 'password'
});

async function checkYears() {
    const result = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
    console.log('Years in clcd_province:', result.rows.map(r => r.year));
    await pool.end();
}

checkYears().catch(console.error);
