<!--
  @component DynamicTrendChart
  @description 土地动态变化趋势图，多维度展示动态度随时间的演变规律
  @props seriesData (时间序列指标数据)
  @emits 无
  @dependencies ECharts
-->
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
    const rawData = await clcdApi.getProvinceTrend();
    
    // 核心修复：数据去重与年度汇总，防止重复年份导致图表重叠与计算逻辑错误
    const yearsArr = [...new Set(rawData.map(d => Number(d.year)))].sort((a, b) => a - b);
    const data = yearsArr.map(year => {
        const matchingRecords = rawData.filter(d => Number(d.year) === year);
        const aggregated = { year };
        const sample = matchingRecords[0];
        Object.keys(sample).forEach(key => {
            if (key !== 'year' && typeof sample[key] === 'number') {
                aggregated[key] = Math.max(...matchingRecords.map(r => r[key] || 0));
            }
        });
        return aggregated;
    });

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
      data: years, // Assuming 'years' is the correct data source for the x-axis
      boundaryGap: false,
      axisLabel: {
        color: '#fff',
        interval: 4, // 5年一个刻度 (e.g., 1990, 1995, 2000...)
        hideOverlap: true
      },
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
