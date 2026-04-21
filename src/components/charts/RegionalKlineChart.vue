<!--
  @component RegionalKlineChart
  @description 区域地类变化 K 线图，采用官方专业级 K 线配置展示地类面积演化
  @props regionName (区域名称), seriesData (时间序列数据)
  @emits 无
  @dependencies ECharts
-->
<template>
    <div class="regional-kline-container">
        <!-- 核心控制区：地类切换器 -->
        <div class="selection-bar">
            <button 
                v-for="(label, key) in landUseNames" 
                :key="key"
                :class="['switch-btn', { active: activeLandType === key }]"
                @click="switchLandType(key)"
            >
                {{ label }}
            </button>
        </div>

        <div ref="chartContainer" class="chart-container"></div>
    </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
    regionName: String,
    seriesData: {
        type: Array,
        default: () => []
    }
})

const chartContainer = shallowRef(null)
const chartInstance = shallowRef(null)
const activeLandType = ref('cropland');

const landUseNames = {
  cropland: '耕地',
  forest: '林地',
  shrubland: '灌木地',
  grassland: '草地',
  water: '水体',
  wetland: '湿地',
  impervious: '建设用地',
  bareland: '裸地',
  tundra: '冻土'
};

const typeMapping = {
    cropland: 'cropland', forest: 'forest', shrubland: 'shrub',
    grassland: 'grassland', water: 'water', wetland: 'wetland',
    impervious: 'impervious', bareland: 'barren', tundra: 'snow_ice'
};

// 官方色值
// 官方色值调整：绿色增长良好，红色减少警示
const upColor = '#22c55e'; // 增长绿（符合生态评估惯例）
const downColor = '#ef4444'; // 减少红

const policyMarkers = [
    { year: '1999', name: '首轮退耕还林工程启动', color: '#52c41a', relevantTypes: ['cropland', 'forest'] },
    { year: '2000', name: '西部大开发战略实施', color: '#722ed1', relevantTypes: ['impervious'] },
    { year: '2010', name: '低丘缓坡土地综合开发试点', color: '#faad14', relevantTypes: ['impervious', 'shrub'] },
    { year: '2017', name: '云南省高速公路“能通全通”工程', color: '#eb2f96', relevantTypes: ['impervious'] },
    { year: '2018', name: '滇中引水工程全面开工', color: '#1890ff', relevantTypes: ['water', 'impervious'] },
    { year: '2021', name: '白鹤滩水电站下闸蓄水', color: '#13c2c2', relevantTypes: ['water'] },
    { year: '2022', name: '耕地“非农化、非粮化”整治', color: '#a0d911', relevantTypes: ['cropland', 'forest', 'shrub'] }
];

const initChart = () => {
    if (!chartContainer.value) return
    chartInstance.value = echarts.init(chartContainer.value)
    updateChart()
}

// 辅助函数：计算均线
function calculateMA(dayCount, data) {
    var result = [];
    for (var i = 0, len = data.values.length; i < len; i++) {
        if (i < dayCount) {
            result.push('-');
            continue;
        }
        var sum = 0;
        for (var j = 0; j < dayCount; j++) {
            sum += data.values[i - j][1]; // 取收盘价（当前值）
        }
        result.push(+(sum / dayCount).toFixed(3));
    }
    return result;
}

