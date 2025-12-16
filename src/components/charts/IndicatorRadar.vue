<template>
  <div class="indicator-radar">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>计算指标...</p>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    
    <div v-else ref="chartContainer" class="chart-container"></div>
    
    <!-- 控制栏 -->
    <div v-if="!loading && !error" class="chart-controls">
      <div class="control-group">
        <label>对比年份1：</label>
        <select v-model="selectedYear1" @change="loadAndRender">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>对比年份2：</label>
        <select v-model="selectedYear2" @change="loadAndRender">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { loadLandUseConfig, loadProvinceData } from '@/utils/clcdDataLoader'
import { 
  calculateStructureIndicators,
  calculateDevelopmentIntensity,
  calculateEcologicalSpaceIndicators
} from '@/utils/indicators'

// Props
const props = defineProps({
  year1: {
    type: Number,
    default: 2000
  },
  year2: {
    type: Number,
    default: 2023
  }
})

// Refs
const chartContainer = ref(null)
const chartInstance = ref(null)
const loading = ref(true)
const error = ref(null)
const availableYears = ref([])
const selectedYear1 = ref(props.year1)
const selectedYear2 = ref(props.year2)

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

const loadAndRender = async () => {
  try {
    loading.value = true
    error.value = null
    
    // 加载配置和数据
    const config = await loadLandUseConfig()
    const data = await loadProvinceData()
    
    // 提取可用年份
    availableYears.value = [...new Set(data.map(d => d.year))].sort((a, b) => a - b)
    
    // 获取两个年份的数据
    const data1 = data.find(d => d.year === selectedYear1.value)
    const data2 = data.find(d => d.year === selectedYear2.value)
    
    if (!data1 || !data2) {
      error.value = '所选年份数据不可用'
      return
    }
    
    // 计算指标
    const indicators1 = calculateIndicators(data1, config)
    const indicators2 = calculateIndicators(data2, config)
    
    // 渲染雷达图
    renderRadar(indicators1, indicators2)
    
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = err.message || '数据加载失败'
  } finally {
    loading.value = false
  }
}

const calculateIndicators = (data, config) => {
  const structure = calculateStructureIndicators(data, config)
  const development = calculateDevelopmentIntensity(data)
  const ecological = calculateEcologicalSpaceIndicators(data)
  
  return {
    // 标准化到0-100
    生产空间占比: structure.categorizedAreas.productionSpace.total / structure.totalArea * 100,
    生活空间占比: structure.categorizedAreas.livingSpace.total / structure.totalArea * 100,
    生态空间占比: structure.categorizedAreas.ecologicalSpace.total / structure.totalArea * 100,
    森林覆盖率: ecological.forestCoverage,
    植被覆盖率: ecological.vegetationCoverage,
    开发强度: development > 50 ? 100 - development * 2 : 100 - development // 反向，低开发强度=高分
  }
}

const renderRadar = (indicators1, indicators2) => {
  if (!chartInstance.value) return
  
  const option = {
    title: {
      text: `国土空间指标雷达对比`,
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        let result = `<strong>${params.name}</strong><br/>`
        params.value.forEach((val, index) => {
          const indicator = option.radar.indicator[index].name
          result += `${indicator}: ${val.toFixed(2)}%<br/>`
        })
        return result
      }
    },
    legend: {
      data: [`${selectedYear1.value}年`, `${selectedYear2.value}年`],
      top: 40,
      textStyle: {
        fontSize: 14
      }
    },
    radar: {
      name: {
        textStyle: {
          fontSize: 14,
          color: '#333'
        }
      },
      indicator: [
        { name: '生产空间占比', max: 100 },
        { name: '生活空间占比', max: 100 },
        { name: '生态空间占比', max: 100 },
        { name: '森林覆盖率', max: 100 },
        { name: '植被覆盖率', max: 100 },
        { name: '集约利用度', max: 100 }
      ],
      center: ['50%', '60%'],
      radius: '60%'
    },
    series: [
      {
        name: '国土空间指标',
        type: 'radar',
        emphasis: {
          lineStyle: {
            width: 4
          }
        },
        data: [
          {
            value: Object.values(indicators1),
            name: `${selectedYear1.value}年`,
            itemStyle: {
              color: '#667eea'
            },
            areaStyle: {
              color: 'rgba(102, 126, 234, 0.3)'
            }
          },
          {
            value: Object.values(indicators2),
            name: `${selectedYear2.value}年`,
            itemStyle: {
              color: '#f093fb'
            },
            areaStyle: {
              color: 'rgba(240, 147, 251, 0.3)'
            }
          }
        ]
      }
    ]
  }
  
  chartInstance.value.setOption(option)
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
.indicator-radar {
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
  min-height: 450px;
}

.loading-state,
.error-state {
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
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  color: #666;
}

.control-group select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
  cursor: pointer;
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
