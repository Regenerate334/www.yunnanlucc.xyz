import pg from 'pg';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 数据库连接池配置 ====================
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'yunnan_CLCD',
  max: 10, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时时间
  connectionTimeoutMillis: 2000, // 连接超时时间
});

// ==================== 数据库连接事件监听 ====================
pool.on('connect', (client) => {
  logger.info('[DB] 新客户端连接已建立');
});

pool.on('error', (err, client) => {
  logger.error('[DB] 数据库连接池错误', { message: err?.message || String(err), stack: err?.stack });
});

// ==================== 数据库连接测试 ====================
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    logger.info(`[DB] 数据库连接测试成功: ${result.rows[0].current_time}`);
    client.release();
    return true;
  } catch (err) {
    logger.error('[DB] 数据库连接测试失败', { message: err?.message || String(err), stack: err?.stack });
    return false;
  }
};

// ==================== 关闭 ====================
export const closePool = async () => {
  try {
    await pool.end();
    logger.info('[DB] 数据库连接池已关闭');
  } catch (err) {
    logger.error('[DB] 关闭数据库连接池时出错', { message: err?.message || String(err), stack: err?.stack });
  }
};

// 导出连接配置信息（用于日志）
export const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'yunnan_CLCD'
};

