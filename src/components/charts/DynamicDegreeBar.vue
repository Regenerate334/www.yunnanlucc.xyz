<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../api/index.js';
import { calculateComprehensiveDynamicDegree, transformDataForCalculation } from '../../utils/indices.ts';

const props = defineProps({
  startYear: { type: Number, default: 1990 },
  endYear: { type: Number, default: 2020 },
  data: { type: Array, default: null }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);
const rankingData = ref([]);

async function fetchDataAndCalculate() {
  if (props.data) {
    rankingData.value = props.data;
    updateChart();
    return;
  }
  try {
    // 获取所有地级市数据
    // 注意：如果数据量大，后续应优化为只获取指定年份
    const allData = await clcdApi.getAllPrefectureData();
    
    // 按城市分组
    const cityMap = {};
    allData.forEach(item => {
      const name = item.region_name;
      if (!cityMap[name]) cityMap[name] = {};
      cityMap[name][item.year] = item;
    });

    const results = [];
    const years = props.endYear - props.startYear;

    if (years <= 0) return;

    Object.keys(cityMap).forEach(cityName => {
      const startRecord = cityMap[cityName][props.startYear];
      const endRecord = cityMap[cityName][props.endYear];

      if (startRecord && endRecord) {
        const startData = transformDataForCalculation(startRecord);
        const endData = transformDataForCalculation(endRecord);
        
        const lc = calculateComprehensiveDynamicDegree(startData, endData, years);
        
        // 过滤掉非法的数值
        if (!isNaN(lc) && isFinite(lc)) {
           results.push({
            name: cityName.replace('市', '').replace('自治州', '').replace('地区', ''), // 简化名称
            value: parseFloat(lc.toFixed(2)),
            fullValue: lc
          });
        }
      }
    });

    // 排序并取前10
    rankingData.value = results.sort((a, b) => b.fullValue - a.fullValue).slice(0, 10);
    
    updateChart();

  } catch (e) {
    console.error('计算动态度失败:', e);
  }
}

function initChart() {
  if (!chartContainer.value) return;

  chartInstance.value = echarts.init(chartContainer.value, null, {
    renderer: 'canvas'
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatter: '{b}: {c}%'
    },
    grid: {
      top: '10%',
      left: '3%',
      right: '10%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '动态度(%)',
      nameTextStyle: { color: '#a5ccff' },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      axisLabel: { color: '#fff' }
    },
    yAxis: {
      type: 'category',
      data: [],
      axisLabel: { 
        color: '#fff',
        interval: 0
      },
      inverse: true // 排名高的在上面
    },
    series: [
      {
        name: '综合动态度',
        type: 'bar',
        data: [],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#06b6d4' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#fff',
          formatter: '{c}%'
        },
        animationDuration: 1000,
        animationEasing: 'cubicOut'
      }
    ]
  };

  chartInstance.value.setOption(option);
}

function updateChart() {
  if (!chartInstance.value) return;

  const names = rankingData.value.map(item => item.name);
  const values = rankingData.value.map(item => item.value);

  chartInstance.value.setOption({
    yAxis: { data: names },
    series: [{ data: values }]
  });
}

function handleResize() {
  chartInstance.value?.resize();
}

onMounted(async () => {
  initChart();
  await fetchDataAndCalculate();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  chartInstance.value?.dispose();
});

watch(() => [props.startYear, props.endYear], () => {
  fetchDataAndCalculate();
});

watch(() => props.data, (newData) => {
  if (newData) {
    rankingData.value = newData;
    updateChart();
  }
}, { immediate: true });

</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 250px;
}
</style>
