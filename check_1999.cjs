
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
        console.log('--- COMPARING 1999 COLUMNS ---');

        const sql = `
            SELECT 
                COUNT(imp_sq_199) as valid_count_imp,
                SUM(imp_sq_199) as total_area_imp,
                COUNT(ipm_sq_199) as valid_count_ipm,
                SUM(ipm_sq_199) as total_area_ipm
            FROM spatial_grid_yunnan_stats
        `;

        const { rows } = await pool.query(sql);
        const row = rows[0];

        console.log('imp_sq_199 (Correct Name):');
        console.log(`  Count: ${row.valid_count_imp}`);
        console.log(`  Sum Area: ${row.total_area_imp}`);

        console.log('\nipm_sq_199 (Typo Name):');
        console.log(`  Count: ${row.valid_count_ipm}`);
        console.log(`  Sum Area: ${row.total_area_ipm}`);

        if (Number(row.total_area_imp) > 0) {
            console.log('\nCONCLUSION: correct column has data. Safe to drop typo.');
        } else {
            console.warn('\nWARNING: correct column might be empty!');
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}

run();
