<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  data: { type: Object, default: () => ({}) }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

const landTypes = {
  Cropland: { name: '耕地', color: '#eab308' }, // yellow-500
  Forest: { name: '森林', color: '#22c55e' },   // green-500
  Shrub: { name: '灌木', color: '#84cc16' },    // lime-500
  Grassland: { name: '草地', color: '#10b981' }, // emerald-500
  Water: { name: '水域', color: '#3b82f6' },    // blue-500
  Snow_Ice: { name: '冰雪', color: '#cbd5e1' }, // slate-300
  Barren: { name: '荒地', color: '#94a3b8' },   // slate-400
  Impervious: { name: '建设', color: '#ef4444' }, // red-500
  Wetland: { name: '湿地', color: '#06b6d4' }    // cyan-500
};

function initChart() {
  if (!chartContainer.value) return;

  if (chartInstance.value) {
    chartInstance.value.dispose();
  }

  chartInstance.value = echarts.init(chartContainer.value, null, {
    renderer: 'canvas'
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: '#3b82f6',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        return `${params.marker} ${params.name}<br/>
                面积: ${(params.value / 1000000).toFixed(2)} km²<br/>
                占比: ${params.percent}%`;
      }
    },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 0,
      top: 'center',
      textStyle: { color: '#a5ccff', fontSize: 10 },
      pageTextStyle: { color: '#a5ccff' },
      itemWidth: 10,
      itemHeight: 10
    },
    series: [
      {
        name: '土地利用',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#0f172a',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
            color: '#fff',
            formatter: '{b}\n{d}%'
          }
        },
        labelLine: {
          show: false
        },
        data: []
      }
    ]
  };

  chartInstance.value.setOption(option);
}

function updateChart() {
  if (!chartInstance.value || !props.data) return;

  const data = Object.entries(props.data)
    .filter(([key, value]) => landTypes[key] && value > 0)
    .map(([key, value]) => ({
      name: landTypes[key].name,
      value: value,
      itemStyle: { color: landTypes[key].color }
    }))
    .sort((a, b) => b.value - a.value);

  chartInstance.value.setOption({
    series: [{
      data: data
    }]
  });
}

function handleResize() {
  chartInstance.value?.resize();
}

onMounted(() => {
  initChart();
  if (props.data && Object.keys(props.data).length > 0) {
    updateChart();
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (chartInstance.value) {
    chartInstance.value.dispose();
    chartInstance.value = null;
  }
});

watch(() => props.data, () => {
  updateChart();
}, { deep: true });

</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 150px;
}
</style>
