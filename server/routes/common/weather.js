/**
 * 业务模块路由 (Business Feature Routes)
 * 职责：负责 weather 相关业务接口的 URL 映射及请求派发。
 *
 * 修改提示：
 * 1. 路由内禁止堆叠复杂逻辑，严格践行"瘦路由、胖服务"的开发范式。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
/**
 * 天气服务路由
 * 端点：/weather
 */
import express from 'express';
import logger from '../../config/logger.js';

const router = express.Router();

const WEATHER_ICONS = {
    '晴': '☀️', '多云': '⛅', '阴': '☁️',
    '小雨': '🌧️', '中雨': '🌧️', '大雨': '🌧️', '暴雨': '⛈️', '雷阵雨': '⛈️',
    '雪': '❄️', '小雪': '🌨️', '中雪': '🌨️', '大雪': '❄️',
    '雾': '🌫️', '霾': '😷', '沙尘暴': '🌪️', '浮尘': '🌫️'
};

router.get('/', async (req, res) => {
    const city = req.query.city || '530100';
    const extensions = req.query.extensions || 'base';
    const key = process.env.AMAP_WEATHER_KEY;

    if (!key) {
        return res.status(500).json({
            error: 'API Key 未配置',
            message: '请在 .env 文件中设置 AMAP_WEATHER_KEY'
        });
    }

    try {
        const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${city}&extensions=${extensions}&output=JSON`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== '1') {
            return res.status(400).json({
                error: '高德 API 错误',
                info: data.info,
                infocode: data.infocode
            });
        }

        if (extensions === 'base' && data.lives && data.lives.length > 0) {
            data.lives[0].icon = WEATHER_ICONS[data.lives[0].weather] || '🌡️';
        }

        res.json(data);
    } catch (err) {
        logger.error('[weather] 请求失败', { message: err?.message || String(err), stack: err?.stack });
        res.status(500).json({ error: '请求天气数据失败', message: err.message });
    }
});

export default router;
