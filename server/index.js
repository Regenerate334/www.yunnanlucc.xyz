import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 立即加载环境变量,确保后续导入的模块(如 db.js)能读取到配置
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`\x1b[31m[server] 无法加载 .env 文件: ${envPath}\x1b[0m`);
} else {
  console.log(`\x1b[32m[server] 已成功加载环境变量: ${envPath}\x1b[0m`);
  console.log(`[server] JWT_SECRET 状态: ${process.env.JWT_SECRET ? '已配置' : '未配置'}`);
}

import express from 'express';
import cors from 'cors';
import pool from './config/db.js';
import { requestLogger, handleError } from './middleware/logger.js';

// 导入路由
import authRoutes from './routes/auth.js';
import clcdRoutes from './routes/clcd.js';
import regionRoutes from './routes/regions.js';
import analysisRoutes from './routes/analysis.js';
import weatherRoutes from './routes/weather.js';
import aiRoutes from './routes/ai.js';
import chatRoutes from './routes/chat.js';
import chatSessionsRoutes from './routes/chat-sessions.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// 健康检查
app.get('/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (err) { handleError(res, err); }
});

// 挂载路由
app.use('/api/auth', authRoutes);
app.use('/api/weather', weatherRoutes); // 天气API无需认证

app.use('/api/clcd', authMiddleware, clcdRoutes);
app.use('/api/regions', authMiddleware, regionRoutes);
app.use('/api/analysis', authMiddleware, analysisRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/chat', authMiddleware, chatRoutes); // 独立的聊天端点（兼容性）
app.use('/api/chat-sessions', authMiddleware, chatSessionsRoutes); // 会话管理

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
    console.log('\x1b[32m[db] Chat tables initialized (Single Table JSONB)\x1b[0m');
  } catch (err) {
    console.error('\x1b[31m[db] Failed to initialize chat tables:\x1b[0m', err.message);
  }
};
initChatTables();

let port = Number(process.env.PORT || 3000);
// Prevent server from trying to bind to Vite's ports if env var leaks
if (port === 5173 || port === 5174) {
  console.warn(`[server] Detected Vite port ${port} in environment, forcing port 3000`);
  port = 3000;
}
app.listen(port, () => {
  console.log(`\x1b[32m[server] 后端服务已启动: http://localhost:${port}\x1b[0m`);
});
