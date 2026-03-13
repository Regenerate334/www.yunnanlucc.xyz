
import pool from '../server/config/db.js';

async function main() {
    const { rows } = await pool.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'spatial_county_yunnan_transfer' 
      AND column_name LIKE 'y8590%' 
    LIMIT 20
  `);
    console.log(rows);
    process.exit(0);
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
