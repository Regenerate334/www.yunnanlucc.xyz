<!-- 
  ===========================================
  土地利用变化趋势图组件
  ===========================================
-->
<template>
  <div class="land-use-trend-chart" :class="{ expanded: isExpanded }">
    <div class="chart-header">
      <div class="chart-title">土地利用类型变化趋势</div>
      <div class="header-controls">
        <button class="expand-btn" @click="toggleExpand" :title="isExpanded ? '收起' : '展开'">
          <span v-if="isExpanded">↙</span>
          <span v-else>↗</span>
        </button>
      </div>
    </div>

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
const isExpanded = ref(false)

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  nextTick(() => {
    if (chartInstance.value) {
      chartInstance.value.resize()
    }
  })
}

// 土地利用类型映射（英文 -> 中文）
const landTypeMap = {
  'Cropland': '耕地',
  'Forest': '林地',
  'Shrub': '灌木',
  'Grassland': '草地',
  'Water': '水域',
  'Snow/Ice': '冰雪',
  'Barren': '裸地',
  'Impervious': '建设用地',
  'Wetland': '湿地'
}

// 将宽表数据转换为长表数据 [Year, Type, Area]
const rawData = computed(() => {
  if (!props.seriesData || props.seriesData.length === 0) return []

  // Header row
  const result = [['Year', 'Type', 'Area']]

  props.seriesData.forEach(item => {
    const year = item.year
    Object.keys(landTypeMap).forEach(key => {
      // key 是英文名 (如 Cropland), landTypeMap[key] 是中文名 (如 耕地)
      // 数据中的 key 是小写 (如 cropland)
      const dataKey = key.toLowerCase() === 'snow/ice' ? 'tundra' : key.toLowerCase()
      const area = item[dataKey]
      if (area !== undefined) {
        result.push([year, landTypeMap[key], area])
      }
    })
  })

  return result
})

const run = (_rawData) => {
  if (!chartInstance.value) return;

  // 确保图表容器有尺寸
  chartInstance.value.resize();

  const countries = Object.values(landTypeMap); // 对应示例中的 countries
  const datasetWithFilters = [];
  const seriesList = [];

  echarts.util.each(countries, function (country) {
    var datasetId = 'dataset_' + country;
    datasetWithFilters.push({
      id: datasetId,
      fromDatasetId: 'dataset_raw',
      transform: {
        type: 'filter',
        config: {
          and: [
            { dimension: 'Type', '=': country }
          ]
        }
      }
    });
    seriesList.push({
      type: 'line',
      datasetId: datasetId,
      showSymbol: false,
      name: country,
      endLabel: {
        show: true,
        formatter: function (params) {
          // params.value: [Year, Type, Area]
          return params.value[1] + ': ' + Math.round(params.value[2]);
        },
        color: 'inherit' // 继承系列颜色
      },
      labelLayout: {
        moveOverlap: 'shiftY'
      },
      emphasis: {
        focus: 'series'
      },
      encode: {
        x: 'Year',
        y: 'Area',
        label: ['Type', 'Area'],
        itemName: 'Year',
        tooltip: ['Area']
      }
    });
  });

  const option = {
    animationDuration: 3000, // 保持动画
    dataset: [
      {
        id: 'dataset_raw',
        source: _rawData
      },
      ...datasetWithFilters
    ],
    tooltip: {
      order: 'valueDesc',
      trigger: 'axis',
      backgroundColor: 'rgba(42, 61, 110, 0.9)', // 保持暗色主题适配
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: { color: '#ffffff' }
    },
    xAxis: {
      type: 'category',
      nameLocation: 'middle',
      axisLabel: { color: '#fff' }, // 适配暗色背景
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } }
    },
    yAxis: {
      type: 'log',
      name: '面积 (km²)',
      nameTextStyle: { color: '#fff' },
      axisLabel: { color: '#fff' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } },
      logBase: 10
    },
    grid: {
      right: 100, // 为 endLabel 留出空间
      top: 40,
      bottom: 30,
      left: 60
    },
    series: seriesList
  };

  chartInstance.value.setOption(option);
}

const initChart = () => {
  if (!chartContainer.value) return
  chartInstance.value = echarts.init(chartContainer.value)

  // Use ResizeObserver to handle container resize
  const resizeObserver = new ResizeObserver(() => {
    if (chartInstance.value) {
      chartInstance.value.resize()
    }
  })
  resizeObserver.observe(chartContainer.value)

  // Store observer to disconnect later
  chartInstance.value._resizeObserver = resizeObserver
}

onMounted(() => {
  nextTick(() => {
    initChart()
    if (rawData.value.length > 1) {
      run(rawData.value)
    }
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    if (chartInstance.value._resizeObserver) {
      chartInstance.value._resizeObserver.disconnect()
    }
    chartInstance.value.dispose()
  }
})

watch(() => props.seriesData, () => {
  if (rawData.value.length > 1) {
    run(rawData.value)
  }
}, { deep: true })

</script>

<style scoped>
.land-use-trend-chart {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(42, 61, 110, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.chart-header {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(42, 61, 110, 0.95);
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #9cc9ff;
}

.chart-container {
  width: 100%;
  height: 300px;
  /* 明确指定高度，避免 flex 布局导致高度为 0 */
}

.header-controls {
  margin-left: auto;
}

.expand-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  transition: all 0.3s;
}

.expand-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #fff;
}

/* Expanded State Styles */
.land-use-trend-chart.expanded {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  height: 85vh;
  z-index: 2000;
  background: rgba(42, 61, 110, 0.95);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.land-use-trend-chart.expanded .chart-container {
  flex: 1;
  height: 0;
  /* Let flex grow handle height */
  min-height: 0;
}
</style>
