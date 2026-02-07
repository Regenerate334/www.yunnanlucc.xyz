const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'yunnan_CLCD',
    password: 'password',
    port: 5432,
});

async function checkColumns(tableName) {
    console.log(`\n--- Columns for ${tableName} ---`);
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = $1
            ORDER BY column_name
        `, [tableName]);

        if (res.rows.length === 0) {
            console.log('No columns found');
        } else {
            const relevant = res.rows.map(r => r.column_name).filter(c => c.startsWith('cro_sq_'));
            console.log(JSON.stringify(relevant, null, 2));
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

async function checkYears() {
    console.log(`\n--- Available Years (clcd_province) ---`);
    try {
        const res = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
        console.log(res.rows.map(r => r.year).join(', '));
    } catch (err) { console.error(err.message); }
}

async function main() {
    await checkYears();
    await checkColumns('spatial_county_yunnan_stats');
    // await checkColumns('spatial_grid_yunnan_stats'); // Skip grid for now to reduce noise
    pool.end();
}

main();
