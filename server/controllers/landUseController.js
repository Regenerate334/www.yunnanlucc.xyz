/**
 * LandUseController.js — 土地利用接口控制器
 * 
 * 职责：
 * 1. 提取 HTTP 请求中的参数（query, params）。
 * 2. 调用 LandUseService 执行业务逻辑。
 * 3. 结果返回统一的 res.success 或 res.error。
 */

import landUseService from '../services/landUseService.js';

class LandUseController {
    /**
     * 获取指定年份全省汇总
     * GET /api/v1/land-use/province?year=2023
     */
    async getProvinceSummary(req, res) {
        try {
            const year = parseInt(req.query.year || req.params.year) || 2023;
            const data = await landUseService.getProvinceSummary(year);
            if (!data) return res.error(`${year}年全省数据不存在`, 404);
            res.success(data);
        } catch (err) {
            res.error('获取全省数据失败', 500, err);
        }
    }

    /**
     * 获取地级市数据
     * GET /api/v1/land-use/prefecture?year=2023&region=昆明
     */
    async getPrefectureData(req, res) {
        try {
            const year = parseInt(req.query.year) || 2023;
            const region = req.query.region || null;
            const data = await landUseService.getPrefectureData(year, region);
            res.success(data);
        } catch (err) {
            res.error('获取地市数据失败', 500, err);
        }
    }

    /**
     * 获取历史趋势
     * GET /api/v1/land-use/trend?region=云南省&startYear=1985&endYear=2023
     */
    async getTrend(req, res) {
        try {
            const region = req.query.region || '云南省';
            const startYear = parseInt(req.query.startYear) || 1985;
            const endYear = parseInt(req.query.endYear) || 2023;
            const data = await landUseService.getTrend(region, startYear, endYear);
            res.success(data);
        } catch (err) {
            res.error('获取趋势数据失败', 500, err);
        }
    }

    /**
     * 获取土地转移矩阵
     * GET /api/v1/land-use/transfer?region=昆明&period=y0023
     */
    async getTransferMatrix(req, res) {
        try {
            const region = req.query.region || '云南省';
            const period = req.query.period || 'y0023';
            const data = await landUseService.getTransferMatrix(region, period);
            res.success(data);
        } catch (err) {
            res.error('获取流转数据失败', 500, err);
        }
    }
}

export default new LandUseController();
