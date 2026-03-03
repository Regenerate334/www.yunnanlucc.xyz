
import pool from '../config/db.js';

async function testExecution() {
    try {
        console.log('--- Simulating Transfer Query ---');

        const year_start = 1995;
        const year_end = 2000;
        const from_class = 2; // Forest
        const to_class = 7;   // Barren
        const scale = 'county';

        console.log(`Params: ${year_start}-${year_end}, ${from_class}->${to_class}, ${scale}`);

        // 2. Determine Table
        let tableName = '';
        let idColumn = '';
        if (scale === 'county') {
            tableName = 'spatial_county_yunnan_transfer';
            idColumn = 'OBJECTID';
        } else if (scale === 'grid') {
            tableName = 'spatial_grid_yunnan_transfer';
            idColumn = 'gid';
        }

        // 3. Construct Columns
        const start = parseInt(year_start);
        const end = parseInt(year_end);
        const from = parseInt(from_class);
        const to = parseInt(to_class);
        const columns = [];

        for (let y = start; y < end; y++) {
            if (y === 1985 && end >= 1990) {
                columns.push(`y8590_${from}${to}`);
                y = 1989;
                continue;
            }
            const yy1 = y % 100;
            const yy2 = (y + 1) % 100;
            const s1 = yy1 < 10 ? `0${yy1}` : `${yy1}`;
            const s2 = yy2 < 10 ? `0${yy2}` : `${yy2}`;
            const col = `y${s1}${s2}_${from}${to}`;
            columns.push(col);
        }

        console.log('Generated Columns:', columns);

        // 4. Validate Columns
        const validColsRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            AND column_name = ANY($2)
        `, [tableName, columns]);

        const validCols = validColsRes.rows.map(r => r.column_name);
        console.log('Valid Columns:', validCols);

        if (validCols.length === 0) {
            console.log('No valid columns found. Result: []');
            return;
        }

        const sumExpr = validCols.map(c => `COALESCE("${c}", 0)`).join(' + ');

        let query = '';
        if (scale === 'grid') {
            query = `SELECT "${idColumn}" as id, ST_AsGeoJSON("geom") as geometry, (${sumExpr}) as value FROM public."${tableName}" WHERE (${sumExpr}) > 0`;
        } else {
            query = `SELECT "${idColumn}" as id, ST_AsGeoJSON("Shape") as geometry, (${sumExpr}) as value FROM public."${tableName}" WHERE (${sumExpr}) > 0`;
        }

        console.log('SQL:', query);

        // Execute
        const { rows } = await pool.query(query);
        console.log(`Success! Rows returned: ${rows.length}`);
        if (rows.length > 0) {
            console.log('Sample Row:', rows[0]);
        }

    } catch (e) {
        console.error('EXECUTION FAILED:', e);
    } finally {
        pool.end();
    }
}

testExecution();
