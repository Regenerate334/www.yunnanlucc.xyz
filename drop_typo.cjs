
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
        console.log('--- DROPPING TYPO COLUMN ---');
        console.log('Target: ipm_sq_199 (Verified duplicate/junk)');

        // Double check existence
        const checkRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_stats' 
            AND column_name = 'ipm_sq_199'
        `);

        if (checkRes.rows.length > 0) {
            await pool.query(`
                ALTER TABLE spatial_grid_yunnan_stats 
                DROP COLUMN ipm_sq_199
            `);
            console.log('SUCCESS: Dropped ipm_sq_199.');
        } else {
            console.log('Column ipm_sq_199 already gone.');
        }

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        pool.end();
    }
}

run();
