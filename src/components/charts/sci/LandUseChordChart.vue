<template>
  <div class="chord-chart-wrapper">
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
import { transformMatrixToChordData } from '../../../utils/sci_indices.ts';

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);
const selectedPeriod = ref('1990-2020');
const periods = ref(['1990-2000', '2000-2010', '2010-2020', '1990-2020']);

const landUseColors = {
  'Cropland': '#FAE39C',
  'Forest': '#446F33',
  'Shrub': '#33A02C',
  'Grassland': '#ABD37B',
  'Water': '#1E69B4',
  'Snow/Ice': '#A6CEE3',
  'Barren': '#CFBDA3',
  'Impervious': '#E24290',
  'Wetland': '#2899E8'
};

const landUseNames = {
  'Cropland': '耕地',
  'Forest': '林地',
  'Shrub': '灌木',
  'Grassland': '草地',
  'Water': '水域',
  'Snow/Ice': '冰雪',
  'Barren': '裸地',
  'Impervious': '建设',
  'Wetland': '湿地'
};

async function fetchDataAndRender() {
  try {
    const res = await analysisApi.getTransferMatrix(selectedPeriod.value);
    const matrix = res.absoluteMatrix;
    const types = res.landTypes;

    const { nodes, links } = transformMatrixToChordData(matrix, types);

    // 格式化节点和连线以适配 ECharts Graph
    const graphNodes = nodes.map(n => ({
      name: landUseNames[n.name] || n.name,
      value: n.value,
      itemStyle: { color: landUseColors[n.name] || '#ccc' },
      label: { show: true, position: 'right', color: '#fff', fontSize: 10 }
    }));

    const graphLinks = links.map(l => ({
      source: landUseNames[l.source] || l.source,
      target: landUseNames[l.target] || l.target,
      value: l.value,
      lineStyle: {
        color: 'source',
        opacity: 0.3,
        curveness: 0.3
      }
    }));

    renderChart(graphNodes, graphLinks);

  } catch (e) {
    console.error('加载弦图数据失败:', e);
  }
}

function renderChart(nodes, links) {
  if (!chartContainer.value) return;

  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartContainer.value, null, {
      renderer: 'canvas'
    });
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}: ${params.data.value.toFixed(0)} km²`;
        }
        return `${params.name}: ${params.value.toFixed(0)} km² (流出总量)`;
      }
    },
    series: [
      {
        type: 'graph',
        layout: 'circular',
        circular: {
          rotateLabel: true
        },
        data: nodes,
        links: links,
        roam: true,
        label: {
          position: 'right',
          formatter: '{b}'
        },
        lineStyle: {
          color: 'source',
          curveness: 0.3
        },
        emphasis: {
          lineStyle: {
            width: 4
          }
        }
      }
    ]
  };

  chartInstance.value.setOption(option);
}

function handleResize() {
  chartInstance.value?.resize();
}

const props = defineProps({
  year: { type: Number, default: 2023 }
});

watch(() => props.year, (newYear) => {
  let targetPeriod = '1990-2020';
  if (newYear < 2000) targetPeriod = '1990-2000';
  else if (newYear < 2010) targetPeriod = '2000-2010';
  else if (newYear < 2020) targetPeriod = '2010-2020';
  else targetPeriod = '1990-2020';

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
.chord-chart-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
}

.controls {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.period-select {
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.chart-container {
  flex: 1;
  min-height: 300px;
}
</style>
