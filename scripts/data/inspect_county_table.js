import pool from '../config/db.js';

async function checkTable() {
    try {
        console.log('Checking clcd_county...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'clcd_county';
        `);
        console.log('Columns:', res.rows.map(r => r.column_name));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkTable();
