<template>
  <div class="stacked-area-chart">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载时间序列数据...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    
    <div v-else-if="!hasData" class="no-data-state">
      <p>暂无数据</p>
    </div>
    
    <div v-else ref="chartContainer" class="chart-container"></div>
    
    <!-- 图表控制栏 -->
    <div v-if="!loading && hasData" class="chart-controls">
      <div class="control-group">
        <label>起始年份：</label>
        <select v-model="selectedStartYear" @change="renderChart">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>结束年份：</label>
        <select v-model="selectedEndYear" @change="renderChart">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <button @click="toggleLandTypes" class="toggle-btn">
          {{ showAllTypes ? '显示主要类型' : '显示全部类型' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { loadLandUseConfig, loadProvinceData } from '@/utils/clcdDataLoader'

// Props
const props = defineProps({
  startYear: {
    type: Number,
    default: 1985
  },
  endYear: {
    type: Number,
    default: 2023
  },
  region: {
    type: String,
    default: null
  },
  level: {
    type: String,
    default: 'province'
  }
})

// Refs
const chartContainer = ref(null)
const chartInstance = ref(null)
const loading = ref(true)
const error = ref(null)
const config = ref(null)
const timeSeriesData = ref([])
const availableYears = ref([])
const selectedStartYear = ref(props.startYear)
const selectedEndYear = ref(props.endYear)
const showAllTypes = ref(false)

// Computed
const hasData = computed(() => timeSeriesData.value.length > 0)

const majorLandTypes = ['cropland', 'forest', 'grassland', 'impervious']

const displayLandTypes = computed(() => {
  if (!config.value) return []
  if (showAllTypes.value) {
    return config.value.land_use_types.map(t => t.name_en)
  }
  return majorLandTypes
})

// Methods
const initChart = () => {
  if (!chartContainer.value) return
  
  chartInstance.value = echarts.init(chartContainer.value)
  
  window.addEventListener('resize', handleResize)
}

const handleResize = () => {
  if (chartInstance.value) {
    chartInstance.value.resize()
  }
}

const loadData = async () => {
  try {
    loading.value = true
    error.value = null
    
    // 加载配置
    if (!config.value) {
      config.value = await loadLandUseConfig()
    }
    
    // 加载省级时间序列数据（可扩展为其他层级）
    const data = await loadProvinceData()
    
    // 按年份排序
    timeSeriesData.value = data.sort((a, b) => a.year - b.year)
    
    // 提取可用年份
    availableYears.value = [...new Set(data.map(d => d.year))].sort((a, b) => a - b)
    
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = err.message || '数据加载失败'
  } finally {
    loading.value = false
  }
}

const renderChart = () => {
  if (!chartInstance.value || !hasData.value || !config.value) return
  
  // 筛选时间范围
  const filteredData = timeSeriesData.value.filter(
    d => d.year >= selectedStartYear.value && d.year <= selectedEndYear.value
  )
  
  if (filteredData.length === 0) {
    error.value = '所选时间范围无数据'
    return
  }
  
  // 准备数据
  const years = filteredData.map(d => d.year)
  const series = []
  
  displayLandTypes.value.forEach(type => {
    const typeConfig = config.value.land_use_types.find(t => t.name_en === type)
    if (!typeConfig) return
    
    const data = filteredData.map(d => d[type] || 0)
    
    series.push({
      name: typeConfig.name_cn,
      type: 'line',
      stack: 'total',
      smooth: true,
      areaStyle: {
        opacity: 0.7
      },
      emphasis: {
        focus: 'series'
      },
      data: data,
      itemStyle: {
        color: typeConfig.color
      },
      lineStyle: {
        width: 2
      }
    })
  })
  
  const option = {
    title: {
      text: `土地利用类型面积变化 (${selectedStartYear.value}-${selectedEndYear.value})`,
      left: 'center',
      textStyle: {
        color: '#333',
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      },
      formatter: (params) => {
        let result = `<strong>${params[0].axisValue}年</strong><br/>`
        let total = 0
        params.forEach(param => {
          total += param.value
          result += `${param.marker} ${param.seriesName}: ${param.value.toFixed(2)} km²<br/>`
        })
        result += `<br/><strong>总计: ${total.toFixed(2)} km²</strong>`
        return result
      }
    },
    legend: {
      data: series.map(s => s.name),
      top: 40,
      type: 'scroll',
      textStyle: {
        fontSize: 12
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '60px',
      top: '100px',
      containLabel: true
    },
    toolbox: {
      feature: {
        saveAsImage: {
          title: '保存为图片'
        },
        dataZoom: {
          yAxisIndex: 'none',
          title: {
            zoom: '区域缩放',
            back: '还原缩放'
          }
        },
        restore: {
          title: '还原'
        }
      }
    },
    dataZoom: [
      {
        type: 'slider',
        show: true,
        start: 0,
        end: 100,
        bottom: 10
      },
      {
        type: 'inside',
        start: 0,
        end: 100
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: years,
      name: '年份',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: {
        fontSize: 12,
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '面积 (km²)',
      nameLocation: 'middle',
      nameGap: 50,
      axisLabel: {
        formatter: '{value}'
      }
    },
    series: series
  }
  
  chartInstance.value.setOption(option, true)
}

const toggleLandTypes = () => {
  showAllTypes.value = !showAllTypes.value
  renderChart()
}

// Lifecycle
onMounted(async () => {
  initChart()
  await loadData()
  if (hasData.value) {
    renderChart()
  }
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.stacked-area-chart {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.chart-container {
  flex: 1;
  min-height: 500px;
}

.loading-state,
.error-state,
.no-data-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  color: #f44336;
}

.chart-controls {
  display: flex;
  gap: 20px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
  margin-top: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.control-group select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}

.control-group select:hover {
  border-color: #667eea;
}

.control-group select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.toggle-btn {
  padding: 6px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.toggle-btn:active {
  transform: translateY(0);
}
</style>
