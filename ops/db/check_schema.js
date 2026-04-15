import pool from './server/config/db.js';

async function checkSchema() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'clcd_prefecture'");
        console.log('Columns in clcd_prefecture:', res.rows.map(r => r.column_name).join(', '));

        const res2 = await pool.query("SELECT * FROM clcd_prefecture LIMIT 1");
        console.log('Sample row:', JSON.stringify(res2.rows[0], null, 2));
    } catch (e) {
        console.error('Check failed', e);
    } finally {
        process.exit(0);
    }
}

checkSchema();
