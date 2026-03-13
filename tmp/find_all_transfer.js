
import pool from '../server/config/db.js';

async function main() {
    const { rows } = await pool.query(`
    SELECT n.nspname as schema, c.relname as name,
      CASE c.relkind WHEN 'r' THEN 'table' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' END as type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm')
      AND c.relname LIKE '%transfer%'
    ORDER BY c.relname;
  `);

    console.log(rows);
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
