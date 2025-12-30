<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../../api/index.js';
import { transformDataForCalculation, calculateSHDI } from '../../../utils/indices.ts';
import { calculateSHEI, estimateLSI, estimateAI } from '../../../utils/sci_indices.ts';

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

async function fetchDataAndRender() {
  try {
    const data = await clcdApi.getProvinceTrend();
    // 选取关键年份，避免太密集
    const keyYears = data.filter(d => d.year % 5 === 0 || d.year === 2023).sort((a, b) => a.year - b.year);
    
    const years = keyYears.map(d => d.year);
    const metrics = ['SHDI', 'SHEI', 'LSI(est)', 'AI(est)'];
    
    // 准备热力图数据 [yIndex, xIndex, value]
    // y: metrics, x: years
    const heatmapData = [];

    keyYears.forEach((item, xIndex) => {
      const transformed = transformDataForCalculation(item);
      
      // 计算各项指标
      const shdi = calculateSHDI(transformed);
      const shei = calculateSHEI(transformed);
      const lsi = estimateLSI(transformed);
      const ai = estimateAI(transformed);

      // 归一化处理 (为了在同一热力图中展示，需要将各指标映射到 0-1 或相似范围)
      // 这里我们直接展示原始值，但通过 visualMap 调节颜色
      // 或者，为了热力图效果，我们可以对每一行进行行内归一化
      
      heatmapData.push([xIndex, 0, parseFloat(shdi.toFixed(2))]); // SHDI
      heatmapData.push([xIndex, 1, parseFloat(shei.toFixed(2))]); // SHEI
      heatmapData.push([xIndex, 2, parseFloat(lsi.toFixed(2))]);  // LSI
      heatmapData.push([xIndex, 3, parseFloat(ai.toFixed(2))]);   // AI
    });

    renderChart(years, metrics, heatmapData);

  } catch (e) {
    console.error('加载景观格局指数数据失败:', e);
  }
}

function renderChart(years, metrics, data) {
  if (!chartContainer.value) return;

  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartContainer.value, null, {
      renderer: 'canvas'
    });
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: (params) => {
        return `${years[params.value[0]]}年 ${metrics[params.value[1]]}: ${params.value[2]}`;
      }
    },
    grid: {
      height: '70%',
      top: '10%'
    },
    xAxis: {
      type: 'category',
      data: years,
      splitArea: {
        show: true
      },
      axisLabel: { color: '#fff' }
    },
    yAxis: {
      type: 'category',
      data: metrics,
      splitArea: {
        show: true
      },
      axisLabel: { color: '#fff' }
    },
    visualMap: {
      min: 0,
      max: 100, // 需要根据实际值调整，或者使用 piecewise
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      textStyle: { color: '#fff' },
      inRange: {
        color: ['#1e293b', '#3b82f6', '#f43f5e'] // Dark Blue -> Blue -> Rose
      }
    },
    series: [
      {
        name: '景观格局指数',
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          color: '#fff'
        },
        itemStyle: {
          borderColor: '#0f172a',
          borderWidth: 1
        }
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
  min-height: 250px;
}
</style>
