import pool from './config/db.js';
import bcrypt from 'bcryptjs';

async function initDb() {
    try {
        // 创建用户表
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('[db] users table created or already exists');

        // 检查是否已有 admin 用户
        const res = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        if (res.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('123456', 10);
            await pool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['admin', hashedPassword, 'admin']
            );
            console.log('[db] default admin user created (admin / 123456)');
        } else {
            console.log('[db] admin user already exists');
        }
    } catch (err) {
        console.error('[db] init error:', err);
    } finally {
        process.exit();
    }
}

initDb();
