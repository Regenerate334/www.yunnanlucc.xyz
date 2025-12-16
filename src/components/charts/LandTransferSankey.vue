<template>
  <div class="land-transfer-sankey">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载土地转移数据...</p>
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
        <select v-model="selectedStartYear" @change="loadAndRender">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>结束年份：</label>
        <select v-model="selectedEndYear" @change="loadAndRender">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>地区层级：</label>
        <select v-model="level" @change="loadAndRender">
          <option value="province">省级</option>
          <option value="prefecture">地级市</option>
          <option value="county">县级</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { loadLandUseConfig, loadProvinceData, loadPrefectureData, loadCountyData } from '@/utils/clcdDataLoader'
import { generateTransferMatrix } from '@/utils/indicators'

// Props
const props = defineProps({
  startYear: {
    type: Number,
    default: 2000
  },
  endYear: {
    type: Number,
    default: 2020
  },
  region: {
    type: String,
    default: null
  }
})

// Refs
const chartContainer = ref(null)
const chartInstance = ref(null)
const loading = ref(true)
const error = ref(null)
const config = ref(null)
const transferData = ref(null)
const availableYears = ref([])
const selectedStartYear = ref(props.startYear)
const selectedEndYear = ref(props.endYear)
const level = ref('province')

// Computed
const hasData = computed(() => transferData.value !== null)

// Methods
const initChart = () => {
  if (!chartContainer.value) return
  
  chartInstance.value = echarts.init(chartContainer.value)
  
  // 监听窗口大小变化
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
    
    // 根据层级加载数据
    let dataArray
    switch (level.value) {
      case 'province':
        dataArray = await loadProvinceData()
        break
      case 'prefecture':
        dataArray = await loadPrefectureData()
        break
      case 'county':
        dataArray = await loadCountyData()
        break
      default:
        dataArray = await loadProvinceData()
    }
    
    // 提取可用年份
    const years = [...new Set(dataArray.map(d => d.year))].sort((a, b) => a - b)
    availableYears.value = years
    
    // 筛选起止年份数据
    const t1Data = dataArray.filter(d => d.year === selectedStartYear.value)
    const t2Data = dataArray.filter(d => d.year === selectedEndYear.value)
    
    if (t1Data.length === 0 || t2Data.length === 0) {
      error.value = '所选年份数据不完整'
      return
    }
    
    // 生成转移矩阵
    transferData.value = generateTransferMatrix(t1Data, t2Data)
    
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = err.message || '数据加载失败'
  } finally {
    loading.value = false
  }
}

const renderChart = () => {
  if (!chartInstance.value || !transferData.value || !config.value) return
  
  const matrix = transferData.value.percentageMatrix
  const landTypes = transferData.value.landTypes
  
  // 构建桑基图数据
  const nodes = []
  const links = []
  
  // 创建节点（起始和结束状态）
  landTypes.forEach(type => {
    const typeConfig = config.value.land_use_types.find(t => t.name_en === type)
    const name = typeConfig ? typeConfig.name_cn : type
    const color = typeConfig ? typeConfig.color : '#999'
    
    nodes.push({
      name: `${name}(起)`,
      itemStyle: { color }
    })
    nodes.push({
      name: `${name}(末)`,
      itemStyle: { color }
    })
  })
  
  // 创建链接（只显示显著转移，>1%）
  landTypes.forEach((fromType, i) => {
    const fromConfig = config.value.land_use_types.find(t => t.name_en === fromType)
    const fromName = fromConfig ? fromConfig.name_cn : fromType
    
    landTypes.forEach((toType, j) => {
      const value = matrix[fromType][toType]
      
      // 只显示显著的转移(>1%)和不同类型间的转移
      if (value > 1 && fromType !== toType) {
        const toConfig = config.value.land_use_types.find(t => t.name_en === toType)
        const toName = toConfig ? toConfig.name_cn : toType
        
        links.push({
          source: `${fromName}(起)`,
          target: `${toName}(末)`,
          value: value,
          lineStyle: {
            color: 'source'
          }
        })
      }
    })
  })
  
  const option = {
    title: {
      text: `土地利用类型转移图 (${selectedStartYear.value}-${selectedEndYear.value})`,
      left: 'center',
      textStyle: {
        color: '#333',
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}<br/>转移比例: ${params.value.toFixed(2)}%`
        }
        return params.name
      }
    },
    series: [
      {
        type: 'sankey',
        data: nodes,
        links: links,
        emphasis: {
          focus: 'adjacency'
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5
        },
        label: {
          fontSize: 12,
          color: '#333'
        },
        layoutIterations: 32,
        nodeGap: 20,
        nodeWidth: 20
      }
    ]
  }
  
  chartInstance.value.setOption(option)
}

const loadAndRender = async () => {
  await loadData()
  if (hasData.value) {
    renderChart()
  }
}

// Lifecycle
onMounted(async () => {
  initChart()
  await loadAndRender()
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.dispose()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.land-transfer-sankey {
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
</style>
