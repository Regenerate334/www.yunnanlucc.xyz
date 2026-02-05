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

async function listTables() {
    try {
        const sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
        const { rows } = await pool.query(sql);
        console.log('All public tables:');
        rows.forEach(r => console.log(`- ${r.table_name}`));

        // 如果有 spatial_county_yunnan_stats (不管大小写)，尝试匹配
        const target = rows.find(r => r.table_name.toLowerCase().includes('spatial') && r.table_name.toLowerCase().includes('county'));
        if (target) {
            console.log(`\nFound potential target: ${target.table_name}`);
            await analyzeTable(target.table_name);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

async function analyzeTable(tableName) {
    // 查找列
    const colsSql = `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name LIKE 'cro_sq_%' ORDER BY column_name LIMIT 1`;
    const { rows: cols } = await pool.query(colsSql, [tableName]);
    const field = cols[0]?.column_name;

    if (!field) {
        console.log('No cropland field found.');
        return;
    }
    console.log(`Analyzing field: ${field}`);

    // 宣威 vs 隆阳
    const checkSql = `SELECT "地名", ${field} / 1000000 as area_km2 FROM public."${tableName}" WHERE "地名" LIKE '%宣威%' OR "地名" LIKE '%隆阳%'`;
    const { rows: check } = await pool.query(checkSql);
    console.log('Region values:', check);

    // 断点
    const sql = `
      SELECT 
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p50,
        percentile_cont(0.625) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p62,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p75,
        percentile_cont(0.875) WITHIN GROUP (ORDER BY ${field}) / 1000000 as p87,
        MAX(${field}) / 1000000 as max_val
      FROM public."${tableName}"
    `;
    const { rows: stats } = await pool.query(sql);
    console.log('Stats:', stats[0]);
}

listTables();
