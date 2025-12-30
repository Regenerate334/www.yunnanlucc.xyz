<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import { clcdApi } from '../../api/index.js';
import { calculateLUDI, calculateESV, calculateSHDI, transformDataForCalculation } from '../../utils/indices.ts';

const props = defineProps({
  year: { type: Number, default: 2023 }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

// 归一化处理所需的极值（基于历史数据估算，用于将不同量纲的指标映射到 0-100）
const MAX_VALUES = {
  LUDI: 300, // 理论最大值 400，但实际通常在 200-300 之间
  ESV: 2000000000, // 需根据实际数据调整，这里暂设一个大值
  SHDI: 2.5, // 香农指数通常 < 3
  CroplandRatio: 0.5, // 耕地占比
  ImperviousRatio: 0.1 // 建设用地占比
};

async function fetchDataAndRender() {
  try {
    // 获取当年数据
    const currentYearData = await clcdApi.getYearSummary(props.year);
    // 获取基准年数据 (1985)
    const baseYearData = await clcdApi.getYearSummary(1985);

    if (!currentYearData || !baseYearData) return;

    const current = transformDataForCalculation(currentYearData);
    const base = transformDataForCalculation(baseYearData);

    // 计算各项指标
    const indicators = [
      { name: '土地利用程度 (LUDI)', max: 100, key: 'LUDI' },
      { name: '生态服务价值 (ESV)', max: 100, key: 'ESV' },
      { name: '景观多样性 (SHDI)', max: 100, key: 'SHDI' },
      { name: '耕地占比', max: 100, key: 'CroplandRatio' },
      { name: '建设用地占比', max: 100, key: 'ImperviousRatio' }
    ];

    const currentValues = calculateIndicators(current);
    const baseValues = calculateIndicators(base);

    renderChart(indicators, baseValues, currentValues);

  } catch (e) {
    console.error('加载生态雷达图数据失败:', e);
  }
}

function calculateIndicators(data) {
  const totalArea = Object.values(data).reduce((a, b) => a + b, 0);
  
  // 1. LUDI
  const ludi = calculateLUDI(data);
  
  // 2. ESV
  const esv = calculateESV(data);
  
  // 3. SHDI
  const shdi = calculateSHDI(data);
  
  // 4. Cropland Ratio
  const croplandRatio = (data['Cropland'] || 0) / totalArea;
  
  // 5. Impervious Ratio
  const imperviousRatio = (data['Impervious'] || 0) / totalArea;

  // 归一化映射到 0-100
  return [
    Math.min(100, (ludi / MAX_VALUES.LUDI) * 100),
    Math.min(100, (esv / MAX_VALUES.ESV) * 100),
    Math.min(100, (shdi / MAX_VALUES.SHDI) * 100),
    Math.min(100, (croplandRatio / MAX_VALUES.CroplandRatio) * 100),
    Math.min(100, (imperviousRatio / MAX_VALUES.ImperviousRatio) * 100)
  ];
}

function renderChart(indicators, baseValues, currentValues) {
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
    },
    legend: {
      data: ['1985年 (基准)', `${props.year}年`],
      bottom: 0,
      textStyle: { color: '#fff' }
    },
    radar: {
      indicator: indicators.map(i => ({ name: i.name, max: 100 })),
      center: ['50%', '50%'],
      radius: '65%',
      splitNumber: 4,
      axisName: {
        color: '#a5ccff',
        fontSize: 12
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)']
        }
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    series: [
      {
        name: '多维生态评估',
        type: 'radar',
        data: [
          {
            value: baseValues,
            name: '1985年 (基准)',
            itemStyle: { color: '#94a3b8' },
            areaStyle: { color: 'rgba(148, 163, 184, 0.2)' }
          },
          {
            value: currentValues,
            name: `${props.year}年`,
            itemStyle: { color: '#34d399' },
            areaStyle: { color: 'rgba(52, 211, 153, 0.4)' },
            lineStyle: { width: 2 }
          }
        ]
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
