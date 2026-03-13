
import pool from '../server/config/db.js';

async function main() {
    const { rows } = await pool.query(`
    SELECT DISTINCT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_name LIKE 'clcd_%'
    ORDER BY table_name;
  `);

    console.log(rows.map(r => r.table_name));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
