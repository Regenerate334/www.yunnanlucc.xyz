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
    keywords: ['土地利用', '土地覆盖', 'CLCD', '面积', '统计', '趋势', '排名', '对比', '占比', '构成', '结构'],
    parameters: {
        type: 'object',
        properties: {
            query_type: {
                type: 'string',
                enum: ['trend', 'comparison', 'ranking', 'structure', 'monitoring'],
                description: '查询类型：trend(趋势), comparison(对比), ranking(排名), structure(占比), monitoring(监测指数/风险评估)'
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
        let { query_type, region, level, year: targetYear, year_range, land_type, top_n = 10 } = args;
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
                    const allTrends = await Promise.all(regions.map(r => landUseService.getTrend(r, start, end, level)));
                    const rows = allTrends.flat();
                    return { type: 'trend', rows, region: regions.join('和'), multi: true };
                }

                const targetRegion = regions[0];
                const rows = await landUseService.getTrend(targetRegion, start, end, level);
                return { type: 'trend', rows, region: targetRegion };
            }

            if (query_type === 'ranking' || query_type === 'comparison') {
                // 如果指定了具体区域，只对比这些区域
                const rows = await landUseService.getRegionData(targetYear, isMultiRegion ? regions : null, level);
                return { type: 'comparison', rows, year: targetYear, region: isMultiRegion ? regions.join('和') : '全省各地市' };
            }

            if (query_type === 'monitoring') {
                const targetRegion = regions[0];
                let actualLevel = level;
                if (!actualLevel || actualLevel === 'auto') {
                    actualLevel = landUseService._inferLevel(targetRegion);
                }
                const data = await landUseService.getRegionMonitoring(targetYear, targetRegion, actualLevel);
                return { type: 'monitoring', ...data, region: targetRegion };
            }

            // 结构化数据/占比
            if (regions.length === 1 && regions[0] === '云南省') {
                const row = await landUseService.getProvinceSummary(targetYear);
                return { type: 'structure', rows: row ? [row] : [], year: targetYear, region: '云南省' };
            } else {
                const rows = await landUseService.getRegionData(targetYear, regions, level);
                return { type: 'structure', rows, year: targetYear, region: regions.join('和') };
            }
        } catch (err) {
            logger.error('[clcdTool] 查询失败:', err);
            throw err;
        }
    },

    format(data, entities) {
        if (data.type === 'monitoring') {
            const m = data.metrics;
            const score = data.compositeScore.toFixed(1);

            const getStatusTxt = (s, labels) => {
                if (s > 75) return `🔴 ${labels[3]}`;
                if (s > 50) return `🟠 ${labels[2]}`;
                if (s > 25) return `🟡 ${labels[1]}`;
                return `🟢 ${labels[0]}`;
            };

            return [
                `## 环境风险监测评估：${data.region} (${data.year}年)`,
                `> 依据：2021-2026 LUCC 权威学术评价模型`,
                '',
                `### 综合风险指数：**${score}** / 100`,
                '',
                '| 监测指标 | 原始值 | 1985 基准 | 风险得分 | 状态 |',
                '| :--- | :--- | :--- | :--- | :--- |',
                `| InVEST 生境质量 | ${m.hq.value.toFixed(3)} | ${m.hq.base.toFixed(3)} | ${m.hq.score.toFixed(1)} | ${getStatusTxt(m.hq.score, ['安全/优', '关注/良', '警告/中', '严重退化/差'])} |`,
                `| 源汇碳代谢压力 | ${m.cmp.value.toFixed(3)} | ${m.cmp.base.toFixed(3)} | ${m.cmp.score.toFixed(1)} | ${getStatusTxt(m.cmp.score, ['安全', '代谢承压', '警告', '严重风险'])} |`,
                `| 全域生态韧性度 | ${m.eres.value.toFixed(3)} | ${m.eres.base.toFixed(3)} | ${m.eres.score.toFixed(1)} | ${getStatusTxt(m.eres.score, ['安全', '海绵退化', '脆弱预警', '结构崩溃'])} |`,
                `| 三生空间冲突度 | ${m.plec.value.toFixed(3)} | ${m.plec.base.toFixed(3)} | ${m.plec.score.toFixed(1)} | ${getStatusTxt(m.plec.score, ['协同安全', '边缘试探', '深度博弈', '全面侵蚀'])} |`,
                '',
                '**评估结论**：',
                data.compositeScore > 50 ? '⚠️ 该区域存在显著的生态环境风险，建议加强空间规划管制。' : '✅ 区域生态状态相对稳定，建议配合“三区三线”进行持续监测。'
            ].join('\n');
        }

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

            let total = 0;
            ['cropland', 'forest', 'shrub', 'grassland', 'water', 'wetland', 'impervious', 'barren', 'snow_ice'].forEach(c => total += (Number(r[c]) || 0));

            const cells = cols.map(c => {
                const val = Number(r[c]) || 0;
                const km2 = (val / 1e6).toFixed(2);
                const pct = total > 0 ? ((val / total) * 100).toFixed(2) + '%' : '0.00%';
                return `${km2} (${pct})`;
            });
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
