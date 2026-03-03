import pool from '../config/db.js';

async function checkTable() {
    try {
        console.log('Checking clcd_transfer_matrix...');
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'clcd_transfer_matrix';
        `);
        console.log('Columns:', res.rows);

        const count = await pool.query('SELECT count(*) FROM public.clcd_transfer_matrix');
        console.log('Row count:', count.rows[0].count);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkTable();
