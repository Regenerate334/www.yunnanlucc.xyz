import pool from '../server/config/db.js';

async function describeTable(tableName) {
    try {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1
            ORDER BY ordinal_position;
        `, [tableName]);
        console.log(`Table: ${tableName}`);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    await describeTable('spatial_county_yunnan_transfer');
    await describeTable('spatial_grid_yunnan_transfer');
    await pool.end();
}

main();
