import pool from '../server/config/db.js';

async function describeTable(tableName) {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position;
        `, [tableName]);
        console.log(`Table: ${tableName}`);
        console.log(res.rows.map(r => r.column_name));
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    await describeTable('spatial_county_yunnan_stats');
    await describeTable('spatial_county_yunnan_transfer');
    await describeTable('spatial_grid_yunnan_stats');
    await pool.end();
}

main();
