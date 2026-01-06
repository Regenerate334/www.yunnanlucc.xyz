<template>
    <div class="sankey-chart-wrapper">
        <div class="controls">
            <select v-model="selectedPeriod" @change="fetchDataAndRender" class="period-select">
                <option v-for="p in periods" :key="p" :value="p">{{ p }}</option>
            </select>
        </div>
        <div ref="chartContainer" class="chart-container"></div>
    </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { analysisApi } from '../../../api/index.js';

const props = defineProps({
    year: { type: Number, default: 2023 }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);
const selectedPeriod = ref('2022_2023');

// 动态生成所有年份区间（从 1985_1990 到 2022_2023）
const periods = ref([
    '1985_1990',
    ...Array.from({ length: 33 }, (_, i) => `${1990 + i}_${1991 + i}`)
]);

// 扩展的颜色映射
const landUseColors = {
    'Cropland': '#FAE39C', 'cropland': '#FAE39C', '耕地': '#FAE39C',
    'Forest': '#446F33', 'forest': '#446F33', '林地': '#446F33',
    'Shrub': '#33A02C', 'shrub': '#33A02C', '灌木': '#33A02C',
    'Grassland': '#ABD37B', 'grassland': '#ABD37B', '草地': '#ABD37B',
    'Water': '#1E69B4', 'water': '#1E69B4', '水域': '#1E69B4',
    'Snow/Ice': '#A6CEE3', 'snow_ice': '#A6CEE3', '冰雪': '#A6CEE3',
    'Barren': '#CFBDA3', 'barren': '#CFBDA3', '裸地': '#CFBDA3',
    'Impervious': '#E24290', 'impervious': '#E24290', '建设用地': '#E24290', '建设': '#E24290',
    'Wetland': '#2899E8', 'wetland': '#2899E8', '湿地': '#2899E8'
};

// 扩展的名称映射
const landUseNames = {
    'Cropland': '耕地', 'cropland': '耕地', '耕地': '耕地',
    'Forest': '林地', 'forest': '林地', '林地': '林地',
    'Shrub': '灌木', 'shrub': '灌木', '灌木': '灌木',
    'Grassland': '草地', 'grassland': '草地', '草地': '草地',
    'Water': '水域', 'water': '水域', '水域': '水域',
    'Snow/Ice': '冰雪', 'snow_ice': '冰雪', '冰雪': '冰雪',
    'Barren': '裸地', 'barren': '裸地', '裸地': '裸地',
    'Impervious': '建设', 'impervious': '建设', '建设用地': '建设', '建设': '建设',
    'Wetland': '湿地', 'wetland': '湿地', '湿地': '湿地'
};

function transformMatrixToSankeyData(matrix, types) {
    const nodes = [];
    const links = [];

    types.forEach(type => {
        const nameZh = landUseNames[type] || type;
        nodes.push({ name: `${nameZh} (始)`, itemStyle: { color: landUseColors[type] || '#ccc' } });
        nodes.push({ name: `${nameZh} (终)`, itemStyle: { color: landUseColors[type] || '#ccc' } });
    });

    types.forEach((srcType) => {
        types.forEach((targetType) => {
            if (srcType === targetType) return;
            let value = 0;
            if (typeof matrix === 'object' && !Array.isArray(matrix)) {
                value = (matrix[srcType] && matrix[srcType][targetType]) || 0;
            }
            // 过滤小于 0.1 km² 的转换（原始单位 m²，所以阈值是 100000 m²）
            if (value > 100000) {
                const srcName = landUseNames[srcType] || srcType;
                const targetName = landUseNames[targetType] || targetType;
                // 单位换算：m² → km²（除以 1,000,000）
                const valueInKm2 = value / 1000000;
                links.push({ source: `${srcName} (始)`, target: `${targetName} (终)`, value: parseFloat(valueInKm2.toFixed(2)) });
            }
        });
    });

    return { nodes, links };
}

async function fetchDataAndRender() {
    try {
        const res = await analysisApi.getTransferMatrix(selectedPeriod.value);
        console.log('[Sankey] API response:', res);
        if (!res || !res.absoluteMatrix) return;

        let types = res.landTypes;
        if (!types || types.length === 0) {
            types = Object.keys(res.absoluteMatrix);
        }
        if (types.length === 0) return;

        const { nodes, links } = transformMatrixToSankeyData(res.absoluteMatrix, types);
        console.log('[Sankey] nodes:', nodes.length, 'links:', links.length);
        renderChart(nodes, links);
    } catch (e) {
        console.error('加载桑基图数据失败:', e);
    }
}

function renderChart(nodes, links) {
    if (!chartContainer.value) return;
    if (!chartInstance.value) {
        chartInstance.value = echarts.init(chartContainer.value, null, { renderer: 'canvas' });
    }

    const option = {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            triggerOn: 'mousemove',
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            borderColor: '#3b82f6',
            textStyle: { color: '#fff', fontSize: 12 },
            formatter: (params) => {
                if (params.dataType === 'edge') {
                    return `${params.data.source} → ${params.data.target}<br/>流转面积: <b>${params.data.value}</b> km²`;
                }
                return `${params.name}`;
            }
        },
        series: [{
            type: 'sankey',
            left: '5%', right: '15%', top: '10%', bottom: '10%',
            layout: 'none',
            emphasis: { focus: 'adjacency' },
            data: nodes,
            links: links,
            lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.4 },
            label: { color: '#fff', fontSize: 10, distance: 10, formatter: (p) => p.name.replace(' (始)', '').replace(' (终)', '') },
            nodeGap: 8, nodeWidth: 15, draggable: true
        }]
    };
    chartInstance.value.setOption(option);
}

function handleResize() {
    chartInstance.value?.resize();
}

watch(() => props.year, (newYear) => {
    const prevYear = newYear - 1;
    let targetPeriod = `${prevYear}_${newYear}`;
    if (!periods.value.includes(targetPeriod)) {
        targetPeriod = periods.value[periods.value.length - 1];
    }
    if (selectedPeriod.value !== targetPeriod) {
        selectedPeriod.value = targetPeriod;
        fetchDataAndRender();
    }
});

onMounted(async () => {
    await fetchDataAndRender();
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    chartInstance.value?.dispose();
});
</script>

<style scoped>
.sankey-chart-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    flex-direction: column;
}

.controls {
    position: absolute;
    top: 5px;
    left: 5px;
    z-index: 10;
}

.period-select {
    background: rgba(15, 23, 42, 0.8);
    color: #a5ccff;
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    outline: none;
}

.chart-container {
    flex: 1;
    width: 100%;
    min-height: 200px;
}
</style>
