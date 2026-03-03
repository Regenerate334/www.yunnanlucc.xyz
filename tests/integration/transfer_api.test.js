/**
 * 快速测试 transfer-flow API 端点
 */
import pool from '../config/db.js';
import { getAvailablePeriods, findOverlappingPeriods, buildColumnNames } from '../utils/period_encoder.js';

async function test() {
    try {
        const tableName = 'spatial_county_yunnan_transfer';

        console.log('\n=== 测试 period_encoder ===');
        const allPeriods = await getAvailablePeriods(pool, tableName);
        console.log('All available periods:', allPeriods.join(', '));

        const active = findOverlappingPeriods(allPeriods, 1985, 2000);
        console.log('\nPeriods covering 1985-2000:', active.join(', '));

        const cols = buildColumnNames(active, 2, 7);
        console.log('Column names (fromClass=2, toClass=7):', cols.join(', '));

        // 检查字段是否存在
        const existRes = await pool.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            AND column_name = ANY($2::text[]);
        `, [tableName, cols]);
        console.log('\nExisting cols:', existRes.rows.map(r => r.column_name).join(', '));

        // 执行实际查询（只取前5行验证）
        if (existRes.rows.length > 0) {
            const existingCols = existRes.rows.map(r => r.column_name);
            const sumExpr = existingCols.map(c => `COALESCE("${c}", 0)`).join(' + ');
            const sql = `
                SELECT gid, "地名" AS name, (${sumExpr}) AS transfer_area
                FROM public."${tableName}"
                WHERE (${sumExpr}) > 0
                LIMIT 5;
            `;
            const result = await pool.query(sql);
            console.log('\n\nSample results (top 5):');
            console.table(result.rows);
        } else {
            console.log('\nNO matching columns found! fromClass=2,toClass=7 columns may not exist.');
            // Try to check what class suffixes exist
            const checkCols = await pool.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1
                AND column_name ~ '^y8590_'
                ORDER BY column_name LIMIT 20;
            `, [tableName]);
            console.log('y8590_* columns available:', checkCols.rows.map(r => r.column_name).join(', '));
        }

    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
    }
}

test();
