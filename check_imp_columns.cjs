const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'yunnan_CLCD',
    password: 'password',
    port: 5432,
});

async function run() {
    try {
        console.log('--- Checking imp_sq columns in spatial_grid_yunnan_stats ---');

        const colSql = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND column_name LIKE 'imp_sq_%'
            ORDER BY column_name
        `;
        const { rows } = await pool.query(colSql);

        console.log('Available imp_sq columns:');
        rows.forEach((r, i) => console.log(`  [${i}] ${r.column_name}`));

        console.log('\n--- All CLCD years ---');
        const yearSql = 'SELECT DISTINCT year FROM public.clcd_province ORDER BY year';
        const { rows: yearRows } = await pool.query(yearSql);
        const years = yearRows.map(r => r.year);
        console.log('Years:', years);

        console.log('\n--- Year to Column mapping (Grid mode, skipping 1985) ---');
        const impCols = rows.map(r => r.column_name);
        years.forEach((year, idx) => {
            let gridIdx = idx;
            if (year === 1985) {
                gridIdx = -1; // Skipped
            } else if (idx > 0) {
                gridIdx = idx - 1; // Shift left to skip 1985
            }
            const mappedCol = gridIdx >= 0 && gridIdx < impCols.length ? impCols[gridIdx] : 'N/A';
            console.log(`  Year ${year} (idx=${idx}) -> gridIdx=${gridIdx} -> ${mappedCol}`);
        });

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}

run();
