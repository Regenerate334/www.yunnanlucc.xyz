<!-- 
  ===========================================
  土地利用类型占比饼图组件
  ===========================================
  功能：显示指定年份各地类面积占比（使用优化后的JSON数据）
-->
<template>
  <div class="land-use-pie-chart" :class="{ compact: compact }">
    <!-- 图表标题 -->
    <div class="chart-title">{{ chartTitle }}</div>

    <!-- ECharts容器 -->
    <div ref="chartContainer" class="chart-container"></div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-message">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>

    <!-- 空数据状态 -->
    <div v-else-if="!hasData" class="no-data-message">
      暂无数据
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

// ==================== 组件属性定义 ====================
const props = defineProps({
  year: {
    type: Number,
    required: true,
    default: 2023
  },
  seriesData: {
    type: Object,
    default: () => ({})
  },
  compact: {
    type: Boolean,
    default: false
  }
})

// ==================== 响应式数据 ====================
const chartContainer = ref(null)
const chartInstance = ref(null)
const loading = ref(false)

// ==================== 计算属性 ====================
const chartTitle = computed(() => {
  return `${props.year}年土地利用结构`
})

const hasData = computed(() => {
  return props.seriesData && Object.keys(props.seriesData).length > 0
})

const chartData = computed(() => {
  if (!props.seriesData) return []

  const mapping = {
    '耕地': 'Cropland',
    '林地': 'Forest',
    '灌木': 'Shrub',
    '草地': 'Grassland',
    '水域': 'Water',
    '冰雪': 'Snow/Ice',
    '裸地': 'Barren',
    '建设用地': 'Impervious',
    '湿地': 'Wetland'
  }

  // 颜色映射 (与 front_page.vue 保持一致)
  const colors = {
    '耕地': 'rgb(250,227,156)',
    '林地': 'rgb(68,111,51)',
    '灌木': 'rgb(51,160,44)',
    '草地': 'rgb(171,211,123)',
    '水域': 'rgb(30,105,180)',
    '冰雪': 'rgb(166,206,227)',
    '裸地': 'rgb(207,189,163)',
    '建设用地': 'rgb(226,66,144)',
    '湿地': 'rgb(40,155,232)'
  }

  const data = []
  // 遍历属性，排除非地类属性（如 year, code, name 等）
  const excludeKeys = ['year', 'code', 'name', 'level', 'parentCode']

  Object.keys(props.seriesData).forEach(key => {
    if (!excludeKeys.includes(key) && typeof props.seriesData[key] === 'number') {
      data.push({
        name: key,
        value: props.seriesData[key],
        itemStyle: {
          color: colors[key] || '#ccc'
        }
      })
    }
  })

  return data.sort((a, b) => b.value - a.value)
})

// ==================== 图表配置 ====================
const getChartOption = () => {
  const totalArea = chartData.value.reduce((sum, item) => sum + item.value, 0)

  return {
    title: {
      text: `${props.year}年土地利用结构`,
      left: 'center',
      top: 10,
      textStyle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(42, 61, 110, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: {
        color: '#ffffff'
      },
      formatter: function (params) {
        const percent = totalArea ? ((params.value / totalArea) * 100).toFixed(2) : 0
        return `${params.name}<br/>面积: ${params.value.toFixed(2)} km²<br/>占比: ${percent}%`
      }
    },
    series: [
      {
        name: '土地利用结构',
        type: 'pie',
        radius: ['0%', '60%'],  // 实心饼图
        center: ['50%', '55%'],  // 居中显示
        data: chartData.value,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{d}%',
          color: '#fff',
          fontSize: 12,
          overflow: 'break',
          width: 80
        },
        labelLine: {
          show: true,
          length: 15,
          length2: 10,
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.5)'
          }
        }
      }
    ]
  }
}

// ==================== 图表操作函数 ====================
const initChart = () => {
  if (!chartContainer.value) return
  chartInstance.value = echarts.init(chartContainer.value)
  window.addEventListener('resize', handleResize)
}

const updateChart = () => {
  if (!chartInstance.value) return
  const option = getChartOption()
  chartInstance.value.setOption(option, true)
}

const handleResize = () => {
  if (chartInstance.value) {
    chartInstance.value.resize()
  }
}

// ==================== 生命周期钩子 ====================
onMounted(() => {
  nextTick(() => {
    initChart()
    updateChart()
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
})

// ==================== 监听器 ====================
watch(() => props.seriesData, () => {
  updateChart()
}, { deep: true })

watch(() => props.year, () => {
  // 标题会自动更新，无需额外操作
})
</script>

<style scoped>
.land-use-pie-chart {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(42, 61, 110, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.chart-title {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 600;
  color: #9cc9ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(42, 61, 110, 0.3);
}

.chart-container {
  width: 100%;
  height: 350px;
}

/* 紧凑模式 */
.land-use-pie-chart.compact .chart-container {
  height: 250px;
}

.land-use-pie-chart.compact .chart-title {
  display: none;
}

.loading-message,
.no-data-message {
  position: absolute;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
