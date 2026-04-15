/**
 * province.js — 省级数据路由 (重构版)
 * 
 * 职责：保持旧版路径兼容，逻辑迁移至 Service 层
 */
import express from 'express';
import landUseService from '../../services/landUseService.js';

const router = express.Router();

// 获取年份列表
router.get('/years', async (req, res) => {
    try {
        const years = await landUseService.getAvailableYears();
        res.success(years);
    } catch (err) { res.error('获取年份失败', 500, err); }
});

// 获取某年份各地类面积统计 (旧版摘要格式)
router.get('/:year/summary', async (req, res) => {
    try {
        const year = Number(req.params.year);
        const data = await landUseService.getProvinceSummary(year);
        if (!data) return res.error(`${year}年数据不存在`, 404);

        // 转换为旧版前端期望的格式 (class_name, area_km2)
        const formatted = Object.entries(data)
            .filter(([k]) => k !== 'year' && k !== 'id')
            .map(([k, v]) => ({
                class_name: k,
                area_km2: Number(v)
            }));
        res.success(formatted);
    } catch (err) { res.error('获取摘要失败', 500, err); }
});

// 获取省份历史数据汇总
router.get('/province', async (req, res) => {
    try {
        const data = await landUseService.getTrend('云南省', 1985, 2023);
        res.success(data);
    } catch (err) { res.error('获取全省历史数据失败', 500, err); }
});

// 获取区域趋势数据 (旧版接口兼容)
router.get('/trend/:level/:name', async (req, res) => {
    const { level, name } = req.params;
    try {
        const data = await landUseService.getTrend(name, 1985, 2023, level);
        res.success(data);
    } catch (err) { res.error('获取趋势数据失败', 500, err); }
});

// 获取区域实时监测指标 (2021-2026 权威算法)
router.get('/monitoring/:level/:name/:year', async (req, res) => {
    const { level, name, year } = req.params;
    try {
        const data = await landUseService.getRegionMonitoring(Number(year), name, level);
        if (!data) return res.error('计算监测指标失败，可能由于该年份或区域数据缺失', 404);
        res.success(data);
    } catch (err) { res.error('获取监测指标失败', 500, err); }
});

export default router;
