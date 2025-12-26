<template>
  <div class="land-use-trend-chart">
    <div ref="chartContainer" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
})

const chartContainer = ref(null)
const chartInstance = ref(null)

const landTypeMap = {
  'cropland': '耕地',
  'forest': '林地',
  'shrub': '灌木',
  'grassland': '草地',
  'water': '水域',
  'snow_ice': '冰雪',
  'barren': '裸地',
  'impervious': '建设用地',
  'wetland': '湿地'
}

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

const initChart = () => {
  if (!chartContainer.value) return
  chartInstance.value = echarts.init(chartContainer.value)

  const resizeObserver = new ResizeObserver(() => {
    if (chartInstance.value) chartInstance.value.resize()
  })
  resizeObserver.observe(chartContainer.value)
  chartInstance.value._resizeObserver = resizeObserver
}

const updateChart = () => {
  if (!chartInstance.value || !props.seriesData.length) return

  const years = props.seriesData.map(d => d.year).sort((a, b) => a - b);
  const keys = Object.keys(landTypeMap);

  const grids = [];
  const xAxes = [];
  const yAxes = [];
  const series = [];
  const titles = [];

  const cols = 3;
  const rows = 3;

  // 布局参数
  const leftMargin = 5;
  const rightMargin = 5;
  const topMargin = 8;
  const bottomMargin = 12;
  const hGap = 6; // 水平间距
  const vGap = 10; // 垂直间距

  const gridWidth = (100 - leftMargin - rightMargin - hGap * (cols - 1)) / cols;
  const gridHeight = (100 - topMargin - bottomMargin - vGap * (rows - 1)) / rows;

  keys.forEach((key, index) => {
    const r = Math.floor(index / cols);
    const c = index % cols;

    const left = leftMargin + c * (gridWidth + hGap);
    const top = topMargin + r * (gridHeight + vGap);

    // 1. 定义网格
    grids.push({
      left: left + '%',
      top: top + '%',
      width: gridWidth + '%',
      height: gridHeight + '%',
      containLabel: false
    });

    // 2. 定义标题 (放在每个子图上方)
    titles.push({
      text: landTypeMap[key],
      left: (left + gridWidth / 2) + '%',
      top: (top - 4) + '%',
      textAlign: 'center',
      textStyle: { color: '#00E5FF', fontSize: 14, fontWeight: 'bold' }
    });

    // 3. 定义 X 轴
    xAxes.push({
      gridIndex: index,
      type: 'category',
      boundaryGap: false,
      data: years,
      axisLabel: {
        show: r === rows - 1, // 只有最后一行显示年份
        color: '#fff',
        fontSize: 10,
        margin: 12,
        interval: 0, // 强制显示所有标签
        rotate: 45   // 斜着放置标签
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.2)' } },
      axisTick: { show: r === rows - 1 }
    });

    // 4. 定义 Y 轴 (独立缩放)
    yAxes.push({
      gridIndex: index,
      type: 'value',
      scale: true, // 关键：自动缩放，突出拐点
      name: 'km²',
      nameTextStyle: { color: '#888', fontSize: 10 },
      axisLabel: {
        color: '#fff',
        fontSize: 10,
        formatter: (value) => {
          if (value >= 10000) return (value / 10000).toFixed(1) + '万';
          return value.toFixed(0);
        }
      },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.1)' } }
    });

    // 5. 定义数据序列
    const data = years.map(year => {
      const record = props.seriesData.find(d => d.year === year);
      return (record ? record[key] : 0) / 1000000;
    });

    series.push({
      name: landTypeMap[key],
      type: 'line',
      xAxisIndex: index,
      yAxisIndex: index,
      data: data,
      showSymbol: true,
      symbolSize: 4,
      smooth: false,
      itemStyle: { color: landUseColors[key] },
      lineStyle: { width: 3, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)', shadowOffsetY: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: landUseColors[key] + '66' },
          { offset: 1, color: landUseColors[key] + '00' }
        ])
      },
      emphasis: {
        lineStyle: { width: 5, shadowBlur: 15 }
      },
      animationDelay: function (idx) {
        return idx * 50; // 逐年延迟，形成生长动画效果
      }
    });
  });

  const option = {
    backgroundColor: 'transparent',
    animationDuration: 2000,
    animationEasing: 'quadraticOut',
    title: [
      {
        text: '土地利用类型变化趋势',
        left: 'center',
        top: 10,
        textStyle: { color: '#fff', fontSize: 18 }
      },
      ...titles
    ],
    tooltip: {
      trigger: 'axis',
      confine: true,
      appendToBody: true,
      backgroundColor: 'rgba(20, 30, 60, 0.95)',
      borderColor: '#345',
      borderWidth: 1,
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: {
        type: 'cross',
        lineStyle: { color: 'rgba(255,255,255,0.3)', type: 'dashed' }
      },
      formatter: function (params) {
        if (!params || params.length === 0) return '';
        const year = params[0].axisValue;
        const record = props.seriesData.find(d => d.year == year);
        if (!record) return year;

        let html = `<div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #456; padding-bottom:5px;">${year}年 详细数据</div>`;
        const sortedKeys = Object.keys(landTypeMap).sort((a, b) => record[b] - record[a]);

        sortedKeys.forEach(k => {
          const val = record[k] / 1000000;
          const areaStr = val >= 10000
            ? (val / 10000).toFixed(2) + ' 万km²'
            : val.toFixed(2) + ' km²';

          html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:3px 0; min-width:180px;">
            <span style="display:flex; align-items:center;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${landUseColors[k]}; margin-right:8px;"></span>
              ${landTypeMap[k]}
            </span>
            <span style="font-weight:bold; margin-left:15px; font-family:monospace;">${areaStr}</span>
          </div>`;
        });
        return html;
      }
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: series
  };

  chartInstance.value.setOption(option, true);
}

onMounted(() => {
  nextTick(() => {
    initChart()
    updateChart()
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    if (chartInstance.value._resizeObserver) chartInstance.value._resizeObserver.disconnect()
    chartInstance.value.dispose()
  }
})

watch(() => props.seriesData, () => {
  updateChart()
}, { deep: true })
</script>

<style scoped>
.land-use-trend-chart {
  width: 100%;
  height: 100%;
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 600px;
}
</style>
