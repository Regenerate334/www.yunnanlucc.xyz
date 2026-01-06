<template>
  <div ref="chartContainer" class="chart-container"></div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';

const props = defineProps({
  data: { type: Array, default: () => [] },
  type: { type: String, default: 'comprehensive' }
});

const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);

function getXAxisMax() {
  // 建设用地 (impervious) 变化巨大，使用自适应量程
  if (props.type === 'impervious') {
    return null; // ECharts default auto-scale
  }
  // 其他地类变化较小 (通常 < 1%)，使用较小量程以便观察差异
  // 设定为 2% 可以很好地展示 0.x% 的数据，同时留有余地
  return 2;
}

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
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(15, 23, 42, 0.9)',
      borderColor: '#3b82f6',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const item = params[0];
        return `${item.name}: ${Number(item.value).toFixed(2)}%`;
      }
    },
    grid: {
      top: '2%',
      left: '0%',
      right: '5%',
      bottom: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: getXAxisMax(),
      name: '(%)',
      nameLocation: 'end',
      nameGap: 8,
      nameTextStyle: {
        color: '#a5ccff',
        fontSize: 11,
        align: 'right',
        verticalAlign: 'top',
        padding: [22, 0, 0, 0]
      },
      splitLine: {
        show: true,
        lineStyle: { color: 'rgba(255, 255, 255, 0.05)' }
      },
      axisLabel: {
        color: '#94a3b8',
        fontSize: 11,
        hideOverlap: true,
        margin: 10
      },
      axisLine: {
        show: true,
        lineStyle: { color: 'rgba(255, 255, 255, 0.2)' }
      }
    },
    yAxis: {
      type: 'category',
      data: [],
      axisLabel: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: 'bold',
        interval: 0,
        formatter: (value) => {
          const core = value.replace(/(族|自治州|地区|市|自治县)$/g, '')
            .replace(/(哈尼族|彝族|傣族|景颇族|傈僳族|苗族|壮族|藏族|白族|纳西族|拉祜族|佤族|布朗族|普米族|阿昌族|怒族|基诺族|德昂族|独龙族)/g, '');
          return core.substring(0, 2);
        }
      },
      axisLine: {
        show: true,
        lineStyle: { color: 'rgba(255, 255, 255, 0.2)' }
      },
      inverse: true
    },
    series: [
      {
        name: '动态度',
        type: 'bar',
        data: [],
        barWidth: '60%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#2dd4bf' }
          ]),
          borderRadius: [0, 4, 4, 0]
        },
        label: {
          show: true,
          position: 'right',
          color: '#06b6d4',
          fontWeight: 'bold',
          fontSize: 12,
          formatter: (params) => {
            return `${Number(params.value).toFixed(2)}%`;
          },
          distance: 8
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#5eead4' }
            ])
          }
        },
        animationDuration: 1000,
        animationEasing: 'cubicOut'
      }
    ]
  };

  chartInstance.value.setOption(option);
}

function updateChart() {
  if (!chartInstance.value || !props.data) return;

  const names = props.data.map(item => item.name);
  const values = props.data.map(item => item.value);

  chartInstance.value.setOption({
    xAxis: {
      max: getXAxisMax()
    },
    yAxis: { data: names },
    series: [{
      data: values
    }]
  });
}

function handleResize() {
  chartInstance.value?.resize();
}

onMounted(() => {
  initChart();
  if (props.data && props.data.length > 0) {
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

watch(() => [props.data, props.type], () => {
  updateChart();
}, { deep: true });

</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  min-height: 250px;
}
</style>
