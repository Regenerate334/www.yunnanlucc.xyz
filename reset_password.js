import pool from './server/config/db.js';
import bcrypt from 'bcryptjs';

async function resetPassword() {
    try {
        const newPassword = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password = $1 WHERE username = \'admin\'', [hash]);
        console.log('Admin password reset to: admin123');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

resetPassword();
