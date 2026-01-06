import pool from './server/config/db.js';

async function checkUsers() {
    try {
        const res = await pool.query('SELECT username, password FROM users');
        console.log('Users:', res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkUsers();
