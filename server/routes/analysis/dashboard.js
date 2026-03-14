/**
 * dashboard.js — 仪表盘数据路由 (重构版)
 * 
 * 职责：调用 Service 获取分析数据，规范返回格式。
 */
import express from 'express';
import landUseService from '../../services/landUseService.js';

const router = express.Router();

// 获取仪表盘综合数据
router.get('/:year', async (req, res) => {
    try {
        const year = Number(req.params.year);
        const type = req.query.type || 'comprehensive';

        const data = await landUseService.getDashboardData(year, type);

        if (!data) return res.error(`${year}年仪表盘数据加载失败`, 404);

        res.success(data);
    } catch (err) {
        res.error('加载仪表盘失败', 500, err);
    }
});

export default router;
