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

async function checkYears() {
    try {
        // 1. 获取业务逻辑中记录的所有年份
        const yearSql = 'SELECT DISTINCT year FROM public.clcd_province ORDER BY year';
        const { rows: yearRows } = await pool.query(yearSql);
        const years = yearRows.map(r => r.year);
        console.log('Available data years:', years);

        // 2. 获取格网表的所有列名
        const colSql = `SELECT column_name FROM information_schema.columns WHERE table_name = 'spatial_grid_yunnan_stats' AND column_name LIKE 'cro_sq_%' ORDER BY column_name`;
        const { rows: colRows } = await pool.query(colSql);
        const cols = colRows.map(r => r.column_name);
        console.log('Available columns:', cols);

        console.log('\n--- Mapping Hypothesis ---');
        // 尝试对齐
        // 假设年份数量和列数量一致，且顺序一致
        if (years.length === cols.length) {
            console.log('Count matches! Likely sequential mapping:');
            years.forEach((y, i) => {
                console.log(`${y} -> ${cols[i]}`);
            });
        } else {
            console.log(`Count mismatch: Years=${years.length}, Cols=${cols.length}`);
            // 打印首尾尝试寻找规律
            console.log(`First Year: ${years[0]}, First Col: ${cols[0]}`);
            console.log(`Last Year: ${years[years.length - 1]}, Last Col: ${cols[cols.length - 1]}`);
        }

    } catch (e) { console.error(e); }
    finally { process.exit(); }
}
checkYears();
