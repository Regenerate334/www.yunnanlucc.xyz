/**
 * ================================================================================
 * @File    :   sys_db_status_check.js
 * @Desc    :   数据库状态健康监测工具。检查 PostgreSQL/PostGIS 中业务核心表的连接
 *              情况、数据量统计以及 clcd_province 表中可用的年份列表。
 * @Usage   :   node ops/sys/sys_db_status_check.js
 * @Deps    :   pg, dotenv
 * ================================================================================
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
};

const pool = new pg.Pool(config);

async function check() {
    const tables = [
        'public.yunnan_country_level_city_boundaries',
        'public.clcd_province',
        'public.clcd_prefecture',
        'public.clcd_county',
        'public.spatial_county_yunnan_transfer'
    ];

    console.log(`Checking database: ${config.database} on ${config.host}`);

    for (const table of tables) {
        try {
            const { rows } = await pool.query(`SELECT count(*) FROM ${table}`);
            console.log(`Table ${table}: EXISTS, Count: ${rows[0].count}`);
        } catch (err) {
            console.log(`Table ${table}: ERROR - ${err.message}`);
        }
    }

    // Also check available years as it's a common dependency
    try {
        const { rows } = await pool.query('SELECT DISTINCT year FROM clcd_province ORDER BY year');
        console.log(`Available years in clcd_province: ${rows.map(r => r.year).join(', ')}`);
    } catch (err) {
        console.log(`Failed to get years: ${err.message}`);
    }

    await pool.end();
}

check();
