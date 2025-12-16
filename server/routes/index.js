import express from 'express';
import clcdRoutes from './clcd.js';

const router = express.Router();

// ==================== 路由注册 ====================
// 注册CLCD相关路由
router.use('/clcd', clcdRoutes);

// ==================== 通用健康检查 ====================
/**
 * GET /api/health
 * 通用健康检查接口
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        api: 'running',
        database: 'connected'
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ==================== API信息接口 ====================
/**
 * GET /api/info
 * 获取API信息
 */
router.get('/info', (req, res) => {
  res.json({
    name: '云南土地利用数据API',
    version: '1.0.0',
    description: '提供云南土地利用变化监测数据的RESTful API服务',
    endpoints: {
      health: '/api/health',
      clcd: {
        years: '/api/clcd/years',
        summary: '/api/clcd/:year/summary',
        series: '/api/clcd/series',
        prefecture: '/api/clcd/:year/prefecture-summary',
        county: '/api/clcd/:year/county-summary'
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;

