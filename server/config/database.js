import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 数据库连接池配置 ====================
export const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  database: process.env.PGDATABASE || 'yunnan_CLCD',
  max: 10, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时时间
  connectionTimeoutMillis: 2000, // 连接超时时间
});

// ==================== 数据库连接事件监听 ====================
pool.on('connect', (client) => {
  console.log('[DB] 新客户端连接已建立');
});

pool.on('error', (err, client) => {
  console.error('[DB] 数据库连接池错误:', err);
});

// ==================== 数据库连接测试 ====================
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time');
    console.log('[DB] 数据库连接测试成功:', result.rows[0].current_time);
    client.release();
    return true;
  } catch (err) {
    console.error('[DB] 数据库连接测试失败:', err);
    return false;
  }
};

// ==================== 优雅关闭 ====================
export const closePool = async () => {
  try {
    await pool.end();
    console.log('[DB] 数据库连接池已关闭');
  } catch (err) {
    console.error('[DB] 关闭数据库连接池时出错:', err);
  }
};

// 导出连接配置信息（用于日志）
export const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 'yunnan_CLCD'
};

