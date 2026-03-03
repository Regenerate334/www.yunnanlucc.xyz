
import pool from '../config/db.js';

async function debug() {
    try {
        console.log('--- Debugging Transfer Tables ---');

        // Check County Table
        console.log('\n1. Checking spatial_county_yunnan_transfer:');
        const r1 = await pool.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_transfer' 
            AND column_name IN ('Shape', 'geom', 'y9596_27')
        `);
        console.table(r1.rows);

        // Check Grid Table
        console.log('\n2. Checking spatial_grid_yunnan_transfer:');
        const r2 = await pool.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_grid_yunnan_transfer' 
            AND column_name IN ('Shape', 'geom', 'y9596_27')
        `);
        console.table(r2.rows);

        // Check 1995-1996 columns
        console.log('\n3. Searching for y9596 columns in County Table:');
        const r3 = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'spatial_county_yunnan_transfer' 
            AND column_name LIKE 'y9596%'
            LIMIT 5
        `);
        console.log(r3.rows.map(r => r.column_name));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

debug();
