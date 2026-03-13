
import pool from '../server/config/db.js';

async function main() {
    const { rows } = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'spatial_county_yunnan_transfer'
    LIMIT 50;
  `);
    console.log(rows);
    process.exit(0);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
