
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'yunnan_CLCD',
    password: 'password', // Default fallback
    port: 5432,
});

async function run() {
    try {
        console.log('--- DIAGNOSTIC START ---');

        // 1. Get Years
        const yearRes = await pool.query('SELECT DISTINCT year FROM public.clcd_province ORDER BY year');
        const years = yearRes.rows.map(r => r.year);
        // Helper to print summary
        const printSummary = (label, list) => {
            console.log(`\n${label}: Count = ${list.length}`);
            if (list.length > 0) {
                console.log('  First 3:', list.slice(0, 3).join(', '));
                console.log('  Last 3: ', list.slice(-3).join(', '));
            } else {
                console.log('  (Empty)');
            }
        };

        // 2. Check Grid Shrub Alternatives
        const gridShrub = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND (column_name LIKE 'shu_%' OR column_name LIKE 'bush_%' OR column_name LIKE 'shrub_%')
            ORDER BY column_name
        `);
        const gridShrubCols = gridShrub.rows.map(r => r.column_name);

        // 3. Check Grid Impervious
        const gridImp = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND (column_name LIKE 'imp_%' OR column_name LIKE 'ipm_%')
            ORDER BY column_name
        `);
        const gridImpCols = gridImp.rows.map(r => r.column_name);

        // 4. Check County Impervious
        const countyImp = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_stats' 
            AND column_name LIKE 'imp_%' 
            ORDER BY column_name
        `);
        const countyImpCols = countyImp.rows.map(r => r.column_name);

        // 5. Check Grid 233 Columns (Any attribute)
        const grid233 = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND column_name LIKE '%233' 
            ORDER BY column_name
        `);
        const grid233Cols = grid233.rows.map(r => r.column_name);

        // 6. List Grid Tables
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%grid%'
            ORDER BY table_name
        `);
        const tableList = tables.rows.map(r => r.table_name);

        console.log('\n--- PRIORITY CHECKS ---');
        printSummary('Grid 2023 Cols (Any)', grid233Cols);
        printSummary('Grid Tables', tableList);
        console.log('Grid Tables List:', tableList.join(', '));
        console.log('\n-----------------------');

        printSummary('Years', years);
        printSummary('Grid Shrub', gridShrubCols);
        printSummary('Grid Impervious', gridImpCols);
        printSummary('County Impervious', countyImpCols);
        printSummary('Grid 2023 Cols', grid233Cols);

        console.log('\nAll Tables:');
        console.log(tableList.join(', '));

        console.log('--- DIAGNOSTIC END ---');
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

run();
