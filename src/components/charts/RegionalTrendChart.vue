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
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
    regionName: String,
    level: String,
    seriesData: {
        type: Array,
        default: () => []
    }
})

const chartContainer = ref(null)
const chartInstance = ref(null)

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

// 政策时间轴标记
const policyMarkers = [
    { year: '2000', name: '西部大开发', color: '#ff4d4f' },
    { year: '2012', name: '生态文明建设', color: '#52c41a' },
    { year: '2020', name: '双碳目标', color: '#1890ff' }
];

// 智能诊断逻辑
const insights = computed(() => {
    if (!props.seriesData || props.seriesData.length < 2) return null;

    const first = props.seriesData[0];
    const last = props.seriesData[props.seriesData.length - 1];
    const years = last.year - first.year;

    // 计算各类型变化
    const changes = Object.keys(landTypeMap).map(key => {
        const diff = last[key] - first[key];
        const rate = first[key] > 0 ? (diff / first[key]) / years : 0;
        return { key, diff, rate, name: landTypeMap[key] };
    });

    // 找到变化绝对值最大的
    const mostChanged = [...changes].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];

    // 生成总结
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

    const resizeObserver = new ResizeObserver(() => {
        if (chartInstance.value) chartInstance.value.resize()
    })
    resizeObserver.observe(chartContainer.value)
    chartInstance.value._resizeObserver = resizeObserver
}

const updateChart = () => {
    if (!chartInstance.value || !props.seriesData.length) return

    const years = props.seriesData.map(d => d.year).sort((a, b) => a - b);
    const keys = Object.keys(landTypeMap);

    const grids = [];
    const xAxes = [];
    const yAxes = [];
    const series = [];
    const titles = [];

    const cols = 3;
    const rows = 3;
    const leftMargin = 5;
    const rightMargin = 5;
    const topMargin = 5;
    const bottomMargin = 12;
    const hGap = 6;
    const vGap = 10;

    const gridWidth = (100 - leftMargin - rightMargin - hGap * (cols - 1)) / cols;
    const gridHeight = (100 - topMargin - bottomMargin - vGap * (rows - 1)) / rows;

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
            containLabel: false
        });

        titles.push({
            text: landTypeMap[key],
            left: (left + gridWidth / 2) + '%',
            top: (top - 4) + '%',
            textAlign: 'center',
            textStyle: { color: '#00E5FF', fontSize: 13, fontWeight: 'bold' }
        });

        xAxes.push({
            gridIndex: index,
            type: 'category',
            boundaryGap: false,
            data: years,
            axisLabel: {
                show: r === rows - 1,
                color: '#fff',
                fontSize: 10,
                margin: 12,
                interval: 2,
                rotate: 45
            },
            axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } }
        });

        yAxes.push({
            gridIndex: index,
            type: 'value',
            scale: true,
            name: 'km²',
            nameTextStyle: { color: '#888', fontSize: 10 },
            axisLabel: {
                color: '#fff',
                fontSize: 9,
                formatter: (value) => value >= 10000 ? (value / 10000).toFixed(1) + '万' : value.toFixed(0)
            },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
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
            showSymbol: true,
            symbolSize: 3,
            smooth: false,
            itemStyle: { color: landUseColors[key] },
            lineStyle: { width: 2, shadowBlur: 5, shadowColor: 'rgba(0,0,0,0.5)' },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: landUseColors[key] + '44' },
                    { offset: 1, color: landUseColors[key] + '00' }
                ])
            },
            // 标记政策节点
            markLine: {
                silent: true,
                symbol: ['none', 'none'],
                label: { show: false },
                data: policyMarkers.map(p => ({
                    xAxis: p.year,
                    lineStyle: { color: p.color, type: 'dashed', opacity: 0.5 }
                }))
            },
            animationDelay: (idx) => idx * 30
        });
    });

    const option = {
        backgroundColor: 'transparent',
        animationDuration: 2000,
        tooltip: {
            trigger: 'axis',
            confine: true,
            appendToBody: true,
            backgroundColor: 'rgba(20, 30, 60, 0.95)',
            borderColor: '#345',
            borderWidth: 1,
            textStyle: { color: '#fff', fontSize: 12 },
            formatter: function (params) {
                const year = params[0].axisValue;
                const policy = policyMarkers.find(p => p.year === year);
                let html = `<div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #456; padding-bottom:5px;">`;
                html += `${year}年 ${policy ? `<span style="color:${policy.color}; font-size:11px;">[${policy.name}]</span>` : ''}`;
                html += `</div>`;

                params.sort((a, b) => b.value - a.value).forEach(item => {
                    const val = item.value;
                    const areaStr = val >= 10000 ? (val / 10000).toFixed(2) + ' 万km²' : val.toFixed(2) + ' km²';
                    html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:3px 0; min-width:180px;">
            <span style="display:flex; align-items:center;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${item.color}; margin-right:8px;"></span>
              ${item.seriesName}
            </span>
            <span style="font-weight:bold; margin-left:15px; font-family:monospace;">${areaStr}</span>
          </div>`;
                });
                return html;
            }
        },
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series: series
    };

    chartInstance.value.setOption(option, true);
}

onMounted(() => {
    nextTick(() => {
        initChart()
        updateChart()
    })
})

onUnmounted(() => {
    if (chartInstance.value) {
        if (chartInstance.value._resizeObserver) chartInstance.value._resizeObserver.disconnect()
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
    gap: 20px;
}

.insight-panel {
    display: flex;
    gap: 15px;
    padding: 0 10px;
}

.insight-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 16px;
}

.insight-card.main {
    flex: 2;
    border-left: 4px solid #00E5FF;
}

.insight-grid {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.insight-card.mini {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
}

.insight-title {
    color: #00E5FF;
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 14px;
}

.insight-content {
    color: #ccc;
    font-size: 13px;
    line-height: 1.5;
}

.label {
    color: #888;
    font-size: 11px;
    margin-bottom: 4px;
}

.value {
    color: #fff;
    font-weight: bold;
    font-size: 16px;
}

.value.up {
    color: #ff4d4f;
}

.value.down {
    color: #52c41a;
}

.chart-container {
    flex: 1;
    width: 100%;
    min-height: 500px;
}
</style>
