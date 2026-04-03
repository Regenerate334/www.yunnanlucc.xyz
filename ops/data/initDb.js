/**
 * 数据库初始化脚本 (Database Initialization Script)
 * 职责：建立基础用户表、审计日志表，并初始化超级管理员 (admin) 账号。
 * 
 * 修改提示：
 * 1. 若需扩展用户信息字段，请在 CREATE TABLE users 语句中添加。
 * 2. 初始密码在 .env 的 INITIAL_ADMIN_PASSWORD 中定义，脚本会自动进行 bcrypt 哈希处理。
 * 3. 运行指令：node ops/data/initDb.js
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
