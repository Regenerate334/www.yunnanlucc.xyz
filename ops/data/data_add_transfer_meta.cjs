/**
 * ================================================================================
 * @File    :   data_add_transfer_meta.cjs
 * @Desc    :   为县级和格网空间统计表批量添加土地利用变化量字段（_chg_XXYY），
 *              并基于不同时间跨度（1985-2023, 2000-2023, 2010-2023）预计算差值。
 * @Usage   :   node ops/data/data_add_transfer_meta.cjs
 * @Deps    :   pg, dotenv
 * ================================================================================
 */

require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_DATABASE) {
    console.error('ERROR: Database configuration missing in .env');
    process.exit(1);
}

// 9种地类前缀
const landTypes = ['cro', 'for', 'shr', 'gra', 'wat', 'ice', 'bar', 'imp', 'wet'];

// 年份对配置 (起始年份后缀, 结束年份后缀, 字段后缀)
const yearPairs = [
    { from: '198', to: '231', suffix: '8523' },  // 1985→2023
    { from: '200', to: '231', suffix: '0023' },  // 2000→2023
    { from: '201', to: '231', suffix: '1023' },  // 2010→2023
];

async function addTransferFields() {
    const client = await pool.connect();

    try {
        console.log('=== 开始添加土地利用变化字段 ===\n');

        for (const table of ['spatial_county_yunnan_stats', 'spatial_grid_yunnan_stats']) {
            console.log(`[TABLE] 处理表: ${table}`);

            // 1. 添加变化量字段
            for (const yearPair of yearPairs) {
                for (const landType of landTypes) {
                    const fieldName = `${landType}_chg_${yearPair.suffix}`;

                    const addColSQL = `
                        ALTER TABLE public.${table}
                        ADD COLUMN IF NOT EXISTS ${fieldName} NUMERIC;
                    `;

                    try {
                        await client.query(addColSQL);
                        console.log(`  [OK] 添加字段: ${fieldName}`);
                    } catch (err) {
                        if (err.code === '42701') {
                            console.log(`  ⏭️ 字段已存在: ${fieldName}`);
                        } else {
                            throw err;
                        }
                    }
                }
            }

            // 2. 计算并填充变化量 (Year2 - Year1)
            console.log(`\n[CALC] 计算变化量数据...`);

            for (const yearPair of yearPairs) {
                const updates = landTypes.map(lt =>
                    `${lt}_chg_${yearPair.suffix} = ${lt}_sq_${yearPair.to} - ${lt}_sq_${yearPair.from}`
                ).join(',\n    ');

                const updateSQL = `
                    UPDATE public.${table}
                    SET ${updates};
                `;

                try {
                    const result = await client.query(updateSQL);
                    console.log(`  [OK] 更新 ${yearPair.suffix} 变化量: ${result.rowCount} 行`);
                } catch (err) {
                    console.error(`  [ERROR] 更新失败 ${yearPair.suffix}:`, err.message);
                }
            }
        }

        // 3. 验证结果
        console.log('\n=== 验证结果 ===\n');

        const verifySql = `
            SELECT 地名, 
                   cro_chg_8523 / 1000000 as "耕地变化(km²)",
                   for_chg_8523 / 1000000 as "林地变化(km²)",
                   imp_chg_8523 / 1000000 as "建设用地变化(km²)"
            FROM public.spatial_county_yunnan_stats
            WHERE 地名 IS NOT NULL
            ORDER BY imp_chg_8523 DESC
            LIMIT 10;
        `;

        const { rows } = await client.query(verifySql);
        console.log('建设用地增长 TOP10 县市:');
        console.table(rows);

        console.log('\n[DONE] 所有字段添加和数据填充完成!');

    } catch (err) {
        console.error('[ERROR] 执行失败:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

addTransferFields();
