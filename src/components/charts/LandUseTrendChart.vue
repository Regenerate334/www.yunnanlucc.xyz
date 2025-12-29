<template>
  <div class="land-use-trend-chart">
    <div ref="chartContainer" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
})

const chartContainer = shallowRef(null)
const chartInstance = shallowRef(null)

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

  // 清除之前的定时器
  if (chartInstance.value._animationTimer) {
    clearTimeout(chartInstance.value._animationTimer);
  }

  chartInstance.value.clear();

  let currentStep = 0;
  const totalSteps = years.length;

  // 预计算每个指标的全量数据范围，以固定 Y 轴
  const yAxisBounds = {};
  keys.forEach(key => {
    const allData = years.map(year => {
      const record = props.seriesData.find(d => d.year === year);
      return (record ? record[key] : 0) / 1000000;
    });
    const min = Math.min(...allData);
    const max = Math.max(...allData);
    const padding = (max - min) * 0.1 || 1;
    yAxisBounds[key] = {
      min: Math.floor(min - padding),
      max: Math.ceil(max + padding)
    };
  });

  const renderStep = () => {
    currentStep++;
    const visibleYears = years.slice(0, currentStep);

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
    const hGap = 6;
    const vGap = 10;

    const gridWidth = (100 - leftMargin - rightMargin - hGap * (cols - 1)) / cols;
    const gridHeight = (100 - topMargin - bottomMargin - vGap * (rows - 1)) / rows;

    keys.forEach((key, index) => {
      const r = Math.floor(index / cols);
      const c = index % cols;
      const left = leftMargin + c * (gridWidth + hGap);
      const top = topMargin + r * (gridHeight + vGap);

      grids.push({
        left: left + '%',
        top: top + '%',
        width: gridWidth + '%',
        height: gridHeight + '%',
        containLabel: false
      });

      titles.push({
        text: landTypeMap[key],
        left: (left + gridWidth / 2) + '%',
        top: (top - 4) + '%',
        textAlign: 'center',
        textStyle: { color: '#a5ccff', fontSize: 13, fontWeight: '600' }
      });

      xAxes.push({
        gridIndex: index,
        type: 'category',
        boundaryGap: false,
        data: years, // 保持全量年份以固定坐标轴
        axisLabel: {
          show: r === rows - 1,
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 10,
          margin: 12,
          interval: 0,
          rotate: 45
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
        axisTick: { show: r === rows - 1 }
      });

      yAxes.push({
        gridIndex: index,
        type: 'value',
        min: yAxisBounds[key].min,
        max: yAxisBounds[key].max,
        name: 'km²',
        nameTextStyle: { color: 'rgba(255, 255, 255, 0.4)', fontSize: 10 },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: 9,
          formatter: (value) => {
            if (value >= 10000) return (value / 10000).toFixed(1) + '万';
            return value.toFixed(0);
          }
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
        axisLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      });

      const data = visibleYears.map(year => {
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
        symbolSize: 3,
        smooth: true,
        itemStyle: { color: landUseColors[key] },
        lineStyle: { width: 2, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: landUseColors[key] + '33' },
            { offset: 1, color: landUseColors[key] + '00' }
          ])
        },
        animation: false // 关闭内部动画，由外部定时器驱动
      });
    });

    const option = {
      backgroundColor: 'transparent',
      title: [
        {
          text: '土地利用类型变化趋势',
          left: 'center',
          top: 10,
          textStyle: { color: '#fff', fontSize: 18, fontWeight: '600' }
        },
        ...titles
      ],
      tooltip: {
        trigger: 'axis',
        confine: true,
        appendToBody: true,
        backgroundColor: 'rgba(13, 25, 48, 0.9)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        textStyle: { color: '#fff', fontSize: 12 },
        axisPointer: {
          type: 'cross',
          lineStyle: { color: 'rgba(255,255,255,0.2)', type: 'dashed' }
        },
        formatter: function (params) {
          if (!params || params.length === 0) return '';
          const year = params[0].axisValue;
          const record = props.seriesData.find(d => d.year == year);
          if (!record) return year;

          let html = `<div style="font-weight:600; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px; color:#a5ccff;">${year}年 详细数据</div>`;
          const sortedKeys = Object.keys(landTypeMap).sort((a, b) => record[b] - record[a]);

          sortedKeys.forEach(k => {
            const val = record[k] / 1000000;
            const areaStr = val >= 10000
              ? (val / 10000).toFixed(2) + ' 万km²'
              : val.toFixed(2) + ' km²';

            html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:4px 0; min-width:200px;">
              <span style="display:flex; align-items:center; color:rgba(255,255,255,0.8);">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${landUseColors[k]}; margin-right:10px; box-shadow:0 0 8px ${landUseColors[k]}66;"></span>
                ${landTypeMap[k]}
              </span>
              <span style="font-weight:600; margin-left:20px; font-family:'JetBrains Mono', monospace;">${areaStr}</span>
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

    chartInstance.value.setOption(option, false);

    if (currentStep < totalSteps) {
      chartInstance.value._animationTimer = setTimeout(renderStep, 80);
    }
  };

  renderStep();
}

onMounted(() => {
  nextTick(() => {
    initChart()
    updateChart()
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    if (chartInstance.value._animationTimer) clearTimeout(chartInstance.value._animationTimer)
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