// 辅助函数：计算线性回归
function calculateRegression(years, values) {
    const n = years.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        const x = i;
        const y = values[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return years.map((y, i) => +(slope * i + intercept).toFixed(3));
}

const updateChart = () => {
    if (!chartInstance.value || !props.seriesData.length) return

    // 1. 数据去重与年度汇总：防止同一区域年份数据重复导致的图表重叠与视觉混乱
    const years = [...new Set(props.seriesData.map(d => Number(d.year)))].sort((a, b) => a - b);
    const dbKey = typeMapping[activeLandType.value];
    
    // 预处理汇总数据：对于同一年的多个条目，取最大值（避免零值干扰）
    const consolidatedData = years.map(year => {
        const matchingRecords = props.seriesData.filter(d => Number(d.year) === year);
        const maxVal = Math.max(...matchingRecords.map(r => Number(r[dbKey]) || 0));
        return { year, value: maxVal };
    });

    let categoryData = [];
    let values = [];
    let volumes = [];

    for (let i = 0; i < consolidatedData.length; i++) {
        const current = (Number(consolidatedData[i].value) || 0) / 1000000;
        const prev = i > 0 ? (Number(consolidatedData[i - 1].value) || 0) / 1000000 : current;
        
        categoryData.push(consolidatedData[i].year.toString());
        // [开盘(上期), 收盘(本期), 最低, 最高]
        const kValues = [prev, current, Math.min(prev, current), Math.max(prev, current)];
        values.push(kValues);
        // [索引, 净盈亏, 方向(1升,-1降)]
        volumes.push([i, current - prev, current >= prev ? 1 : -1]);
    }

    const data = { categoryData, values, volumes };

    const option = {
        animation: true,
        animationDuration: 1500,
        animationEasing: 'quinticInOut',
        backgroundColor: 'transparent',
        legend: {
            bottom: 0,
            left: 'center',
            itemGap: 15,
            selectedMode: false,
            data: [
                { name: '面积增加', icon: 'roundRect', itemStyle: { color: upColor } },
                { name: '面积减少', icon: 'roundRect', itemStyle: { color: downColor } },
                { name: '5年均线' },
                { name: '10年均线' },
                { name: '趋势回归' }
            ],
            textStyle: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11 }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: 'rgba(255, 255, 255, 0.2)', type: 'solid' } },
            backgroundColor: 'rgba(13, 25, 48, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 10,
            textStyle: { color: '#fff' },
            position: function (pos, params, el, elRect, size) {
                // Tooltip 贴合顶部并随水平移动，防止遮挡 K 线
                return [pos[0] - size.contentSize[0] / 2, 10];
            },
            formatter: (params) => {
                const year = params[0].name;
                const matchedPolicies = policyMarkers.filter(p => p.year.toString() === year.toString());
                const activeLabel = landUseNames[activeLandType.value];

                let html = `<div style="font-weight:600; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px; color:#a5ccff; display:flex; justify-content:space-between; align-items:center; gap:20px;">`;
                html += `<span>${year}年 ${activeLabel} 演化监测</span>`;
                if (matchedPolicies.length > 0) {
                    html += `<div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">`;
                    matchedPolicies.forEach(p => {
                        html += `<span style="color:${p.color}; font-size:11px; background:${p.color}22; padding:1px 8px; border-radius:4px; border:1px solid ${p.color}44;">${p.name}</span>`;
                    });
                    html += `</div>`;
                }
                html += `</div>`;

                // 核心指标提取
                const kLine = params.find(p => p.seriesName === '面积演化');
                const ma3 = params.find(p => p.seriesName === '3年均线');
                const ma5 = params.find(p => p.seriesName === '5年均线');
                const ma10 = params.find(p => p.seriesName === '10年均线');

                if (kLine) {
                    const prev = kLine.value[1]; // 开盘即上期
                    const current = kLine.value[2]; // 收盘即本期
                    const diff = current - prev;
                    const diffColor = diff >= 0 ? upColor : downColor;
                    const diffSign = diff >= 0 ? '+' : '';
                    const rate = prev > 0 ? (diff / prev * 100).toFixed(2) : '0.00';
                    
                    const firstVal = values[0][1];
                    const totalDiff = current - firstVal;
                    const totalSign = totalDiff >= 0 ? '+' : '';

                    html += `<div style="margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; font-size:14px; margin:4px 0; color:#fff;">
                                    <span>当前面积:</span>
                                    <span style="font-family:monospace; font-weight:700;">${current.toLocaleString('en-US', { minimumFractionDigits: 3 })} km²</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:12px; margin:4px 0; color:rgba(255,255,255,0.7);">
                                    <span>年度净盈亏:</span>
                                    <span style="font-family:monospace; color:${diffColor}; font-weight:700;">${diffSign}${diff.toLocaleString('en-US', { minimumFractionDigits: 3 })} km² (${diffSign}${rate}%)</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px; margin:4px 0; color:rgba(165,204,255,0.5);">
                                    <span>历史累计变动:</span>
                                    <span style="font-family:monospace;">${totalSign}${totalDiff.toLocaleString('en-US', { minimumFractionDigits: 3 })} km²</span>
                                </div>
                             </div>`;
                }

                // 均线指标
                const renderMA = (p, label) => {
                    if (!p || p.value === '-' || p.value === undefined) return '';
                    const val = Array.isArray(p.value) ? p.value[1] : p.value;
                    return `<div style="display:flex; justify-content:space-between; font-size:12px; margin:3px 0; color:rgba(255,255,255,0.6);">
                                <span>${label}:</span>
                                <span style="font-family:monospace; color:${p.color};">${val.toLocaleString('en-US', { minimumFractionDigits: 3 })} km²</span>
                            </div>`;
                };

                html += `<div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:8px;">`;
                html += renderMA(ma5, '5年周期均值');
                html += renderMA(ma10, '10年周期均值');
                html += `</div>`;

                return html;
            }
        },
        axisPointer: {
            link: [{ xAxisIndex: 'all' }],
            label: { backgroundColor: '#334155' }
        },
        visualMap: {
            show: false,
            seriesIndex: 6,
            dimension: 2,
            pieces: [
                { value: 1, color: upColor }, 
                { value: -1, color: downColor } 
            ]
        },
        grid: [
            { left: '8%', right: '5%', top: '2%', height: '70%' }, 
            { left: '8%', right: '5%', top: '75%', height: '18%' }  /* Optimized for more area */
        ],
        xAxis: [
            {
                type: 'category',
                data: data.categoryData,
                boundaryGap: false,
                axisLine: { onZero: false, lineStyle: { color: 'rgba(255,255,255,0.2)' } },
                splitLine: { show: false },
                axisLabel: { color: 'rgba(255,255,255,0.6)' },
                min: 'dataMin',
                max: 'dataMax'
            },
            {
                type: 'category',
                gridIndex: 1,
                data: data.categoryData,
                boundaryGap: false,
                axisLine: { onZero: false, lineStyle: { color: 'rgba(255, 255, 255, 0.2)' } },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { show: false },
                min: 'dataMin',
                max: 'dataMax'
            }
        ],
        yAxis: [
            {
                scale: true,
                axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
                axisLabel: { color: 'rgba(255,255,255,0.6)' },
                splitArea: { show: false }, // 移除背景条纹
                splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            {
                scale: false,
                gridIndex: 1,
                splitNumber: 2,
                axisLabel: { show: false },
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { show: false }
            }
        ],
        series: [
            {
                name: '面积演化',
                type: 'candlestick',
                data: data.values,
                itemStyle: {
                    color: upColor,
                    color0: downColor,
                    borderColor: upColor,
                    borderColor0: downColor
                },
                animationDelay: function (idx) {
                    return idx * 25;
                },
                markLine: {
                    symbol: ['none', 'none'],
                    label: { 
                        show: false // 取消静态标注
                    },
                    lineStyle: { type: 'dashed', opacity: 0.6, width: 1.5 }, // 增加可见程度
                    emphasis: { lineStyle: { opacity: 1, width: 2 } },
                    data: policyMarkers
                        .map(p => ({
                            xAxis: p.year,
                            name: p.name,
                            lineStyle: { color: p.color }
                        }))
                }
            },
            { name: '面积增加', type: 'bar', data: [], itemStyle: { color: upColor } },
            { name: '面积减少', type: 'bar', data: [], itemStyle: { color: downColor } },
            {
                name: '5年均线', type: 'line', data: calculateMA(5, data),
                smooth: true, showSymbol: false, symbol: 'circle',
                lineStyle: { opacity: 0.8, width: 2, color: '#facc15' },
                itemStyle: { color: '#fff', borderColor: '#facc15', borderWidth: 2 },
                animationDelay: function (idx) {
                    return idx * 25 + 800;
                }
            },
            {
                name: '趋势回归', type: 'line', 
                data: calculateRegression(categoryData, values.map(v => v[1])),
                smooth: false, showSymbol: false,
                lineStyle: { opacity: 0.6, width: 2, color: '#00f2fe', type: 'dashed' },
                z: 5,
                animationDelay: function (idx) {
                    return idx * 25 + 1000;
                }
            },
            {
                name: '10年均线', type: 'line', data: calculateMA(10, data),
                smooth: true, showSymbol: false, symbol: 'circle',
                lineStyle: { opacity: 0.8, width: 2, color: '#3b82f6' },
                itemStyle: { color: '#fff', borderColor: '#3b82f6', borderWidth: 2 },
                animationDelay: function (idx) {
                    return idx * 25 + 1200;
                }
            },
            {
                name: '年度盈亏',
                type: 'bar',
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: data.volumes,
                markLine: {
                    silent: true,
                    symbol: ['none', 'none'],
                    label: { show: false },
                    data: [{ yAxis: 0, lineStyle: { color: 'rgba(255,255,255,0.3)', type: 'solid' } }]
                },
                animationDelay: function (idx) {
                    return idx * 25 + 500;
                }
            }
        ]
    };

    chartInstance.value.setOption(option, true);
}

const switchLandType = (typeKey) => {
    activeLandType.value = typeKey;
    updateChart();
};

const handleResize = () => {
    if (chartInstance.value) chartInstance.value.resize();
};

onMounted(() => {
    nextTick(() => {
        initChart();
        window.addEventListener('resize', handleResize);
    });
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    if (chartInstance.value) chartInstance.value.dispose();
});

watch(() => props.seriesData, () => {
    updateChart();
}, { deep: false });
</script>

<style scoped>
.regional-kline-container {
    width: 100%; height: 100%;
    display: flex; flex-direction: column;
}

.selection-bar {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
    padding: 2px 0 12px 0; /* 压缩顶部间距，贴近顶部边框 */
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.switch-btn {
    padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.03); color: rgba(255, 255, 255, 0.75);
    font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s;
}

.switch-btn:hover { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.4); color: #fff; }
.switch-btn.active { background: #3b82f6; border-color: #3b82f6; color: #fff; box-shadow: 0 0 12px rgba(59, 130, 246, 0.4); }

.chart-container {
    flex: 1; width: 100%;
    background: transparent;
    padding-top: 10px;
}
</style>
