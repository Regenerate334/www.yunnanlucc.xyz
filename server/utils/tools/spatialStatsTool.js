import { queryTransferGeoJSON } from '../../routes/analysis/transfer_flow.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';

// 地类编码 → 中文名称
const LAND_CLASS_NAMES = {
    1: '耕地', 2: '林地', 3: '草地', 4: '水体', 5: '建设用地',
    6: '裸地', 7: '冰雪', 8: '湿地', 255: '其他'
};

// 逆向映射
const NAME_TO_CLASS = {};
Object.entries(LAND_CLASS_NAMES).forEach(([k, v]) => NAME_TO_CLASS[v] = parseInt(k));
NAME_TO_CLASS['城镇'] = 5;
NAME_TO_CLASS['城市'] = 5;

const spatialStatsTool = {
    name: 'spatial_stats_analysis',
    description: '获取土地利用流转的空间统计特征，包括重心迁移轨迹和标准差椭圆变化（如某类土地转化为建设用地的重心变化轨迹）。',
    keywords: ['空间统计', '重心', '迁移', '轨迹', '标准差椭圆', '空间流转', '方向', '偏移'],
    priority: 20,
    parameters: {
        type: 'object',
        properties: {
            yearStart: { type: 'integer', description: '起始年份，如 1985' },
            yearEnd: { type: 'integer', description: '结束年份，如 2023' },
            fromClassStr: { type: 'string', description: '转出地类，如 "林地", "耕地"' },
            toClassStr: { type: 'string', description: '转入地类，如 "建设用地"' },
            region: { type: 'string', description: '可选：限定空间统计所在的区域。' }
        },
        required: ['yearStart', 'yearEnd', 'fromClassStr', 'toClassStr']
    },

    async query(args, entities, year = 2023) {
        let { yearStart, yearEnd, fromClassStr, toClassStr, region } = args;
        const targetRegion = region || entities.region || '云南省';

        // 兼容逻辑...
        if (!yearStart || !yearEnd) {
            const years = entities.yearRange || entities.years || [1985, 2023];
            yearStart = years[0];
            yearEnd = years[years.length - 1] || 2023;
        }

        if (!fromClassStr || !toClassStr) {
            const types = entities.targetLandTypes || [];
            fromClassStr = types[0] || '林地';
            toClassStr = types[1] || '建设用地';
        }

        const fromClass = NAME_TO_CLASS[fromClassStr] || 1;
        const toClass = NAME_TO_CLASS[toClassStr] || 5;

        logger.info(`[spatialStatsTool] 计算坐标转移: ${fromClassStr}->${toClassStr} (${yearStart}-${yearEnd}), 区域: ${targetRegion}`);

        try {
            // 使用县级作为计算尺度
            const result = await queryTransferGeoJSON(
                'spatial_county_yunnan_transfer',
                yearStart, yearEnd,
                fromClass, toClass,
                'county',
                targetRegion
            );

            // 获取时间切片的轨迹和重心
            let trajectoryFeatures = [];
            try {
                const port = process.env.PORT || 3000;
                const encodedRegion = encodeURIComponent(targetRegion);
                const url = `http://127.0.0.1:${port}/api/analysis/spatial-stats/transfer-series?yearStart=${yearStart}&yearEnd=${yearEnd}&fromClass=${fromClass}&toClass=${toClass}&unit=county&region=${encodedRegion}`;
                const resp = await fetch(url);
                const trajResult = await resp.json();
                if (trajResult.features) {
                    trajectoryFeatures = trajResult.features;
                }
            } catch (e) {
                logger.warn('[spatialStatsTool] Trajectory fetch failed:', e.message);
            }

            return {
                type: 'spatial_stats',
                yearStart, yearEnd,
                fromClassStr, toClassStr,
                features: result.features || [],
                trajectory: trajectoryFeatures
            };
        } catch (err) {
            logger.error('[spatialStatsTool] 查询失败:', err);
            throw err;
        }
    },

    format(data, entities) {
        const { yearStart, yearEnd, fromClassStr, toClassStr, features, trajectory } = data;

        if (!features || features.length === 0) {
            return `> 空间特征统计：未找到 ${yearStart}-${yearEnd} 从 ${fromClassStr} 转为 ${toClassStr} 的显著空间转移。`;
        }

        let desc = `## 空间流转特征分析：${fromClassStr} 转化为 ${toClassStr} (${yearStart} - ${yearEnd})\n\n`;

        // 1. 核心高发区 (Top 15)
        const sorted = [...features].filter(f => f.properties && f.properties.transfer_area)
            .sort((a, b) => b.properties.transfer_area - a.properties.transfer_area)
            .slice(0, 15);

        if (sorted.length > 0) {
            desc += `### 转发生力最猛烈的核心县市区 (Top 15)\n`;
            sorted.forEach((c, i) => {
                const area = (c.properties.transfer_area / 1e6).toFixed(2);
                desc += `- ${i + 1}. ${c.properties.name} (转化面积: ${area} km²)\n`;
            });
            desc += `\n`;
        }

        // 2. 空间重心迁移轨迹
        if (trajectory && trajectory.length > 0) {
            const centers = trajectory.filter(f => f.properties && f.properties.type === 'center');
            if (centers.length > 0) {
                desc += `### 多时段偏移与空间重心迁移轨迹\n`;
                centers.forEach((c, i) => {
                    const coords = c.geometry.coordinates;
                    desc += `- 阶段 ${c.properties.period}: 转移活动重心落于 [经度 ${coords[0].toFixed(4)}, 纬度 ${coords[1].toFixed(4)}]\n`;
                });

                if (centers.length > 1) {
                    const first = centers[0].geometry.coordinates;
                    const last = centers[centers.length - 1].geometry.coordinates;
                    let dirX = last[0] > first[0] ? '东' : '西';
                    let dirY = last[1] > first[1] ? '北' : '南';
                    desc += `\n**极化趋势结论:** 从始至终，该转化的空间发生核心主要向 **${dirY}${dirX}** 方向持续偏移集聚。\n`;
                }
            }
        }

        return desc;
    }
};

registry.register(spatialStatsTool);
export default spatialStatsTool;
