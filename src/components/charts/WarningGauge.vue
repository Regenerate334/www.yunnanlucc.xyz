<!--
  @component WarningGauge
  @description 预警仪表盘组件，动态展示关键指标（如耕地流失率）的警戒量级
  @props value (当前数值), title (预警项名称)
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
  value: { type: Number, default: null },
  baseValue: { type: Number, default: null }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

async function fetchDataAndRender() {
  if (props.value !== null) {
    const val = props.value / 1000000;
    const baseVal = (props.baseValue / 1000000) || val * 1.1;
    const redLine = baseVal * 0.9;
    const maxVal = baseVal * 1.2;
    renderChart(val, redLine, maxVal);
    return;
  }
  try {
    // 获取当年数据
    const currentYearData = await clcdApi.getYearSummary(props.year);
    // 获取基准年数据 (1985) 用于设定红线
    const baseYearData = await clcdApi.getYearSummary(1985);

    if (!currentYearData || !baseYearData) return;

    const current = transformDataForCalculation(currentYearData);
    const base = transformDataForCalculation(baseYearData);

    const currentCropland = (current['Cropland'] || 0) / 1000000;
    const baseCropland = (base['Cropland'] || 0) / 1000000;

    // 假设耕地红线为 1985 年面积的 90%
    const redLine = baseCropland * 0.9;

    // 仪表盘最大值设为基准值的 1.2 倍
    const maxVal = baseCropland * 1.2;

    renderChart(currentCropland, redLine, maxVal);

  } catch (e) {
    console.error('加载耕地预警数据失败:', e);
  }
}

function renderChart(value, redLine, maxVal) {
  if (!chartContainer.value) return;

  if (!chartInstance.value) {
    chartInstance.value = echarts.init(chartContainer.value, null, {
      renderer: 'canvas'
    });
  }

  const isWarning = value < redLine;
  const color = isWarning ? '#ef4444' : '#22c55e';

  const option = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        min: 0,
        max: parseFloat(maxVal.toFixed(0)),
        startAngle: 180,
        endAngle: 0,
        radius: '90%',
        center: ['50%', '70%'],
        axisLine: {
          lineStyle: {
            width: 10,
            color: [
              [redLine / maxVal, '#ef4444'], // 红线以下为红色
              [1, '#22c55e'] // 红线以上为绿色
            ]
          }
        },
        pointer: {
          itemStyle: {
            color: 'auto'
          }
        },
        axisTick: {
          distance: -10,
          length: 6,
          lineStyle: {
            color: '#fff',
            width: 1
          }
        },
        splitLine: {
          distance: -10,
          length: 10,
          lineStyle: {
            color: '#fff',
            width: 2
          }
        },
        axisLabel: {
          color: 'auto',
          distance: 15,
          fontSize: 10,
          formatter: (val) => {
            if (val === 0) return '0';
            if (Math.abs(val - redLine) < maxVal * 0.05) return '红线';
            return '';
          }
        },
        detail: {
          valueAnimation: true,
          formatter: '{value} km²',
          color: 'auto',
          fontSize: 16,
          offsetCenter: [0, '30%']
        },
        data: [
          {
            value: parseFloat(value.toFixed(0)),
            name: '耕地保有量'
          }
        ],
        title: {
          offsetCenter: [0, '60%'],
          fontSize: 12,
          color: '#fff'
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

watch(() => props.year, () => {
  fetchDataAndRender();
});

watch(() => props.value, () => {
  fetchDataAndRender();
});

</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 150px;
}
</style>
