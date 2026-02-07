const { Pool } = require('pg');
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'yunnan_CLCD',
    user: 'postgres',
    password: 'password'
});

async function verifyMapping() {
    // 1. Get ALL years
    const yearSql = 'SELECT DISTINCT year FROM public.clcd_province ORDER BY year';
    const { rows: yearRows } = await pool.query(yearSql);
    const years = yearRows.map(r => r.year);

    // 2. Get ALL columns for grid stats (barren)
    const colsSql = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'spatial_grid_yunnan_stats' 
          AND column_name LIKE 'bar_sq_%'
        ORDER BY column_name 
    `;
    const { rows: colRows } = await pool.query(colsSql);
    const dbCols = colRows.map(r => r.column_name).sort();

    console.log(`Total Years: ${years.length}`);
    console.log(`Total Columns: ${dbCols.length}`);

    // 3. Test Mapping for 1985
    const testYear = 1985;
    const targetIndex = years.indexOf(testYear);

    console.log(`\nTesting Year: ${testYear}`);
    console.log(`Target Index: ${targetIndex}`);

    if (targetIndex !== -1 && targetIndex < dbCols.length) {
        console.log(`Mapped Column: ${dbCols[targetIndex]}`);
    } else {
        console.log('Mapping FAILED');
    }

    // 4. Test Mapping for 1990
    const testYear2 = 1990;
    const targetIndex2 = years.indexOf(testYear2);
    console.log(`\nTesting Year: ${testYear2}`);
    console.log(`Target Index: ${targetIndex2}`);
    console.log(`Mapped Column: ${dbCols[targetIndex2]}`);

    await pool.end();
}

verifyMapping().catch(console.error);
