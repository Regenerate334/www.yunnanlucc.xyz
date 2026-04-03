import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 指向 server 目录下的 .env 文件
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkDatabaseSize() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_DATABASE || 'yunnan_CLCD',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 5432,
    });

    try {
        await client.connect();

        // 1. 查询总大小
        const dbSizeRes = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size;`);
        console.log(`\n📦 数据库 [${process.env.DB_DATABASE || 'yunnan_CLCD'}] 总大小: \x1b[32m${dbSizeRes.rows[0].size}\x1b[0m`);

        // 2. 查询前 10 张大表及其行数
        const topTablesRes = await client.query(`
      SELECT 
        u.relname AS table_name, 
        pg_size_pretty(pg_total_relation_size(u.relid)) AS total_size,
        s.n_live_tup AS row_count
      FROM pg_catalog.pg_statio_user_tables u
      JOIN pg_stat_user_tables s ON u.relid = s.relid
      ORDER BY pg_total_relation_size(u.relid) DESC 
      LIMIT 10;
    `);

        console.log(`\n前 10 大表详情:`);
        console.table(topTablesRes.rows);

    } catch (err) {
        console.error('连接数据库或查询失败:', err.message);
    } finally {
        await client.end();
    }
}

checkDatabaseSize();
