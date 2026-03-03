import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import logger from './config/logger.js';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  logger.error(`[server] 无法加载 .env 文件: ${envPath}`);
} else {
  logger.info(`[server] 已成功加载环境变量: ${envPath}`);
}

import express from 'express';
import cors from 'cors';
import pool from './config/db.js';
import { requestLogger, handleError } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';

// 导入模块化路由
import apiRoutes from './routes/index.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// 健康检查（无需认证）
app.get('/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (err) { handleError(res, err); }
});

// 挂载 API 路由（部分需要认证）
app.use('/api/auth', (await import('./routes/auth.js')).default);
app.use('/api/weather', (await import('./routes/common/weather.js')).default);

// 需要认证的路由
app.use('/api/clcd', authMiddleware, (await import('./routes/clcd/index.js')).default);
app.use('/api/regions', authMiddleware, (await import('./routes/common/regions.js')).default);
app.use('/api/analysis', authMiddleware, (await import('./routes/analysis/index.js')).default);
app.use('/api/ai', authMiddleware, (await import('./routes/ai/index.js')).default);
app.use('/api/chat', authMiddleware, (await import('./routes/ai/chat.js')).default);
app.use('/api/chat-sessions', authMiddleware, (await import('./routes/ai/session.js')).default);

// 初始化数据库表
const initChatTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255),
        messages JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info('[db] Chat tables initialized');
  } catch (err) {
    logger.error(`[db] Failed to initialize chat tables: ${err.message}`);
  }
};
initChatTables();

let port = Number(process.env.PORT || 3000);
if (port === 5173 || port === 5174) {
  console.warn(`[server] Detected Vite port ${port}, forcing port 3000`);
  port = 3000;
}

// 使用 server.on('error') 捕获端口冲突，避免触发 uncaughtException 输出大段 JSON
const httpServer = createServer(app);

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`[server] 端口 ${port} 已被占用，请先终止旧进程后重试 (EADDRINUSE)`);
  } else {
    logger.error(`[server] 启动失败: ${err.message}`);
  }
  process.exit(1);
});

httpServer.listen(port, () => {
  logger.info(`[server] 后端服务已启动: http://localhost:${port}`);
});

