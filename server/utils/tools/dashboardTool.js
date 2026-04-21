import landUseService from '../../services/landUseService.js';
import registry from '../dataSourceRegistry.js';
import logger from '../../config/logger.js';

const dashboardTool = {
    name: 'dashboard_analysis',
    description: '获取综合仪表盘数据，包括生态面积估算、城市承载空间估算、综合动态度、各市县排名及预警信息（如耕地红线预警）。',
    keywords: ['仪表盘', '红线', '预警', '综合指标', '生态面积', 'csponMetrics', '动态度', '综合分析'],
    priority: 20,
    parameters: {
        type: 'object',
        properties: {
            year: { type: 'integer', description: '目标年份，如 2023。' },
            region: { type: 'string', description: '可选：限定仪表盘分析的区域。' },
            level: { type: 'string', enum: ['province', 'prefecture', 'county'], description: '行政级别。' }
        },
        required: ['year']
    },

    async query(args, entities, year = 2023) {
        const targetYear = args.year || year;
        let targetRegion = args.region || entities.region || (entities.prefectures?.length > 0 ? entities.prefectures[0] : '云南省');
        const targetLevel = args.level || 'auto';

        // 确保 targetRegion 是字符串，防止 entities.region 是数组导致后续逻辑崩溃
        if (Array.isArray(targetRegion)) {
            targetRegion = targetRegion[0] || '云南省';
        }

        logger.info(`[dashboardTool] 获取综合仪表盘数据, 年份: ${targetYear}, 区域: ${targetRegion}`);

        try {
            const data = await landUseService.getDashboardData(targetYear, 'comprehensive', targetRegion, targetLevel);
            return { type: 'dashboard', year: targetYear, ...data, region: targetRegion };
        } catch (err) {
            logger.error('[dashboardTool] 查询失败:', err);
            throw err;
        }
    },

    format(data, entities) {
        if (!data || !data.csponMetrics) return `> 仪表盘数据：未找到 ${data.year} 年的相关记录。`;

        const m = data.csponMetrics;
        const alertsText = data.alerts && data.alerts.length > 0
            ? data.alerts.map(a => `⚠️ **${a.title}**: ${a.content}`).join('\n')
            : '✅ 暂无严重预警信息';

        // 提取带符号的变化值
        const formatTrend = (trend) => {
            const val = Number(trend) || 0;
            return `${val > 0 ? '+' : ''}${val.toFixed(2)}`;
        };

        const rankingText = ''; // [Legacy Fix] 之前的排行文案变量未定义，暂时留空

        return [
            `## ${data.region} ${data.year} 年土地利用综合仪表盘`,
            '',
            `### 核心评估指标 (CsponMetrics)`,
            `- **耕地总面积**: ${(m?.croplandArea?.value || 0).toFixed(2)} km² (较基准年变化: ${formatTrend(m?.croplandArea?.trend)} km²)`,
            `- **建设用地面积 (城市化空间)**: ${(m?.urbanArea?.value || 0).toFixed(2)} km² (较基准年变化: ${formatTrend(m?.urbanArea?.trend)} km²)`,
            `- **总生态面积 (林草水湿合计)**: ${(m?.ecoArea?.value || 0).toFixed(2)} km² (较基准年变化: ${formatTrend(m?.ecoArea?.trend)} km²)`,
            `- **综合地类动态度**: ${m?.compDynamic?.value || '—'}`,
            `- **建设用地动态度**: ${m?.urbanDynamic?.value || '—'}`,
            `- **生态用地动态度**: ${m?.ecoDynamic?.value || '—'}`,
            '',
            `### 生态与红线预警`,
            alertsText,
            '',
            rankingText
        ].join('\n');
    }
};

registry.register(dashboardTool);
export default dashboardTool;
