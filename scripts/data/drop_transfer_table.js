import pool from '../config/db.js';

async function dropTable() {
    try {
        console.log('Dropping table clcd_transfer_matrix...');
        await pool.query('DROP TABLE IF EXISTS public.clcd_transfer_matrix');
        console.log('Table clcd_transfer_matrix dropped successfully.');
    } catch (err) {
        console.error('Error dropping table:', err.message);
    } finally {
        pool.end();
    }
}

dropTable();
