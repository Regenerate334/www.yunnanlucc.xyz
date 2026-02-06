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
        const sql = `SELECT column_name FROM information_schema.columns WHERE table_name = 'spatial_grid_yunnan_stats' AND column_name LIKE 'imp_sq_%' ORDER BY column_name`;
        const { rows } = await pool.query(sql);
        console.log(rows.map(r => r.column_name));
    } catch (e) { console.error(e); }
    finally { process.exit(); }
}
check();
