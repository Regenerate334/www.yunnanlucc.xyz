/**
 * 临时脚本：输出两张转移矩阵空间表的完整字段列表，用于设计 SQL View
 */
import pool from '../config/db.js';

async function getSchema(tableName) {
    const res = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
    `, [tableName]);

    const cols = res.rows.map(r => r.column_name);
    const dataCols = cols.filter(c => /^y\d{4,6}_\d+$/.test(c));
    const periods = [...new Set(dataCols.map(c => c.split('_')[0]))].sort();
    const sample = dataCols.slice(0, 10);

    console.log(`\n=== ${tableName} ===`);
    console.log('All columns (non-data):', cols.filter(c => !/^y\d{4,6}_\d+$/.test(c)).join(', '));
    console.log('Data column count:', dataCols.length);
    console.log('Periods:', periods.join(', '));
    console.log('Sample data cols:', sample.join(', '));
    // Print a full list of unique period+class combos 
    console.log('\nFull period list (10 rows sample):');
    const cnt = await pool.query(`SELECT count(*) FROM public."${tableName}"`);
    console.log('Row count:', cnt.rows[0].count);

    // Sample data row
    const sampleRow = await pool.query(`SELECT * FROM public."${tableName}" LIMIT 1`);
    if (sampleRow.rows.length > 0) {
        const row = sampleRow.rows[0];
        const keyCols = Object.keys(row).filter(k => !/^y\d/.test(k));
        const keyData = {};
        keyCols.forEach(k => keyData[k] = row[k]);
        console.log('\nSample row (non-data fields):', JSON.stringify(keyData, null, 2));
        // Show one data column value
        const firstDataCol = dataCols[0];
        if (firstDataCol) {
            console.log(`Sample data col "${firstDataCol}":`, row[firstDataCol]);
        }
    }
}

async function main() {
    try {
        await getSchema('spatial_county_yunnan_transfer');
        await getSchema('spatial_grid_yunnan_transfer');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

main();
