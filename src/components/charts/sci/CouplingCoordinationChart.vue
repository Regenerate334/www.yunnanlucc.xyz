<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../../api/index.js';
import { transformDataForCalculation, calculateESV } from '../../../utils/indices.ts';
import { calculateCCDM } from '../../../utils/sci_indices.ts';

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

// 归一化极值 (用于计算 U1, U2)
const MAX_ESV = 2500000000; // 估算最大生态价值
const MAX_URBAN_RATIO = 0.15; // 估算最大建设用地占比

async function fetchDataAndRender() {
  try {
    const data = await clcdApi.getProvinceTrend();
    data.sort((a, b) => a.year - b.year);

    const years = [];
    const u1Data = []; // 城市化指数
    const u2Data = []; // 生态环境指数
    const dData = [];  // 耦合协调度

    data.forEach(item => {
      const transformed = transformDataForCalculation(item);
      const totalArea = Object.values(transformed).reduce((a, b) => a + b, 0);

      // 1. 计算 U1 (城市化指数) - 简化版：建设用地占比
      // 实际 SCI 论文中通常使用 NTL (夜间灯光) + 建设用地 + 人口 等多指标构建
      const urbanArea = transformed['Impervious'] || 0;
      let u1 = (urbanArea / totalArea) / MAX_URBAN_RATIO;
      u1 = Math.min(1, Math.max(0, u1)); // Clamp to [0, 1]

      // 2. 计算 U2 (生态环境指数) - 简化版：归一化 ESV
      const esv = calculateESV(transformed);
      let u2 = esv / MAX_ESV;
      u2 = Math.min(1, Math.max(0, u2));

      // 3. 计算 CCDM
      const ccdm = calculateCCDM(u1, u2);

      years.push(item.year);
      u1Data.push(parseFloat(u1.toFixed(3)));
      u2Data.push(parseFloat(u2.toFixed(3)));
      dData.push(parseFloat(ccdm.D.toFixed(3)));
    });

    renderChart(years, u1Data, u2Data, dData);

  } catch (e) {
    console.error('加载耦合协调度数据失败:', e);
  }
}

function renderChart(years, u1, u2, d) {
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
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['城市化指数 (U1)', '生态环境指数 (U2)', '耦合协调度 (D)'],
      textStyle: { color: '#fff' },
      bottom: 0
    },
    grid: {
      top: '15%',
      left: '3%',
      right: '3%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: '#fff' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '综合指数 (U)',
        min: 0,
        max: 1,
        position: 'left',
        axisLabel: { color: '#fff' },
        nameTextStyle: { color: '#a5ccff' },
        splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }
      },
      {
        type: 'value',
        name: '协调度 (D)',
        min: 0,
        max: 1,
        position: 'right',
        axisLabel: { color: '#fff' },
        nameTextStyle: { color: '#a5ccff' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '城市化指数 (U1)',
        type: 'line',
        data: u1,
        smooth: true,
        itemStyle: { color: '#f43f5e' }, // Rose
        lineStyle: { width: 2 }
      },
      {
        name: '生态环境指数 (U2)',
        type: 'line',
        data: u2,
        smooth: true,
        itemStyle: { color: '#10b981' }, // Emerald
        lineStyle: { width: 2 }
      },
      {
        name: '耦合协调度 (D)',
        type: 'line',
        yAxisIndex: 1,
        data: d,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        itemStyle: { color: '#3b82f6' }, // Blue
        lineStyle: { width: 4, shadowBlur: 10, shadowColor: 'rgba(59, 130, 246, 0.5)' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0)' }
          ])
        },
        markArea: {
          silent: true,
          itemStyle: {
            opacity: 0.1
          },
          data: [
            [
              { yAxis: 0, itemStyle: { color: '#ef4444' } },
              { yAxis: 0.4, name: '失调区间' } // 0-0.4
            ],
            [
              { yAxis: 0.4, itemStyle: { color: '#f59e0b' } },
              { yAxis: 0.6, name: '过渡区间' } // 0.4-0.6
            ],
            [
              { yAxis: 0.6, itemStyle: { color: '#22c55e' } },
              { yAxis: 1, name: '协调区间' } // 0.6-1.0
            ]
          ],
          label: {
              position: 'right',
              color: 'rgba(255,255,255,0.5)'
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
  min-height: 300px;
}
</style>
