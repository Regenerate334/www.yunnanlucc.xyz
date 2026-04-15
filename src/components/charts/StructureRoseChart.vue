<!--
  @component StructureRoseChart
  @description 土地利用结构南丁格尔玫瑰图，以极坐标形式展示各类地类的面积占比与分布平衡
  @props data (地类数据数组)
  @emits 无
  @dependencies ECharts
-->
<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../api/index.js';
import { transformDataForCalculation } from '../../utils/indices.ts';

const props = defineProps({
  year: { type: Number, default: 2023 },
  regionName: { type: String, default: '云南省' },
  level: { type: String, default: 'province' }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

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

const landUseNames = {
  'cropland': '耕地',
  'forest': '林地',
  'shrub': '灌木',
  'grassland': '草地',
  'water': '水域',
  'snow_ice': '冰雪',
  'barren': '裸地',
  'impervious': '建设用地',
  'wetland': '湿地'
};

async function fetchDataAndRender() {
  try {
    let data;
    if (props.level === 'province') {
      data = await clcdApi.getYearSummary(props.year);
    } else {
      // 针对地市或县级，先获取该区域所有年份数据，再筛选目标年份
      let regData;
      if (props.level === 'prefecture') {
        regData = await clcdApi.getPrefectureDataByName(props.regionName);
      } else {
        regData = await clcdApi.getCountyDataByName(props.regionName);
      }
      
      if (regData && Array.isArray(regData)) {
        data = regData.find(d => Number(d.year) === Number(props.year));
      }
    }

    if (!data) {
      console.warn(`[StructureRoseChart] No data for ${props.regionName} in ${props.year}`);
      return;
    }

    // 转换数据格式
    const types = Object.keys(landUseNames);
    const chartData = types.map(key => ({
      name: landUseNames[key],
      value: Number(data[key]) || 0,
      itemStyle: { color: landUseColors[key] }
    })).filter(item => item.value > 0).sort((a, b) => b.value - a.value);

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

watch([() => props.year, () => props.regionName, () => props.level], () => {
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
