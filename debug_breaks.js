import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

async function debug() {
    try {
        // 1. 查找所有包含 yunnan 的表
        const tablesSql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%yunnan%'`;
        const { rows: tables } = await pool.query(tablesSql);
        console.log('Tables containing "yunnan":');
        console.log(tables.map(t => t.table_name));

        // 2. 假设第一个表是县级统计表
        let table = tables.find(t => t.table_name.includes('county'))?.table_name;
        if (!table) table = tables[0]?.table_name;

        if (!table) {
            console.log('No suitable table found.');
            process.exit(1);
        }
        console.log(`Using table: ${table}`);

        // 3. 查找包含 cro_sq 的列
        const colsSql = `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name LIKE 'cro_sq_%' ORDER BY column_name LIMIT 5`;
        const { rows: cols } = await pool.query(colsSql, [table]);
        console.log('\nColumns with cro_sq_:');
        console.log(cols.map(c => c.column_name));

        const field = cols[0]?.column_name || 'cro_sq_199';
        console.log(`Using field: ${field}`);

        // 4. 查看数据分布 (KM2)
        const sql = `
      SELECT 
        MIN(${field}) / 1000000 as min_km2,
        MAX(${field}) / 1000000 as max_km2,
        percentile_cont(0.125) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p12,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p25,
        percentile_cont(0.375) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p37,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p50,
        percentile_cont(0.625) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p62,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p75,
        percentile_cont(0.875) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p87
      FROM public."${table}"
    `;

        const { rows } = await pool.query(sql);
        console.log('\nQuantile breaks (km2):');
        console.log(rows[0]);

        // 5. 检查宣威市和隆阳区的值
        const checkSql = `SELECT "地名", ${field} / 1000000 as area_km2 FROM public."${table}" WHERE "地名" LIKE '%宣威%' OR "地名" LIKE '%隆阳%'`;
        const { rows: check } = await pool.query(checkSql);
        console.log('\nTarget regions:');
        console.log(check);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

debug();
