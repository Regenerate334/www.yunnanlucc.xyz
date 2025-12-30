<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../api/index.js';
import { calculateComprehensiveDynamicDegree, transformDataForCalculation } from '../../utils/indices.ts';

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

async function fetchDataAndRender() {
  try {
    const data = await clcdApi.getProvinceTrend();
    
    // 按年份排序
    data.sort((a, b) => a.year - b.year);

    const years = [];
    const values = [];

    // 计算逐年动态度 (相对于上一年)
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      
      const prevData = transformDataForCalculation(prev);
      const currData = transformDataForCalculation(curr);
      
      // 时间间隔为1年
      const lc = calculateComprehensiveDynamicDegree(prevData, currData, 1);
      
      years.push(curr.year);
      values.push(parseFloat(lc.toFixed(2)));
    }

    renderChart(years, values);

  } catch (e) {
    console.error('加载动态度趋势失败:', e);
  }
}

function renderChart(years, values) {
  if (!chartContainer.value) return;

  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartContainer.value, null, {
      renderer: 'canvas'
    });
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      formatter: '{b}年: {c}%'
    },
    grid: {
      top: '15%',
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: years,
      axisLabel: { color: '#fff' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } }
    },
    yAxis: {
      type: 'value',
      name: '年度动态度(%)',
      nameTextStyle: { color: '#a5ccff' },
      axisLabel: { color: '#fff' },
      splitLine: {
        lineStyle: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    },
    series: [
      {
        name: '综合动态度',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: {
          color: '#f59e0b',
          borderColor: '#fff',
          borderWidth: 2
        },
        lineStyle: {
          width: 3,
          color: '#f59e0b',
          shadowColor: 'rgba(245, 158, 11, 0.5)',
          shadowBlur: 10
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 158, 11, 0.4)' },
            { offset: 1, color: 'rgba(245, 158, 11, 0.0)' }
          ])
        },
        data: values
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
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
