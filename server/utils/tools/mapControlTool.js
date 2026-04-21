import logger from '../../config/logger.js';
import registry from '../dataSourceRegistry.js';

const mapControlTool = {
    name: 'map_control',
    description: '通过指令控制 WebGIS 地图视图。包括切换行政区域（如从全省切换到宣威市）、缩放、跳转到特定经纬度等。',
    keywords: ['切换区域', '跳转', '缩放', '定位', '视角控制', '宣威', '昆明'],
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['set_region', 'fly_to', 'zoom_in', 'zoom_out'],
                description: '地图控制动作：set_region(切换区域), fly_to(飞往指定点), zoom_in(放大), zoom_out(缩小)'
            },
            region: {
                type: 'string',
                description: '目标行政区域名称，如 "宣威市", "曲靖市"。当 action 为 set_region 时必填。'
            },
            lnglat: {
                type: 'array',
                items: { type: 'number' },
                description: '经纬度 [lng, lat]，当 action 为 fly_to 时必填。'
            },
            zoom: {
                type: 'number',
                description: '目标缩放层级（0-20）'
            }
        },
        required: ['action']
    },

    async query(args) {
        const { action, region, lnglat, zoom } = args;
        logger.info(`[mapControlTool] 执行指令: ${action}, 参数: ${JSON.stringify({ region, lnglat, zoom })}`);

        // MCP 风格：返回纯数据对象，由框架或拦截器负责转换为前端指令
        return {
            type: 'map_command',
            success: true,
            action,
            params: {
                region,
                lnglat,
                zoom
            }
        };
    },

    format(result) {
        // 这里的文本描述仅供 Agent 在 Thought 阶段参考，不承载核心指令逻辑
        const actionMap = {
            'set_region': `聚焦至区域: ${result.params.region}`,
            'fly_to': `跳转至坐标: ${result.params.lnglat?.join(',')}`,
            'zoom_in': '放大视图',
            'zoom_out': '缩小视图'
        };
        return `> 准备执行地图操作: ${actionMap[result.action] || result.action}`;
    }
};


registry.register(mapControlTool);
export default mapControlTool;
