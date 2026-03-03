/**
 * 天气服务路由
 * 端点：/weather
 */
import express from 'express';

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
        console.error('[weather] 请求失败:', err.message);
        res.status(500).json({ error: '请求天气数据失败', message: err.message });
    }
});

export default router;
