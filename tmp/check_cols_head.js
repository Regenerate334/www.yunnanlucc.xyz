import pool from '../server/config/db.js';

async function main() {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_stats'
            ORDER BY ordinal_position
            LIMIT 50;
        `);
        console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

main();
