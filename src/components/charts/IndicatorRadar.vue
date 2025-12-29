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
        <div class="custom-dropdown" ref="dropdown1Ref">
          <div class="dropdown-trigger" @click="toggleDropdown1">
            <span>{{ selectedYear1 }}</span>
            <span class="arrow" :class="{ open: isDropdown1Open }">▼</span>
          </div>
          <transition name="dropdown-fade">
            <div v-if="isDropdown1Open" class="dropdown-options">
              <div v-for="year in availableYears" :key="year" class="dropdown-option"
                :class="{ active: selectedYear1 === year }" @click="selectYear1(year)">
                {{ year }}
              </div>
            </div>
          </transition>
        </div>
      </div>

      <div class="control-group">
        <label>对比年份2：</label>
        <div class="custom-dropdown" ref="dropdown2Ref">
          <div class="dropdown-trigger" @click="toggleDropdown2">
            <span>{{ selectedYear2 }}</span>
            <span class="arrow" :class="{ open: isDropdown2Open }">▼</span>
          </div>
          <transition name="dropdown-fade">
            <div v-if="isDropdown2Open" class="dropdown-options">
              <div v-for="year in availableYears" :key="year" class="dropdown-option"
                :class="{ active: selectedYear2 === year }" @click="selectYear2(year)">
                {{ year }}
              </div>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted } from 'vue'
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
const chartContainer = shallowRef(null)
const chartInstance = shallowRef(null)
const loading = ref(true)
const error = ref(null)
const availableYears = ref([])
const selectedYear1 = ref(props.year1)
const selectedYear2 = ref(props.year2)
const isDropdown1Open = ref(false)
const isDropdown2Open = ref(false)
const dropdown1Ref = ref(null)
const dropdown2Ref = ref(null)

const toggleDropdown1 = () => { isDropdown1Open.value = !isDropdown1Open.value; isDropdown2Open.value = false; }
const toggleDropdown2 = () => { isDropdown2Open.value = !isDropdown2Open.value; isDropdown1Open.value = false; }

const selectYear1 = (year) => {
  selectedYear1.value = year
  isDropdown1Open.value = false
  loadAndRender()
}

const selectYear2 = (year) => {
  selectedYear2.value = year
  isDropdown2Open.value = false
  loadAndRender()
}

const handleClickOutside = (event) => {
  if (dropdown1Ref.value && !dropdown1Ref.value.contains(event.target)) isDropdown1Open.value = false
  if (dropdown2Ref.value && !dropdown2Ref.value.contains(event.target)) isDropdown2Open.value = false
}

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
        color: '#a5ccff'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 25, 48, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      textStyle: { color: '#fff' },
      formatter: (params) => {
        let result = `<div style="font-weight:600; margin-bottom:8px; color:#a5ccff;">${params.name}</div>`
        params.value.forEach((val, index) => {
          const indicator = option.radar.indicator[index].name
          result += `<div style="display:flex; justify-content:space-between; gap:20px; font-size:12px;">
            <span style="color:rgba(255,255,255,0.7);">${indicator}:</span>
            <span style="font-weight:600;">${val.toFixed(2)}%</span>
          </div>`
        })
        return result
      }
    },
    legend: {
      data: [`${selectedYear1.value}年`, `${selectedYear2.value}年`],
      top: 40,
      textStyle: {
        fontSize: 14,
        color: '#fff'
      }
    },
    radar: {
      name: {
        textStyle: {
          fontSize: 14,
          color: '#a5ccff'
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
      radius: '60%',
      splitArea: {
        areaStyle: {
          color: ['rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.05)']
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
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
              color: '#3b82f6'
            },
            areaStyle: {
              color: 'rgba(59, 130, 246, 0.3)'
            }
          },
          {
            value: Object.values(indicators2),
            name: `${selectedYear2.value}年`,
            itemStyle: {
              color: '#f43f5e'
            },
            areaStyle: {
              color: 'rgba(244, 63, 94, 0.3)'
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
  document.addEventListener('click', handleClickOutside)
  initChart()
  await loadAndRender()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
  background: rgba(13, 25, 48, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 24px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error-state {
  color: #f44336;
}

.chart-controls {
  display: flex;
  gap: 30px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 20px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.custom-dropdown {
  position: relative;
  min-width: 100px;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.dropdown-trigger span {
  pointer-events: none;
}

.dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.arrow {
  font-size: 10px;
  color: #a5ccff;
  transition: transform 0.3s;
}

.arrow.open {
  transform: rotate(180deg);
}

.dropdown-options {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  background: rgba(13, 25, 48, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 6px;
  z-index: 1001;
  backdrop-filter: blur(24px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  min-width: 100%;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-options::-webkit-scrollbar {
  width: 4px;
}

.dropdown-options::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.dropdown-option {
  padding: 10px 16px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  text-align: left;
}

.dropdown-option:hover {
  background: rgba(59, 130, 246, 0.1);
  color: #ffffff;
}

.dropdown-option.active {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
  font-weight: 600;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(5px);
}
</style>
