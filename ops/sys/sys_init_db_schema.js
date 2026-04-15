/**
 * ================================================================================
 * @File    :   sys_init_db_schema.js
 * @Desc    :   数据库初始化脚本。创建用户表（users）并根据 .env 配置自动生成 
 *              bcrypt 加密的超级管理员账号。
 * @Usage   :   node ops/data/sys_init_db_schema.js
 * @Deps    :   dotenv, pg (via server/config/db.js), bcryptjs
 * ================================================================================
 */
import 'dotenv/config';
import pool from '../../server/config/db.js';
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
            const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
            if (!adminPassword) {
                console.error('FATAL: DEFAULT_ADMIN_PASSWORD not set in .env');
                process.exit(1);
            }
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await pool.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
                ['admin', hashedPassword, 'admin']
            );
            console.log(`[db] default admin user created (Password: ${adminPassword})`);
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
