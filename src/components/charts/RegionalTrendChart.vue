<!--
  @component RegionalTrendChart
  @description 区域面积趋势折线图，展示单一或多类土地利用随年份的变化，并包含关键历史事件标注
  @props regionName (区域名称), level (行政等级), seriesData (趋势数据)
  @emits 无
  @dependencies ECharts
-->
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
    { year: '1999', name: '首轮退耕还林启动', color: '#52c41a' },
    { year: '2000', name: '西部大开发战略', color: '#722ed1' },
    { year: '2010', name: '低丘缓坡开发试点', color: '#faad14' },
    { year: '2012', name: '生态文明建设战略', color: '#13c2c2' },
    { year: '2018', name: '滇中引水工程开工', color: '#1890ff' },
    { year: '2021', name: '国土空间“一张图”', color: '#f5222d' }
];

// 恢复本地诊断逻辑
// 采用标准动态度逻辑进行本地诊断
const performLocalAnalysis = () => {
    if (!props.seriesData.length) return;
    
    aiProcessing.value = true;
    
    setTimeout(() => {
        const first = props.seriesData[0];
        const last = props.seriesData[props.seriesData.length - 1];
        const years = Number(last.year) - Number(first.year) || 1;
        
        let totalChange = 0;
        let totalStart = 0;
        let maxTypeChange = 0;
        let mainType = '';
        
        const keys = Object.keys(landTypeMap);
        keys.forEach(key => {
            const start = Number(first[key]) || 0;
            const end = Number(last[key]) || 0;
            const diff = Math.abs(end - start);
            totalChange += diff;
            totalStart += start;
            if (diff > maxTypeChange) {
                maxTypeChange = diff;
                mainType = landTypeMap[key];
            }
        });
        
        mainFluctuationType.value = mainType;
        // 采用综合动态度公式: LC = (Σ|ΔU| / 2ΣU) / T
        averageChangeRate.value = totalStart > 0 ? (totalChange / (2 * totalStart) / years) : 0;
        
        if (averageChangeRate.value > 0.005) { // 综合动态度 > 0.5% 通常认为变化显著
            synthesisJudgement.value = '地类转换较剧烈，景观格局活跃度高';
        } else {
            synthesisJudgement.value = '土地利用结构稳定，变化强度处于低水平';
        }
        
        aiProcessing.value = false;
    }, 1200);
}

const initChart = () => {
    if (!chartContainer.value) return
    chartInstance.value = echarts.init(chartContainer.value)
    updateChart()
}

