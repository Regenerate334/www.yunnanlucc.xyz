/**
 * API 路由入口
 * 聚合所有模块路由
 */
import express from 'express';
import clcdRouter from './clcd/index.js';
import analysisRouter from './analysis/index.js';
import aiRouter from './ai/index.js';
import commonRouter from './common/index.js';
import authRouter from './auth.js';

// V1 标准化路由
import v1LandUseRouter from './v1/landUse.js';

const router = express.Router();

// ==================== 路由注册 ====================
// V1 API (新规范)
router.use('/v1/land-use', v1LandUseRouter);

// 旧版 API (保持兼容，内部将被重构为调用 Service)
router.use('/clcd', clcdRouter);

// 分析模块
router.use('/analysis', analysisRouter);

// AI 模块
router.use('/ai', aiRouter);

// 通用接口
router.use('/', commonRouter);

// 认证
router.use('/auth', authRouter);

// 兼容性路由
router.use('/chat', aiRouter);
router.use('/chat-sessions', (await import('./ai/session.js')).default);

// ==================== 健康检查 ====================
router.get('/health', async (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      api: 'running',
      database: 'connected'
    }
  });
});

// ==================== API 信息 ====================
router.get('/info', (req, res) => {
  res.json({
    name: '云南土地利用数据API',
    version: '2.0.0',
    description: '提供云南土地利用变化监测数据的RESTful API服务',
    modules: {
      clcd: '/api/clcd/*',
      analysis: '/api/analysis/*',
      ai: '/api/ai/*',
      regions: '/api/regions/*',
      weather: '/api/weather',
      auth: '/api/auth/*'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
