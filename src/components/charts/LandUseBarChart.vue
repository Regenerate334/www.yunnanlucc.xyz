<!-- 
  ===========================================
  土地利用类型面积柱状图组件
  ===========================================
  功能：显示指定年份各地类面积统计的柱状图
  特点：支持点击缩放、渐变色、阴影效果
-->
<template>
  <div class="land-use-bar-chart">
    <!-- 图表标题 -->
    <div class="chart-title">{{ chartTitle }}</div>
    
    <!-- ECharts容器 -->
    <div ref="chartContainer" class="chart-container"></div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">正在加载数据...</div>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="error-message">
      <div class="error-icon">⚠️</div>
      <div class="error-text">{{ error }}</div>
      <button @click="retry" class="retry-button">重试</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import * as echarts from 'echarts'

// ==================== 组件属性定义 ====================
const props = defineProps({
  selectedYear: {
    type: Number,
    required: true
  },
  width: {
    type: [String, Number],
    default: '100%'
  },
  height: {
    type: [String, Number],
    default: '400px'
  }
})

// ==================== 响应式数据 ====================
const chartContainer = ref(null)
const chartInstance = ref(null)
const loading = ref(false)
const error = ref('')
const chartData = ref([])

// ==================== 计算属性 ====================
const chartTitle = computed(() => {
  return `${props.selectedYear}年云南土地利用类型面积统计`
})

// ==================== 数据获取函数 ====================
/**
 * 从后端API获取指定年份的土地利用数据
 * @param {number} year - 年份
 */
const fetchLandUseData = async (year) => {
  if (!year) return
  
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch(`/api/clcd/${year}/summary`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log(`获取${year}年数据:`, data)
    
    // 处理数据格式
    chartData.value = data.map(item => ({
      name: item.class_name,
      value: item.area_km2,
      code: item.class_code
    }))
    
    // 更新图表
    updateChart()
    
  } catch (err) {
    console.error('获取土地利用数据失败:', err)
    error.value = `数据加载失败: ${err.message}`
  } finally {
    loading.value = false
  }
}

// ==================== 图表配置 ====================
/**
 * 获取ECharts配置选项
 */
const getChartOption = () => {
  const dataAxis = chartData.value.map(item => item.name)
  const data = chartData.value.map(item => item.value)
  const yMax = Math.max(...data) * 1.1 // 留10%的顶部空间
  
  return {
    title: {
      text: chartTitle.value,
      left: 'center',
      textStyle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      backgroundColor: 'rgba(42, 61, 110, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      textStyle: {
        color: '#ffffff'
      },
      formatter: function(params) {
        const data = params[0]
        return `${data.name}<br/>面积: ${data.value.toFixed(2)} km²`
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dataAxis,
      axisLabel: {
        color: '#ffffff',
        fontSize: 12,
        rotate: 45 // 旋转标签以避免重叠
      },
      axisTick: {
        show: false
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.3)'
        }
      }
    },
    yAxis: {
      type: 'value',
      name: '面积 (km²)',
      nameTextStyle: {
        color: '#ffffff'
      },
      axisLabel: {
        color: '#ffffff',
        formatter: function(value) {
          return value.toFixed(0)
        }
      },
      axisLine: {
        show: false
      },
      axisTick: {
        show: false
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
    series: [
      {
        name: '面积',
        type: 'bar',
        data: data,
        showBackground: true,
        backgroundStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#83bff6' },
            { offset: 0.5, color: '#188df0' },
            { offset: 1, color: '#188df0' }
          ]),
          borderRadius: [4, 4, 0, 0] // 圆角顶部
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#2378f7' },
              { offset: 0.7, color: '#2378f7' },
              { offset: 1, color: '#83bff6' }
            ])
          }
        },
        barWidth: '60%'
      }
    ]
  }
}

// ==================== 图表操作函数 ====================
/**
 * 初始化图表
 */
const initChart = () => {
  if (!chartContainer.value) return
  
  chartInstance.value = echarts.init(chartContainer.value)
  
  // 添加点击缩放功能
  const zoomSize = 3
  chartInstance.value.on('click', function(params) {
    if (params.componentType === 'series') {
      const dataIndex = params.dataIndex
      const startIndex = Math.max(dataIndex - zoomSize, 0)
      const endIndex = Math.min(dataIndex + zoomSize, chartData.value.length - 1)
      
      chartInstance.value.dispatchAction({
        type: 'dataZoom',
        startValue: startIndex,
        endValue: endIndex
      })
    }
  })
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
}

/**
 * 更新图表数据
 */
const updateChart = () => {
  if (!chartInstance.value) return
  
  const option = getChartOption()
  chartInstance.value.setOption(option, true)
}

/**
 * 处理窗口大小变化
 */
const handleResize = () => {
  if (chartInstance.value) {
    chartInstance.value.resize()
  }
}

/**
 * 重试加载数据
 */
const retry = () => {
  fetchLandUseData(props.selectedYear)
}

// ==================== 生命周期钩子 ====================
onMounted(() => {
  nextTick(() => {
    initChart()
    fetchLandUseData(props.selectedYear)
  })
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
})

// ==================== 监听器 ====================
// 监听年份变化，重新获取数据
watch(() => props.selectedYear, (newYear) => {
  if (newYear) {
    fetchLandUseData(newYear)
  }
}, { immediate: false })
</script>

<style scoped>
/* ==================== 图表容器样式 ==================== */
.land-use-bar-chart {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(42, 61, 110, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.chart-title {
  padding: 12px 16px;
  font-size: 16px;
  font-weight: 600;
  color: #9cc9ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(42, 61, 110, 0.95);
}

.chart-container {
  width: 100%;
  height: calc(100% - 50px);
  min-height: 350px;
}

/* ==================== 加载状态样式 ==================== */
.loading-overlay {
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
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #9cc9ff;
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

/* ==================== 错误状态样式 ==================== */
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
  padding: 20px;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.error-text {
  color: #ff6b6b;
  font-size: 14px;
  text-align: center;
  margin-bottom: 16px;
}

.retry-button {
  padding: 8px 16px;
  background: rgba(156, 201, 255, 0.2);
  border: 1px solid #9cc9ff;
  border-radius: 4px;
  color: #9cc9ff;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background: rgba(156, 201, 255, 0.3);
}
</style>
