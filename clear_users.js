import pool from './server/config/db.js';

async function clearUsers() {
    try {
        const res = await pool.query('DELETE FROM users');
        console.log(`已删除所有用户，共计 ${res.rowCount} 个。`);
        process.exit(0);
    } catch (err) {
        console.error('删除失败:', err);
        process.exit(1);
    }
}

clearUsers();
