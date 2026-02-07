
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
        console.log('--- FIXING DATABASE TYPO ---');

        // Check if typo column exists
        const checkRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND column_name = 'ipm_sq_199'
        `);

        if (checkRes.rows.length > 0) {
            console.log('Found typo column: ipm_sq_199. Renaming to imp_sq_199...');

            await pool.query(`
                ALTER TABLE spatial_grid_yunnan_stats 
                RENAME COLUMN ipm_sq_199 TO imp_sq_199
            `);

            console.log('SUCCESS: Column renamed.');
        } else {
            console.log('Column ipm_sq_199 not found. It might have been fixed already.');
        }

        // Check if the target column exists now
        const verifyRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND column_name = 'imp_sq_199'
        `);

        if (verifyRes.rows.length > 0) {
            console.log('VERIFICATION: imp_sq_199 exists.');
        } else {
            console.error('ERROR: imp_sq_199 does NOT exist.');
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}

run();
