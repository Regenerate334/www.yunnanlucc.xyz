/**
 * Agent 专用执行工具 (Agent Dedicated Tool Executor)
 * 职责：作为 Agent 动作节点，提供针对 weatherTool 维度的真实数据获取及格式化封装。
 *
 * 修改提示：
 * 1. 返回值需最大程度扁平化和自然语言化，便于大模型理解和吸收。
 * 2. 若涉及异步操作，请务必处理 Promise 的 catch 块防止未捕获异常。
 * 3. 遵循现有的 ESLint 和团队代码规范，保持极简及高可读性。
 */
import logger from '../../../config/logger.js';
import registry from '../../dataSourceRegistry.js';

const WEATHER_ICONS = {
    '晴': '', '多云': '', '阴': '',
    '小雨': '', '中雨': '', '大雨': '', '暴雨': '', '雷阵雨': '',
    '雪': '', '小雪': '', '中雪': '', '大雪': '',
    '雾': '', '霾': '', '沙尘暴': '', '浮尘': ''
};

const weatherTool = {
    name: 'weather_query',
    description: '查询高德天气实况，可获取当前指定城市的实时气象信息（如气温、风向、天气状况）。',
    keywords: ['天气', '气象', '温度', '气温', '下雨', '晴天', '刮风'],
    parameters: {
        type: 'object',
        properties: {
            city: {
                type: 'string',
                description: '目标城市名称，如 "昆明", "昭通", "五华区" 等，或者对应的六位行政区划码'
            }
        },
        required: ['city']
    },

    async query(args) {
        const city = args.city || '530100'; // 默认昆明
        const extensions = 'base';
        const key = process.env.AMAP_WEATHER_KEY;

        if (!key) {
            throw new Error('未配置 AMAP_WEATHER_KEY 环境变量，无法查询高德气象数据');
        }

        logger.info(`[weatherTool] 查询城市: ${city}`);

        try {
            const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${key}&city=${encodeURIComponent(city)}&extensions=${extensions}&output=JSON`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.status !== '1') {
                throw new Error(`高德 API 返回错误: ${data.info}`);
            }

            if (data.lives && data.lives.length > 0) {
                const w = data.lives[0];
                w.icon = WEATHER_ICONS[w.weather] || '';
                return { type: 'weather', data: w, success: true };
            } else {
                return { type: 'weather', data: null, success: false, msg: '未查询到对应城市的天气数据' };
            }
        } catch (err) {
            logger.error('[weatherTool] 请求失败:', err);
            throw err;
        }
    },

    format(result) {
        if (!result.success || !result.data) {
            return `> 气象数据查询失败：${result.msg || '未知错误'}`;
        }
        const w = result.data;
        return [
            `## 实时气象数据：${w.city} (${w.province})`,
            '',
            `- **天气状况**: ${w.weather} ${w.icon}`,
            `- **当前气温**: ${w.temperature} ℃`,
            `- **风力风向**: ${w.winddirection}风 ${w.windpower} 级`,
            `- **空气湿度**: ${w.humidity} %`,
            `- **报告时间**: ${w.reporttime}`,
            '',
            `> 数据来源：高德气象服务`
        ].join('\n');
    }
};


registry.register(weatherTool);
export default weatherTool;
