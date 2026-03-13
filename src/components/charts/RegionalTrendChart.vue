<template>
    <div class="regional-trend-container">
        <!-- 移除诊断面板和次级标题，已提升至主标题 -->

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
const aiProcessing = ref(false)

// 恢复原始诊断状态
const mainFluctuationType = ref('')
const averageChangeRate = ref(0)
const synthesisJudgement = ref('')

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

// 恢复本地诊断逻辑
const performLocalAnalysis = () => {
    if (!props.seriesData.length) return;
    
    aiProcessing.value = true;
    
    setTimeout(() => {
        const first = props.seriesData[0];
        const last = props.seriesData[props.seriesData.length - 1];
        const years = props.seriesData.length;
        
        let maxChange = 0;
        let mainType = '';
        
        Object.keys(landTypeMap).forEach(key => {
            const diff = Math.abs(last[key] - first[key]);
            if (diff > maxChange) {
                maxChange = diff;
                mainType = landTypeMap[key];
            }
        });
        
        mainFluctuationType.value = mainType;
        averageChangeRate.value = maxChange / (first.cropland + first.forest + 1) / years;
        
        if (averageChangeRate.value > 0.01) {
            synthesisJudgement.value = '地类转换剧烈，生态格局发生显著偏移';
        } else {
            synthesisJudgement.value = '结构相对稳定，呈现良性演化趋势';
        }
        
        aiProcessing.value = false;
    }, 1500);
}

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
    const leftMargin = 3;
    const topMargin = 5;
    const bottomMargin = 8;
    const hGap = 4;
    const vGap = 8;

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
                fontSize: 14,
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
                fontSize: 12,
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
                fontSize: 11,
                formatter: (value) => value.toLocaleString('en-US')
            },
            splitLine: { lineStyle: { color: 'rgba(255,255,255,0.03)' } },
            axisLine: { show: false },
            name: index % cols === 0 ? 'km²' : '',
            nameTextStyle: {
                color: 'rgba(165, 204, 255, 0.4)',
                fontSize: 12,
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
                fontSize: 12,
                fontWeight: 'bold',
                distance: 8,
                formatter: (params) => params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
                    const areaStr = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km²';
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

const handleResize = () => {
    if (chartInstance.value) chartInstance.value.resize();
};

onMounted(() => {
    nextTick(() => {
        initChart();
        window.addEventListener('resize', handleResize);
        performLocalAnalysis();
    });
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    if (chartInstance.value) chartInstance.value.dispose();
});

watch(() => props.seriesData, () => {
    updateChart();
    performLocalAnalysis();
}, { deep: false });
</script>

<style scoped>
.regional-trend-container {
    width: 100%; height: 100%;
    display: flex; flex-direction: column; gap: 15px;
}

.panel-header {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.title-group { font-size: 18px; font-weight: 600; color: #fff; }
.region-name { color: #3b82f6; background: rgba(59, 130, 246, 0.1); padding: 2px 10px; border-radius: 6px; }

.ai-status { font-size: 12px; color: #60a5fa; display: flex; align-items: center; gap: 8px; }
.pulse-dot { width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; box-shadow: 0 0 10px #3b82f6; animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }

.insight-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
}

.insight-card {
    background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 12px; border-radius: 10px;
}
.insight-card.highlight { background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2); }

.card-label { font-size: 11px; color: rgba(255, 255, 255, 0.5); margin-bottom: 4px; }
.card-value { font-size: 15px; font-weight: 700; color: #a5ccff; }
.status-text { color: #60a5fa; }

.chart-container {
    flex: 1; min-height: 500px;
    background: rgba(0, 0, 0, 0.1); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.03);
}
</style>
