const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'yunnan_CLCD',
    user: 'postgres',
    password: 'password'
});

async function checkAllColumns() {
    const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='spatial_grid_yunnan_stats'
        ORDER BY column_name
    `);

    console.log(`Total columns: ${result.rows.length}`);
    result.rows.forEach(r => console.log(r.column_name));
    await pool.end();
}

checkAllColumns().catch(console.error);
