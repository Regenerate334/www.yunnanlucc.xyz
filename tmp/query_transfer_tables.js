
import pool from '../server/config/db.js';

async function main() {
    const { rows } = await pool.query(`
    SELECT t.table_name, c.column_name, c.data_type
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name
    WHERE t.table_schema = 'public' 
      AND t.table_name LIKE '%transfer%'
    ORDER BY t.table_name, c.ordinal_position;
  `);

    const tables = {};
    rows.forEach(r => {
        if (!tables[r.table_name]) tables[r.table_name] = [];
        tables[r.table_name].push(`${r.column_name} (${r.data_type})`);
    });

    console.log(JSON.stringify(tables, null, 2));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
