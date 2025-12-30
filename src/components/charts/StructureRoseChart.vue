<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../api/index.js';
import { transformDataForCalculation } from '../../utils/indices.ts';

const props = defineProps({
  year: { type: Number, default: 2023 }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

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
  'Impervious': '建设用地',
  'Wetland': '湿地'
};

async function fetchDataAndRender() {
  try {
    const data = await clcdApi.getYearSummary(props.year);
    if (!data) return;

    const transformed = transformDataForCalculation(data);
    const chartData = Object.keys(transformed).map(key => ({
      name: landUseNames[key] || key,
      value: transformed[key],
      itemStyle: { color: landUseColors[key] }
    })).sort((a, b) => b.value - a.value);

    renderChart(chartData);

  } catch (e) {
    console.error('加载玫瑰图数据失败:', e);
  }
}

function renderChart(data) {
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
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatter: '{b}: {c} km² ({d}%)'
    },
    legend: {
      show: false 
    },
    series: [
      {
        name: '土地利用结构',
        type: 'pie',
        radius: [20, 100],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: {
          borderRadius: 5
        },
        label: {
          show: true,
          color: '#fff',
          formatter: '{b}'
        },
        data: data
      }
    ]
  };

  chartInstance.value.setOption(option);
}

function handleResize() {
  chartInstance.value?.resize();
}

onMounted(async () => {
  await fetchDataAndRender();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

watch(() => props.year, () => {
  fetchDataAndRender();
});

</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 250px;
}
</style>
