/**\n * 系统配置模块 (System Configuration Module)\n * 职责：负责加载并向系统暴露有关 database 的全局静态配置或环境变量。\n *\n * 修改提示：\n * 1. 敏感密钥或连接串应从 .env 中读取，严禁硬编码。\n * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。\n * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。\n */\nimport pg from 'pg';
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