const updateChart = () => {
    if (!chartInstance.value || !props.seriesData.length) return

    // 核心修复：提取唯一年份并去重，防止后端数据存在逻辑重复导致的“梳状”锯齿图
    const years = [...new Set(props.seriesData.map(d => Number(d.year)))].sort((a, b) => a - b);
    const keys = Object.keys(landTypeMap);

    chartInstance.value.clear();

    // 预处理汇总数据：对于同一年的多个条目，取最大值（避免零值干扰）
    const consolidatedData = years.map(year => {
        const matchingRecords = props.seriesData.filter(d => Number(d.year) === year);
        const aggregated = { year };
        keys.forEach(key => {
            aggregated[key] = Math.max(...matchingRecords.map(r => Number(r[key]) || 0));
        });
        return aggregated;
    });

    const yAxisBounds = {};
    keys.forEach(key => {
        const allValues = consolidatedData.map(d => (d[key] || 0) / 1000000);
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const range = max - min || 1;
        
        const visualGap = range * 0.08;
        const padding = range * 0.05;
        
        yAxisBounds[key] = {
            min: min - visualGap - padding,
            max: max + padding,
            visualGap: visualGap
        };
    });

    // ... (保持布局逻辑一致)
    const rows = 3;
    const cols = 3;
    const leftMargin = 1.0; 
    const topMargin = 3;   
    const bottomMargin = 4;
    const hGap = 1.5; 
    const vGap = 3;   

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
            containLabel: true,
            show: true, 
            borderColor: 'rgba(255, 255, 255, 0.05)', 
            borderWidth: 1
        });

        xAxes.push({
            gridIndex: index,
            type: 'category',
            data: years, 
            boundaryGap: true, 
            axisLabel: {
                show: r === rows - 1, 
                color: 'rgba(255,255,255,0.5)',
                fontSize: 9,
                margin: 8,
                interval: 0,
                hideOverlap: true,
                formatter: (value) => {
                    const year = Number(value);
                    return year % 5 === 0 || year === 1985 || year === 2023 ? year : '';
                }
            },
            axisTick: { show: r === rows - 1, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
            axisLine: { 
                show: true, 
                symbol: ['none', 'arrow'], 
                symbolSize: [8, 10],
                lineStyle: { color: 'rgba(255, 255, 255, 0.4)', width: 1.5 } 
            },
            splitLine: { show: false }
        });

        yAxes.push({
            gridIndex: index,
            type: 'value',
            min: yAxisBounds[key].min,
            max: yAxisBounds[key].max,
            axisLabel: {
                color: 'rgba(165, 204, 255, 0.5)',
                fontSize: 8,
                fontFamily: 'JetBrains Mono, monospace',
                width: 38, 
                overflow: 'truncate',
                formatter: (value) => value.toLocaleString('en-US')
            },
            axisLine: { 
                show: true, 
                symbol: ['none', 'arrow'], 
                symbolSize: [8, 10],
                lineStyle: { color: 'rgba(255, 255, 255, 0.4)', width: 1.5 } 
            },
            splitLine: {
                show: true,
                lineStyle: { color: 'rgba(255, 255, 255, 0.05)', type: 'dashed' } 
            },
            name: index % cols === 0 ? 'km²' : '',
            nameTextStyle: {
                color: 'rgba(165, 204, 255, 0.3)',
                fontSize: 8,
                align: 'right',
                padding: [0, 5, 0, 0]
            }
        });

        // 1. 背景柱状图层
        series.push({
            name: landTypeMap[key] + '_bar',
            type: 'bar',
            xAxisIndex: index,
            yAxisIndex: index,
            data: consolidatedData.map(d => {
                const val = (Number(d[key]) || 0) / 1000000;
                return val === 0 ? 0 : Math.max(0, val - yAxisBounds[key].visualGap);
            }),
            barWidth: '65%', 
            itemStyle: {
                color: landUseColors[key],
                opacity: 0.8, 
                borderRadius: [2, 2, 0, 0]
            },
            z: 1,
            silent: true
        });

        // 2. 趋势折线图层
        series.push({
            name: landTypeMap[key],
            type: 'line',
            xAxisIndex: index,
            yAxisIndex: index,
            data: consolidatedData.map(d => (Number(d[key]) || 0) / 1000000),
            showSymbol: true, 
            symbol: 'circle',
            symbolSize: 4,
            smooth: false, 
            sampling: 'lttb',
            itemStyle: { 
                color: landUseColors[key],
                borderWidth: 1,
                borderColor: '#fff' 
            },
            lineStyle: { 
                width: 2.5, 
                shadowBlur: 12, 
                shadowColor: 'rgba(0,0,0,0.5)',
                shadowOffsetY: 2 
            },
            z: 10, 
            endLabel: { show: false },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: landUseColors[key] + '11' }, // 极大弱化填充区，突出折线悬浮感
                    { offset: 1, color: landUseColors[key] + '00' }
                ])
            },
            markLine: {
                silent: true,
                symbol: ['none', 'none'],
                label: { show: false },
                data: policyMarkers.filter(p => Number(p.year) >= 1985 && Number(p.year) <= 2023).map(p => {
                    // 在类目轴中，如果年份不精确匹配，寻找最接近的类目
                    const targetYear = Number(p.year);
                    const closestYear = years.reduce((prev, curr) => 
                        Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
                    );
                    return {
                        xAxis: closestYear.toString(), // 匹配类目名
                        name: p.name,
                        lineStyle: { color: p.color, type: 'dashed', opacity: 0.5, width: 1.2 }
                    };
                })
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
                const filteredParams = params.filter(p => !p.seriesName.includes('_bar'));
                const record = props.seriesData.find(d => d.year.toString() === year.toString());
                const policy = policyMarkers.find(p => p.year.toString() === year.toString());

                let html = `<div style="font-weight:600; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; color:#a5ccff; display:flex; justify-content:space-between; align-items:center;">`;
                html += `<span>${year}年 ${props.level === 'province' ? '全省详情' : '区域详情'}</span>`;
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
                    // Use filteredParams to check if the current item is part of the hovered series (excluding bars)
                    const isCurrentGrid = filteredParams.some(p => p.seriesName === item.name);

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
            bottom: 0, // 极限贴合容器底部
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
    background: transparent; /* 移除背景色，解决横线/阶梯感 */
    border: none; /* 移除边框，防止产生多余隔断 */
}
</style>
