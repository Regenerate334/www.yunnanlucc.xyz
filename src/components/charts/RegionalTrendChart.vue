<template>
    <div class="regional-trend-container">
        <!-- 顶部智能诊断面板 -->
        <div class="insight-panel" v-if="insights">
            <div class="insight-card main">
                <div class="insight-title">区域监测诊断: {{ regionName }}</div>
                <div class="insight-content">{{ insights.summary }}</div>
            </div>
            <div class="insight-grid">
                <div class="insight-card mini">
                    <div class="label">变化最剧烈地类</div>
                    <div class="value">{{ insights.mostChangedType }}</div>
                </div>
                <div class="insight-card mini">
                    <div class="label">年均扩张/收缩率</div>
                    <div class="value" :class="insights.rate >= 0 ? 'up' : 'down'">
                        {{ (insights.rate * 100).toFixed(2) }}%
                    </div>
                </div>
            </div>
        </div>

        <!-- 图表容器 -->
        <div ref="chartContainer" class="chart-container"></div>
    </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
    regionName: String,
    level: String,
    seriesData: {
        type: Array,
        default: () => []
    }
})

const chartContainer = shallowRef(null)
const chartInstance = shallowRef(null)

const landTypeMap = {
    'cropland': '耕地',
    'forest': '林地',
    'shrub': '灌木',
    'grassland': '草地',
    'water': '水域',
    'snow_ice': '冰雪',
    'barren': '裸地',
    'impervious': '建设用地',
    'wetland': '湿地'
}

const landUseColors = {
    'cropland': '#FAE39C',
    'forest': '#446F33',
    'shrub': '#33A02C',
    'grassland': '#ABD37B',
    'water': '#1E69B4',
    'snow_ice': '#A6CEE3',
    'barren': '#CFBDA3',
    'impervious': '#E24290',
    'wetland': '#2899E8'
};

const policyMarkers = [
    { year: '1999', name: '退耕还林工程启动', color: '#52c41a' },
    { year: '2000', name: '西部大开发战略', color: '#ff4d4f' },
    { year: '2010', name: '低丘缓坡开发利用试点', color: '#faad14' },
    { year: '2012', name: '生态文明建设', color: '#13c2c2' },
    { year: '2018', name: '白鹤滩水电站全面开工', color: '#1890ff' },
    { year: '2021', name: '退林还耕/耕地保护', color: '#f5222d' }
];

const insights = computed(() => {
    if (!props.seriesData || props.seriesData.length < 2) return null;

    const first = props.seriesData[0];
    const last = props.seriesData[props.seriesData.length - 1];
    const years = last.year - first.year;

    const changes = Object.keys(landTypeMap).map(key => {
        const diff = last[key] - first[key];
        const rate = first[key] > 0 ? (diff / first[key]) / years : 0;
        return { key, diff, rate, name: landTypeMap[key] };
    });

    const mostChanged = [...changes].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

    let summary = "";
    if (changes.find(c => c.key === 'impervious').diff > 0) {
        summary = `${props.regionName}在监测期内呈现明显的城市化扩张特征，建设用地持续增长。`;
    }
    if (changes.find(c => c.key === 'forest').diff > 0) {
        summary += "同时，林地覆盖率有所提升，体现了良好的生态修复趋势。";
    }

    return {
        summary,
        mostChangedType: mostChanged.name,
        rate: mostChanged.rate
    };
});

const initChart = () => {
    if (!chartContainer.value) return
    chartInstance.value = echarts.init(chartContainer.value)
    updateChart()
}

