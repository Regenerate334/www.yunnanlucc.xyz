import landUseService from '../../services/landUseService.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';

// 地类配置（中文名映射）
const LAND_USE_CONFIG = {
    cropland: '耕地', forest: '林地', shrub: '灌木', grassland: '草地',
    water: '水体', wetland: '湿地', impervious: '建设用地', barren: '裸地', snow_ice: '冰雪'
};

const clcdTool = {
    name: 'clcd_analysis',
    description: '查询云南省 1985-2023 年土地利用与覆盖变化（CLCD）数据。支持趋势分析、区域对比、地类占比和面积排名。',
    parameters: {
        type: 'object',
        properties: {
            query_type: {
                type: 'string',
                enum: ['trend', 'comparison', 'ranking', 'structure'],
                description: '查询类型：trend(趋势/历史), comparison(区域对比), ranking(面积排名), structure(地类占比)'
            },
            region: {
                type: 'string',
                description: '目标区域：如 "云南省", "昆明市" 或多个地区逗号分隔 "昆明,曲靖" 等。'
            },
            year: {
                type: 'integer',
                description: '目标年份 (1985-2023)。'
            },
            year_range: {
                type: 'array',
                items: { type: 'integer' },
                description: '年份区间，如 [2000, 2023]。'
            },
            land_type: {
                type: 'string',
                description: '可选：限定分析特定的地类，如 "forest", "cropland"。'
            },
            top_n: {
                type: 'integer',
                description: '排名查询时的数量限制，默认 10。'
            }
        },
        required: ['query_type']
    },

    async query(args, entities, year = 2023) {
        let { query_type, region, year: targetYear, year_range, land_type, top_n = 10 } = args;
        targetYear = targetYear || year;

        // 规范化 region
        if (!region || region === '云南省' || region === '全省') {
            region = '云南省';
        }

        logger.info(`[clcdTool] 执行查询: ${query_type}, 区域: ${region}`);

        try {
            // 处理多个区域
            const regions = region ? region.split(/[,，]/).map(r => r.trim()).filter(r => !!r) : ['云南省'];
            const isMultiRegion = regions.length > 1;

            if (query_type === 'trend' || year_range) {
                const start = year_range ? year_range[0] : 1985;
                const end = year_range ? year_range[1] : 2023;

                // 如果是多个区域的趋势，并行获取
                if (isMultiRegion) {
                    const allTrends = await Promise.all(regions.map(r => landUseService.getTrend(r, start, end)));
                    const rows = allTrends.flat();
                    return { type: 'trend', rows, region: regions.join('和'), multi: true };
                }

                const targetRegion = regions[0];
                // 自适应年份采样逻辑 (Adaptive Year Cycle)
                const span = end - start;
                let rows = [];

                if (span > 15) {
                    logger.info(`[clcdTool] 检测到大跨度趋势分析 (span=${span}), 启用 5 年周期采样`);
                    const yearsToQuery = [];
                    for (let y = start; y < end; y += 5) {
                        yearsToQuery.push(y);
                    }
                    if (!yearsToQuery.includes(end)) yearsToQuery.push(end);

                    const results = await Promise.all(yearsToQuery.map(y =>
                        targetRegion === '云南省' ? landUseService.getProvinceSummary(y) : landUseService.getTrend(targetRegion, y, y)
                    ));
                    rows = results.flat().filter(r => !!r);
                } else {
                    rows = await landUseService.getTrend(targetRegion, start, end);
                }

                return { type: 'trend', rows, region: targetRegion };
            }

            if (query_type === 'ranking' || query_type === 'comparison') {
                // 如果指定了具体区域，只对比这些区域
                const rows = await landUseService.getPrefectureData(targetYear, isMultiRegion ? regions : null);
                return { type: 'comparison', rows, year: targetYear, region: isMultiRegion ? regions.join('和') : '全省各地市' };
            }

            // 结构化数据/占比
            if (regions.length === 1 && regions[0] === '云南省') {
                const row = await landUseService.getProvinceSummary(targetYear);
                return { type: 'structure', rows: row ? [row] : [], year: targetYear, region: '云南省' };
            } else {
                const rows = await landUseService.getPrefectureData(targetYear, regions);
                return { type: 'structure', rows, year: targetYear, region: regions.join('和') };
            }
        } catch (err) {
            logger.error('[clcdTool] 查询失败:', err);
            throw err;
        }
    },

    format(data, entities) {
        const rows = data.rows || [];
        if (rows.length === 0) return `> CLCD 土地利用数据：未找到相关记录。`;

        const cols = Object.keys(LAND_USE_CONFIG);
        const header = `| ${data.type === 'trend' ? '年份' : '地区'} | ${cols.map(c => LAND_USE_CONFIG[c] + '(km²)').join(' | ')} |`;
        const sep = `|${Array(cols.length + 1).fill('---').join('|')}|`;

        const formatKm2 = (val) => ((Number(val) || 0) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const dataRows = rows.map(r => {
            let label = '—';
            if (data.type === 'trend') {
                label = data.multi ? `${r.region_name || '未知'}(${r.year})` : r.year;
            } else {
                label = r.region_name || r.name || '—';
            }
            const cells = cols.map(c => formatKm2(r[c]));
            return `| ${label} | ${cells.join(' | ')} |`;
        });

        return [
            `## 数据背景：${data.region} 土地利用数据 (${data.type === 'trend' ? '历史趋势' : data.year + '年面状数据'})`,
            '',
            header,
            sep,
            ...dataRows,
            rows.length > 50 ? `\n> 数据较多，仅显示前 50 条。` : ''
        ].join('\n');
    }
};

registry.register(clcdTool);
export default clcdTool;
