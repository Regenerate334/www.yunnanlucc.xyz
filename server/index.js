import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './config/db.js';
import { requestLogger, handleError } from './middleware/logger.js';

// 加载 server 目录下的 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// 导入路由
import authRoutes from './routes/auth.js';
import clcdRoutes from './routes/clcd.js';
import regionRoutes from './routes/regions.js';
import analysisRoutes from './routes/analysis.js';
import weatherRoutes from './routes/weather.js';
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

let port = Number(process.env.PORT || 3000);
// Prevent server from trying to bind to Vite's ports if env var leaks
if (port === 5173 || port === 5174) {
  console.warn(`[server] Detected Vite port ${port} in environment, forcing port 3000`);
  port = 3000;
}
app.listen(port, () => {
  console.log(`\x1b[32m[server] 后端服务已启动: http://localhost:${port}\x1b[0m`);
});
