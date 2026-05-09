/**
 * 后端服务主入口 (Backend Server Entry Point)
 * 职责：初始化 Express 服务、加载全局环境变量、配置中间件（Helmet, CORS, JSON）、以及挂载所有业务路由。
 * 
 * 修改提示：
 * 1. 新增业务模块时，需在路由挂载区域引入对应的 router 实例。
 * 2. 静态资源托管路径必须通过 path.resolve 确保在 Linux/Windows 环境下的路径兼容性。
 * 3. 生产环境部署建议通过 PM2 启动，详见项目根目录的 ecosystem.config.cjs。
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import logger from './config/logger.js';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  logger.error(`[server] 无法加载 .env 文件: ${envPath}`);
} else {
  logger.info(`[server] 已成功加载环境变量: ${envPath}`);
}

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import pool from './config/db.js';
import { requestLogger, handleError } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';

// 导入模块化路由
import apiRoutes from './routes/index.js';

// ==================== 智能数据工具注册 ====================
import './utils/tools/analysis/clcdTool.js';       // 核心地类分析工具
import './utils/tools/analysis/transferTool.js';   // 土地流转分析工具
import './utils/tools/analysis/dashboardTool.js';  // 仪表盘综合指标工具
import './utils/tools/analysis/spatialStatsTool.js'; // 空间特征统计工具
import './utils/tools/knowledge/knowledgeTool.js';  // 专家技能库工具（注册到 Registry）
import './utils/tools/knowledge/knowledgeGraphTool.js'; // 知识图谱查询工具（注册到 Registry）
import './utils/tools/knowledge/policyReferenceTool.js'; // 政策/规划文献索引工具（注册到 Registry）
import { checkOllamaStatus } from './utils/ai/checkOllama.js';

const app = express();
app.set('trust proxy', 1); // 信任一级代理 (Nginx/Cloudflare)

// 1. 日志记录 (Logging) - 移至最前端以捕捉所有请求
app.use(requestLogger);

// 2. 安全性增强 (Security Hardening)
app.use(helmet({
  contentSecurityPolicy: false, // 由 Nginx 或前端单独配置，避免与 Cesium 资源冲突
  crossOriginEmbedderPolicy: false
}));

// 3. 限流 (Rate Limiting) - 防止滥用
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 500, // 限制每个 IP 在 windowMs 内最多 500 个请求
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试。' }
});
app.use('/api/', limiter);

// 4. CORS 配置
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [/\.cloudflare/, /localhost/, /127\.0\.0\.1/] // 在生产中根据需要缩减
    : true,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

// 5. 注册统一响应处理中间件
import { responseHandler } from './middleware/responseHandler.js';
app.use(responseHandler);

// 健康检查（无需认证）
app.get('/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1 as ok');
    res.json({ ok: true, db: r.rows[0].ok === 1 });
  } catch (err) { handleError(res, err); }
});

// 挂载 API 路由（部分需要认证）
app.use('/api/auth', (await import('./routes/auth.js')).default);
app.use('/api/weather', authMiddleware, (await import('./routes/common/weather.js')).default);
app.use('/api/admin', (await import('./routes/admin.js')).default);

// 需要认证的路由
app.use('/api/clcd', authMiddleware, (await import('./routes/clcd/index.js')).default);
app.use('/api/regions', authMiddleware, (await import('./routes/common/regions.js')).default);
app.use('/api/analysis', authMiddleware, (await import('./routes/analysis/index.js')).default);
app.use('/api/ai', authMiddleware, (await import('./routes/ai/index.js')).default);
app.use('/api/chat', authMiddleware, (await import('./routes/ai/chat.js')).default);
app.use('/api/chat-sessions', authMiddleware, (await import('./routes/ai/session.js')).default);

// 确保 AI 服务可用性检查
checkOllamaStatus();

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
  logger.warn(`[server] Detected Vite port ${port}, forcing port 3000`);
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

