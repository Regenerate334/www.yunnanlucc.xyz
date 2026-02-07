const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'webgis_db',
    password: 'root',
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
            console.log('No columns found (Table might not exist?)');
        } else {
            // Filter for likely relevant columns to keep output short
            const relevant = res.rows.map(r => r.column_name).filter(c =>
                c.startsWith('cro') || c.startsWith('for') || c.startsWith('name') || c.includes('1990')
            );
            console.log(relevant.join(', '));
            console.log(`Total columns: ${res.rows.length}`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

async function main() {
    await checkColumns('spatial_county_yunnan_stats');
    await checkColumns('spatial_grid_yunnan_stats');
    pool.end();
}

main();
