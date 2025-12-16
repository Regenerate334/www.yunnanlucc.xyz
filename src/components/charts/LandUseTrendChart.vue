<!-- 
  ===========================================
  土地利用变化趋势图组件
  ===========================================
  功能：显示不同年份土地利用类型的变化趋势（使用优化后的JSON数据）
-->
<template>
  <div class="land-use-trend-chart">
    <!-- 图表头部 -->
    <div class="chart-header">
      <div class="chart-title">土地利用类型变化趋势</div>
      <div class="chart-controls">
        <el-select v-model="startYear" placeholder="起始年份" class="year-select" size="small">
          <el-option
            v-for="year in availableYears"
            :key="year"
            :label="year"
            :value="year"
          />
        </el-select>
        <span style="color: #fff; margin: 0 4px;">-</span>
        <el-select v-model="endYear" placeholder="结束年份" class="year-select" size="small">
          <el-option
            v-for="year in availableYears"
            :key="year"
            :label="year"
            :value="year"
          />
        </el-select>
      </div>
    </div>
    
    <!-- ECharts容器 -->
    <div ref="chartContainer" class="chart-container"></div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-message">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="error-message">
      <div class="error-icon">⚠️</div>
      <div class="error-text">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

// ==================== 组件属性定义 ====================
const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
})

// ==================== 响应式数据 ====================
const chartContainer = ref(null)
const chartInstance = ref(null)
const startYear = ref(1985)
const endYear = ref(2023)

// ==================== 计算属性 ====================
const availableYears = computed(() => {
  if (!props.seriesData.length) return []
  return [...new Set(props.seriesData.map(item => item.year))].sort((a, b) => a - b)
})

const filteredData = computed(() => {
  if (!startYear.value || !endYear.value || !props.seriesData.length) {
    return []
  }
  
  return props.seriesData.filter(item => 
    item.year >= Math.min(startYear.value, endYear.value) && 
    item.year <= Math.max(startYear.value, endYear.value)
  ).sort((a, b) => a.year - b.year)
})

// ==================== 图表配置 ====================
const getChartOption = () => {
  if (!filteredData.value.length) return {}
  
  const years = filteredData.value.map(d => d.year)
  const landTypes = ['耕地', '林地', '灌木', '草地', '水域', '冰雪', '裸地', '建设用地', '湿地']
  
  // 颜色映射
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
  
  const series = landTypes.map(type => ({
    name: type,
    type: 'line',
    smooth: true,
    data: filteredData.value.map(d => d[type] || 0),
    itemStyle: {
      color: colors[type]
    },
    lineStyle: {
      color: colors[type]
    },
    emphasis: {
      focus: 'series'
    }
  }))

  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(42, 61, 110, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: { color: '#ffffff' },
      axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } }
    },
    legend: {
      data: landTypes,
      textStyle: { color: '#fff' },
      top: 10,
      type: 'scroll'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '60px',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: years,
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
      axisLabel: { color: '#fff', rotate: 45 }
    },
    yAxis: {
      type: 'value',
      name: '面积 (km²)',
      nameTextStyle: { color: '#fff' },
      axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.3)' } },
      axisLabel: { color: '#fff' },
      splitLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.1)' } }
    },
    series: series
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
  if (Object.keys(option).length > 0) {
    chartInstance.value.setOption(option, true)
  }
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
watch(() => props.seriesData, (newVal) => {
  if (newVal.length > 0 && availableYears.value.length > 0) {
    // 仅在初始化时设置一次
    if (startYear.value === 1985 && endYear.value === 2023) {
      startYear.value = availableYears.value[0]
      endYear.value = availableYears.value[availableYears.value.length - 1]
    }
    updateChart()
  }
}, { deep: true, immediate: true })

watch([startYear, endYear], () => {
  updateChart()
})
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(42, 61, 110, 0.95);
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  color: #9cc9ff;
}

.chart-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.year-select {
  width: 90px;
}

:deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2) inset !important;
}

:deep(.el-input__inner) {
  color: #ffffff !important;
}

.chart-container {
  width: 100%;
  height: calc(100% - 50px);
  min-height: 300px;
}

.loading-message,
.error-message {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(42, 61, 110, 0.9);
  z-index: 10;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(156, 201, 255, 0.2);
  border-top-color: #9cc9ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 12px;
  color: #ffffff;
  font-size: 14px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  color: #ff6b6b;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.error-text {
  font-size: 14px;
}
</style>
