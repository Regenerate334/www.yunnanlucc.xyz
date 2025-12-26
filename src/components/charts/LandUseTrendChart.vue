<template>
  <div class="land-use-trend-chart">
    <div ref="chartContainer" class="chart-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
})

const chartContainer = ref(null)
const chartInstance = ref(null)

// 土地利用类型映射
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
  'wetland': '#2899E8',
  'impervious': '#E24290',
  'barren': '#CFBDA3',
  'snow_ice': '#A6CEE3'
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

  // 1. 提取年份作为 X 轴数据
  const years = props.seriesData.map(d => d.year).sort((a, b) => a - b);

  // 2. 构建 Series 数据
  const series = Object.keys(landTypeMap).map(key => {
    const data = years.map(year => {
      const record = props.seriesData.find(d => d.year === year);
      const val = record ? record[key] : 0;
      return val / 1000000; // 转换为 km²
    });

    return {
      name: landTypeMap[key],
      type: 'line',
      // 不再使用堆叠，改为动态排序风格 (Line Race)
      showSymbol: false,
      smooth: true,
      emphasis: { focus: 'series' },
      endLabel: {
        show: true,
        formatter: function (params) {
          const val = params.value;
          const areaStr = val >= 10000
            ? (val / 10000).toFixed(1) + '万'
            : val.toFixed(0);
          return params.seriesName + ': ' + areaStr;
        },
        distance: 10,
        color: 'inherit',
        fontSize: 12,
        fontWeight: 'bold'
      },
      labelLayout: {
        moveOverlap: 'shiftY'
      },
      data: data,
      itemStyle: { color: landUseColors[key] }
    };
  });

  const option = {
    animationDuration: 10000,
    title: {
      text: '土地利用类型变化趋势 (Line Race)',
      left: 'center',
      textStyle: { color: '#fff', fontSize: 16 }
    },
    tooltip: {
      show: true,
      trigger: 'axis',
      confine: false, // 允许超出容器，避免被遮挡
      appendToBody: true, // 关键：将 tooltip 渲染到 body，避免 z-index 问题
      order: 'valueDesc',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.5)',
          type: 'dashed',
          width: 2
        }
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: {
        color: '#333',
        fontSize: 14,
        lineHeight: 20
      },
      padding: [12, 16],
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 99999 !important; border-radius: 4px;',
      formatter: function (params) {
        if (!params || params.length === 0) return '';

        let html = `<div style="font-weight:600; margin-bottom:10px; padding-bottom:8px; border-bottom:2px solid #e0e0e0; color:#333; font-size:15px;">`;
        html += `${params[0].axisValue}年`;
        html += `</div>`;

        params.forEach(item => {
          const val = item.value;
          const areaStr = val >= 10000
            ? (val / 10000).toFixed(2) + ' 万km²'
            : val.toFixed(0) + ' km²';

          html += `<div style="display:flex; justify-content:space-between; align-items:center; margin:6px 0; min-width:220px;">`;
          html += `<span style="display:flex; align-items:center; gap:8px;">`;
          html += `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${item.color};"></span>`;
          html += `<span style="color:#555;">${item.seriesName}</span>`;
          html += `</span>`;
          html += `<span style="font-weight:700; color:#000; font-family:monospace; margin-left:24px;">${areaStr}</span>`;
          html += `</div>`;
        });

        return html;
      }
    },
    legend: {
      show: false // Line Race 风格通常使用 endLabel，不需要图例
    },
    grid: {
      left: '3%',
      right: '150', // 为右侧标签留出空间
      bottom: '10%',
      top: '12%',
      containLabel: true
    },
    toolbox: {
      feature: {
        saveAsImage: {}
      },
      iconStyle: {
        borderColor: '#fff'
      }
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: years,
        axisLabel: { color: '#fff' },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.3)' } }
      }
    ],
    yAxis: [
      {
        type: 'value',
        name: '面积 (km²)',
        nameTextStyle: { color: '#fff' },
        axisLabel: {
          color: '#fff',
          formatter: (value) => {
            if (value >= 10000) return (value / 10000).toFixed(1) + '万';
            return value;
          }
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
      }
    ],
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
  min-height: 400px;
}
</style>
