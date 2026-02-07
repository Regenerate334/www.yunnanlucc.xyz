const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'yunnan_CLCD',
    user: 'postgres',
    password: 'password'
});

async function check1985Columns() {
    // Check for any columns containing "985" or "185"
    const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='spatial_grid_yunnan_stats' 
        AND (column_name LIKE '%985%' OR column_name LIKE '%185%')
        ORDER BY column_name
    `);

    console.log('=== Columns with 985/185 in name ===');
    console.log(result.rows);

    // Also check all column headers
    const allCols = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='spatial_grid_yunnan_stats'
        ORDER BY column_name
        LIMIT 20
    `);

    console.log('\n=== First 20 columns ===');
    allCols.rows.forEach((r, i) => console.log(`  [${i}] ${r.column_name}`));

    await pool.end();
}

check1985Columns().catch(console.error);
