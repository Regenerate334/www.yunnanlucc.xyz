<template>
    <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
    currentData: { type: Object, default: () => ({}) },
    baseData: { type: Object, default: () => ({}) }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

const landTypes = {
    Cropland: { name: '耕地', color: '#eab308' },
    Forest: { name: '森林', color: '#22c55e' },
    Shrub: { name: '灌木', color: '#84cc16' },
    Grassland: { name: '草地', color: '#10b981' },
    Water: { name: '水域', color: '#3b82f6' },
    Snow_Ice: { name: '冰雪', color: '#cbd5e1' },
    Barren: { name: '荒地', color: '#94a3b8' },
    Impervious: { name: '建设', color: '#ef4444' },
    Wetland: { name: '湿地', color: '#06b6d4' }
};

function initChart() {
    if (!chartContainer.value) return;

    if (chartInstance.value) {
        chartInstance.value.dispose();
    }

    chartInstance.value = echarts.init(chartContainer.value, null, {
        renderer: 'canvas'
    });

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#3b82f6',
            textStyle: { color: '#fff' },
            formatter: (params) => {
                const item = params[0];
                const val = item.value;
                const sign = val > 0 ? '+' : '';
                return `${item.name}<br/>
                变化量: ${sign}${(val / 1000000).toFixed(2)} km²`;
            }
        },
        grid: {
            top: '12%',
            left: '2%',
            right: '8%',
            bottom: '0%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            position: 'top',
            splitLine: {
                show: true,
                lineStyle: { color: 'rgba(255, 255, 255, 0.1)', type: 'dashed' }
            },
            axisLabel: {
                color: '#94a3b8',
                fontSize: 10,
                formatter: (val) => (val / 1000000).toFixed(0)
            }
        },
        yAxis: {
            type: 'category',
            axisTick: { show: false },
            data: [],
            axisLabel: {
                color: '#e2e8f0',
                fontSize: 11,
                fontWeight: 'bold',
                interval: 0
            },
            axisLine: {
                show: true,
                lineStyle: { color: 'rgba(255, 255, 255, 0.2)' }
            }
        },
        series: [
            {
                name: '变化量',
                type: 'bar',
                data: [],
                label: {
                    show: true,
                    position: 'right',
                    formatter: (params) => {
                        const val = params.value / 1000000;
                        return val > 0 ? `+${val.toFixed(0)}` : val.toFixed(0);
                    },
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: '#fff'
                },
                barWidth: '50%'
            }
        ]
    };

    chartInstance.value.setOption(option);
}

function updateChart() {
    if (!chartInstance.value || !props.currentData || !props.baseData) return;

    const changes = [];
    Object.keys(landTypes).forEach(key => {
        const current = props.currentData[key] || 0;
        const base = props.baseData[key] || 0;
        const diff = current - base;

        changes.push({
            name: landTypes[key].name,
            value: diff,
            rawType: key
        });
    });

    // 按变化量绝对值排序
    changes.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    // 计算最大绝对值，用于设置对称量程
    const maxVal = Math.max(...changes.map(c => Math.abs(c.value)));
    // 稍微扩大一点量程，避免标签被截断
    const limit = maxVal * 1.2;

    const yData = changes.map(c => c.name);
    const seriesData = changes.map(c => ({
        value: c.value,
        itemStyle: {
            color: c.value >= 0 ? '#ef4444' : '#10b981', // 红涨绿跌
            borderRadius: c.value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4]
        },
        label: {
            position: c.value >= 0 ? 'right' : 'left'
        }
    }));

    chartInstance.value.setOption({
        xAxis: {
            min: -limit,
            max: limit
        },
        yAxis: {
            data: yData,
            axisLabel: { interval: 0 } // 强制显示所有标签
        },
        series: [{
            data: seriesData
        }]
    });
}

function handleResize() {
    chartInstance.value?.resize();
}

onMounted(() => {
    initChart();
    if (props.currentData && props.baseData) {
        updateChart();
    }
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    if (chartInstance.value) {
        chartInstance.value.dispose();
        chartInstance.value = null;
    }
});

watch(() => [props.currentData, props.baseData], () => {
    updateChart();
}, { deep: true });

</script>

<style scoped>
.chart-container {
    width: 100%;
    height: 100%;
    min-height: 150px;
}
</style>
