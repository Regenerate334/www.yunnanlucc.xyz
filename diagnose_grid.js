import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function check() {
    try {
        console.log('--- Columns starting with cro_sq_ ---');
        const colSql = `SELECT column_name FROM information_schema.columns WHERE table_name = 'spatial_grid_yunnan_stats' AND column_name LIKE 'cro_sq_%' ORDER BY column_name`;
        const { rows: cols } = await pool.query(colSql);
        const colNames = cols.map(r => r.column_name);
        console.log(colNames);

        if (colNames.length > 0) {
            const col = colNames[0]; // Pick the first one, e.g., 1985 or 1990
            console.log(`\n--- Stats for column ${col} ---`);
            const statsSql = `SELECT min(${col}), max(${col}), avg(${col}) FROM spatial_grid_yunnan_stats`;
            const { rows: stats } = await pool.query(statsSql);
            console.log(stats[0]);

            console.log(`\n--- First 5 rows for ${col} ---`);
            const dataSql = `SELECT ${col} FROM spatial_grid_yunnan_stats LIMIT 5`;
            const { rows: data } = await pool.query(dataSql);
            console.log(data);
        } else {
            console.log('No cropland columns found!');
            // Check table existence
            const tblSql = `SELECT count(*) FROM information_schema.tables WHERE table_name = 'spatial_grid_yunnan_stats'`;
            const { rows: tbl } = await pool.query(tblSql);
            console.log('Table exists:', tbl[0]);
        }

    } catch (e) { console.error(e); }
    finally { await pool.end(); }
}
check();
