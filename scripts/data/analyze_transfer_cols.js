/**
 * 精确分析转移矩阵字段的命名规则
 */
import pool from '../config/db.js';

async function analyze(tableName) {
    const res = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name ~ '^y[0-9]'
        ORDER BY column_name;
    `, [tableName]);

    const cols = res.rows.map(r => r.column_name);

    console.log(`\n=== ${tableName} ===`);
    console.log('Total data cols:', cols.length);

    // Print ALL data cols grouped by period
    const byPeriod = {};
    cols.forEach(c => {
        const parts = c.match(/^(y\w+?)_(\d+)$/);
        if (parts) {
            const period = parts[1];
            const suffix = parts[2];
            if (!byPeriod[period]) byPeriod[period] = [];
            byPeriod[period].push(suffix);
        }
    });

    const periods = Object.keys(byPeriod).sort();
    console.log('\nAll periods:', periods.join(', '));

    // Show all suffixes for first period (to understand encoding)
    const firstPeriod = periods[0];
    if (firstPeriod) {
        console.log(`\nAll suffixes for period "${firstPeriod}" (${byPeriod[firstPeriod].length} total):`);
        console.log(byPeriod[firstPeriod].sort((a, b) => Number(a) - Number(b)).join(', '));
    }

    // Non-data columns
    const nonData = await pool.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name !~ '^y[0-9]'
        ORDER BY ordinal_position;
    `, [tableName]);
    console.log('\nNon-data columns:');
    console.table(nonData.rows);
}

async function main() {
    try {
        await analyze('spatial_county_yunnan_transfer');
        await analyze('spatial_grid_yunnan_transfer');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
