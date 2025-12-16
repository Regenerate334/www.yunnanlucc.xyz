/**
 * 三专题配置
 * 定义土地利用、生态指标、三区三线三个专题的图表配置
 */

export const THEMES = {
    landuse: {
        id: 'landuse',
        name: '土地利用',
        icon: '🌾',
        color: '#667eea',
        charts: [
            {
                id: 'pie',
                component: 'LandUsePieChart',
                title: '土地利用结构',
                props: { year: 2023, compact: true }
            },
            {
                id: 'trend',
                component: 'LandUseTrendChart',
                title: '变化趋势',
                props: { compact: true }
            },
            {
                id: 'sankey',
                component: 'LandTransferSankey',
                title: '类型转移',
                props: { startYear: 2000, endYear: 2020, compact: true }
            },
            {
                id: 'stacked',
                component: 'StackedAreaChart',
                title: '面积变化',
                props: { startYear: 1985, endYear: 2023, compact: true }
            },
            {
                id: 'radar',
                component: 'IndicatorRadar',
                title: '指标对比',
                props: { year1: 2000, year2: 2023, compact: true }
            }
        ]
    },
    ecology: {
        id: 'ecology',
        name: '生态指标',
        icon: '🌳',
        color: '#38ef7d',
        charts: [
            // 待开发
            {
                id: 'placeholder1',
                component: 'PlaceholderChart',
                title: '生态覆盖率',
                props: {}
            }
        ]
    },
    zonelines: {
        id: 'zonelines',
        name: '三区三线',
        icon: '📏',
        color: '#f093fb',
        charts: [
            // 待开发
            {
                id: 'placeholder2',
                component: 'PlaceholderChart',
                title: '三线管控',
                props: {}
            }
        ]
    }
}

export const DEFAULT_THEME = 'landuse'