const updateChart = () => {
    if (!chartInstance.value || !props.seriesData.length) return

    const years = props.seriesData.map(d => d.year).sort((a, b) => a - b);
    const keys = Object.keys(landTypeMap);

    chartInstance.value.clear();

    const yAxisBounds = {};
    keys.forEach(key => {
        const allData = years.map(year => {
            const record = props.seriesData.find(d => d.year === year);
            return (record ? record[key] : 0) / 1000000;
        });
        const min = Math.min(...allData);
        const max = Math.max(...allData);
        const padding = (max - min) * 0.1 || 1;
        yAxisBounds[key] = {
            min: Math.floor(min - padding),
            max: Math.ceil(max + padding)
        };
    });

    const rows = 3;
    const cols = 3;
    const leftMargin = 5;
    const topMargin = 8;
    const bottomMargin = 10;
    const hGap = 5;
    const vGap = 10;

    const gridWidth = (100 - leftMargin * 2 - hGap * (cols - 1)) / cols;
    const gridHeight = (100 - topMargin - bottomMargin - vGap * (rows - 1)) / rows;

    const grids = [];
    const xAxes = [];
    const yAxes = [];
    const series = [];
    const titles = [];

    keys.forEach((key, index) => {
        const r = Math.floor(index / cols);
        const c = index % cols;
        const left = leftMargin + c * (gridWidth + hGap);
        const top = topMargin + r * (gridHeight + vGap);

        grids.push({
            left: left + '%',
            top: top + '%',
            width: gridWidth + '%',
            height: gridHeight + '%',
            containLabel: true
        });

        titles.push({
            text: `${landTypeMap[key]} (km²)`,
            left: (left + gridWidth / 2) + '%',
            top: (top - 5) + '%',
            textAlign: 'center',
            textStyle: {
                color: '#a5ccff',
                fontSize: 12,
                fontWeight: '600',
                textShadowBlur: 5,
                textShadowColor: 'rgba(0,0,0,0.5)'
            }
        });

        xAxes.push({
            gridIndex: index,
            type: 'category',
            boundaryGap: false,
            data: years,
            axisLabel: {
                show: r === rows - 1,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 10,
                margin: 8,
                interval: 4,
                formatter: '{value}'
            },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
            axisTick: { show: r === rows - 1 }
        });

        yAxes.push({
            gridIndex: index,
            type: 'value',
            min: yAxisBounds[key].min,
            max: yAxisBounds[key].max,
            axisLabel: {
                color: 'rgba(165, 204, 255, 0.6)',
                fontSize: 9,
                formatter: (value) => value >= 10000 ? (value / 10000).toFixed(0) + '万' : value.toFixed(0)
            },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
            axisLine: { show: false },
            name: index % cols === 0 ? 'km²' : '',
            nameTextStyle: {
                color: 'rgba(165, 204, 255, 0.4)',
                fontSize: 10,
                align: 'left',
                padding: [0, 0, -10, 0]
            }
        });

        const data = years.map(year => {
            const record = props.seriesData.find(d => d.year === year);
            return (record ? record[key] : 0) / 1000000;
        });

        series.push({
            name: landTypeMap[key],
            type: 'line',
            xAxisIndex: index,
            yAxisIndex: index,
            data: data,
            showSymbol: false,
            smooth: true,
            itemStyle: { color: landUseColors[key] },
            lineStyle: { width: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.2)' },
            endLabel: {
                show: true,
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 'bold',
                distance: 8,
                formatter: (params) => params.value.toFixed(0)
            },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: landUseColors[key] + '33' },
                    { offset: 1, color: landUseColors[key] + '00' }
                ])
            },
            markLine: {
                silent: true,
                symbol: ['none', 'none'],
                label: { show: false },
                data: policyMarkers.map(p => ({
                    xAxis: p.year,
                    lineStyle: { color: p.color, type: 'dashed', opacity: 0.2, width: 1 }
                }))
            }
        });
    });

    const option = {
        backgroundColor: 'transparent',
        animationDuration: 3000,
        animationEasing: 'cubicOut',
        title: titles,
        tooltip: {
            trigger: 'axis',
            confine: true,
            appendToBody: true,
            backgroundColor: 'rgba(13, 25, 48, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            textStyle: { color: '#fff', fontSize: 12 },
            formatter: function (params) {
                const year = params[0].axisValue;
                const record = props.seriesData.find(d => d.year.toString() === year.toString());
                const policy = policyMarkers.find(p => p.year === year);

                let html = `<div style="font-weight:600; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; color:#a5ccff; display:flex; justify-content:space-between; align-items:center;">`;
                html += `<span>${year}年 区域详情</span>`;
                if (policy) html += `<span style="color:${policy.color}; font-size:11px; background:${policy.color}22; padding:2px 6px; border-radius:4px; border:1px solid ${policy.color}44;">${policy.name}</span>`;
                html += `</div>`;

                if (!record) return html + "暂无数据";

                const allTypes = Object.keys(landTypeMap).map(key => ({
                    name: landTypeMap[key],
                    value: record[key] / 1000000,
                    color: landUseColors[key]
                })).sort((a, b) => b.value - a.value);

                allTypes.forEach(item => {
                    const val = item.value;
                    const areaStr = val >= 10000 ? (val / 10000).toFixed(2) + ' 万km²' : val.toFixed(2) + ' km²';
                    const isCurrentGrid = params.some(p => p.seriesName === item.name);

                    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:6px 0; min-width:240px; opacity: ${isCurrentGrid ? 1 : 0.7}; scale: ${isCurrentGrid ? 1.02 : 1};">
                            <span style="display:flex; align-items:center; color:rgba(255,255,255,0.85);">
                                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${item.color}; margin-right:10px; box-shadow:0 0 8px ${item.color}66;"></span>
                                <span style="${isCurrentGrid ? 'color:#fff; font-weight:bold;' : ''}">${item.name}</span>
                            </span>
                            <span style="font-weight:600; margin-left:20px; font-family:'JetBrains Mono', monospace; ${isCurrentGrid ? 'color:#fff;' : 'color:rgba(255,255,255,0.7);'}">${areaStr}</span>
                        </div>`;
                });
                return html;
            }
        },
        legend: {
            show: true,
            selectedMode: false,
            bottom: '0%',
            left: 'center',
            orient: 'horizontal',
            textStyle: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
            data: Object.values(landTypeMap),
            icon: 'rect',
            itemWidth: 12,
            itemHeight: 12,
            itemGap: 15
        },
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series: series
    };

    chartInstance.value.setOption(option);
}

onMounted(() => {
    nextTick(() => {
        initChart()
    })
})

onUnmounted(() => {
    if (chartInstance.value) {
        chartInstance.value.dispose()
    }
})

watch(() => props.seriesData, () => {
    updateChart()
}, { deep: true })
</script>

<style scoped>
.regional-trend-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.insight-panel {
    display: flex;
    gap: 20px;
    padding: 0 10px;
}

.insight-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px 20px;
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
}

.insight-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
}

.insight-card.main {
    flex: 2;
    border-left: 4px solid #3b82f6;
}

.insight-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}

.insight-card.mini {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
}

.insight-title {
    color: #a5ccff;
    font-weight: 600;
    margin-bottom: 10px;
    font-size: 14px;
    letter-spacing: 0.02em;
}

.insight-content {
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    line-height: 1.6;
}

.label {
    color: rgba(255, 255, 255, 0.4);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
}

.value {
    color: #fff;
    font-weight: 700;
    font-size: 18px;
    font-family: 'JetBrains Mono', monospace;
}

.value.up {
    color: #fca5a5;
}

.value.down {
    color: #86efac;
}

.chart-container {
    flex: 1;
    width: 100%;
    min-height: 600px;
}
</style>
