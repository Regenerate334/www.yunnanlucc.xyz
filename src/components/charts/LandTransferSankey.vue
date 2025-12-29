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
        <label>时间段：</label>
        <div class="custom-dropdown" ref="dropdownRef">
          <div class="dropdown-trigger" @click="toggleDropdown">
            <span>{{ formatPeriod(selectedPeriod) }}</span>
            <span class="arrow" :class="{ open: isDropdownOpen }">▼</span>
          </div>
          <transition name="dropdown-fade">
            <div v-if="isDropdownOpen" class="dropdown-options">
              <div v-for="period in availablePeriods" :key="period" class="dropdown-option"
                :class="{ active: selectedPeriod === period }" @click="selectPeriod(period)">
                {{ formatPeriod(period) }}
              </div>
            </div>
          </transition>
        </div>
      </div>
      <div class="control-group">
        <span class="note">注：数据为全省范围</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, computed } from 'vue'
import * as echarts from 'echarts'
import { loadLandUseConfig, loadTransferMatrixPeriods, loadTransferMatrixData } from '@/utils/clcdDataLoader'

// Props
const props = defineProps({
  // 保留 props 以兼容现有调用，但主要逻辑改为使用 period
  startYear: {
    type: Number,
    default: null
  },
  endYear: {
    type: Number,
    default: null
  }
})

// Refs
const chartContainer = shallowRef(null)
const chartInstance = shallowRef(null)
const loading = ref(true)
const error = ref(null)
const config = ref(null)
const transferData = ref(null)
const availablePeriods = ref([])
const selectedPeriod = ref('')
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

const selectPeriod = (period) => {
  selectedPeriod.value = period
  isDropdownOpen.value = false
  loadAndRender()
}

const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isDropdownOpen.value = false
  }
}

// Computed
const hasData = computed(() => transferData.value !== null)

// Methods
const formatPeriod = (period) => {
  return period.replace('_', ' - ')
}

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

    // 加载可用时间段
    if (availablePeriods.value.length === 0) {
      availablePeriods.value = await loadTransferMatrixPeriods()

      // 尝试根据 props 设置初始时间段
      if (props.startYear && props.endYear) {
        const target = `${props.startYear}_${props.endYear}`
        if (availablePeriods.value.includes(target)) {
          selectedPeriod.value = target
        }
      }

      // 如果没有匹配或未设置，默认选择第一个（通常是最早的）
      if (!selectedPeriod.value && availablePeriods.value.length > 0) {
        selectedPeriod.value = availablePeriods.value[0]
      }
    }

    if (!selectedPeriod.value) {
      error.value = '无可用时间段数据'
      return
    }

    // 加载选中时间段的数据
    transferData.value = await loadTransferMatrixData(selectedPeriod.value)

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

  // 创建链接（只显示显著转移，>0.1% 以显示更多细节，或者根据实际数据调整）
  // 数据库数据可能更精确，我们可以显示更细微的变化
  landTypes.forEach((fromType) => {
    const fromConfig = config.value.land_use_types.find(t => t.name_en === fromType)
    const fromName = fromConfig ? fromConfig.name_cn : fromType

    landTypes.forEach((toType) => {
      const value = matrix[fromType][toType]

      // 只显示显著的转移(>0.5%)和不同类型间的转移
      // 如果是相同类型，通常桑基图不显示或者显示为流向自己
      // 这里我们只关注变化
      if (value > 0.5 && fromType !== toType) {
        const toConfig = config.value.land_use_types.find(t => t.name_en === toType)
        const toName = toConfig ? toConfig.name_cn : toType

        links.push({
          source: `${fromName}(起)`,
          target: `${toName}(末)`,
          value: value,
          lineStyle: {
            color: 'source',
            opacity: 0.4
          }
        })
      }
    })
  })
  const option = {
    title: {
      text: `土地利用类型转移图 (${formatPeriod(selectedPeriod.value)})`,
      left: 'center',
      textStyle: {
        color: '#a5ccff',
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(13, 25, 48, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      textStyle: { color: '#fff' },
      formatter: (params) => {
        if (params.dataType === 'edge') {
          return `<div style="font-weight:600; margin-bottom:4px; color:#a5ccff;">转移路径</div>
                  ${params.data.source} → ${params.data.target}<br/>
                  转移比例: <span style="font-weight:600; color:#3b82f6;">${params.value.toFixed(2)}%</span>`
        }
        return `<div style="font-weight:600; color:#a5ccff;">${params.name}</div>`
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
          curveness: 0.5,
          opacity: 0.4
        },
        label: {
          fontSize: 12,
          color: '#fff'
        },
        layoutIterations: 32,
        nodeGap: 20,
        nodeWidth: 20,
        draggable: false
      }
    ]
  }

  chartInstance.value.setOption(option, true)
}

const loadAndRender = async () => {
  await loadData()
  if (hasData.value) {
    renderChart()
  }
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
.land-transfer-sankey {
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
  color: #a5ccff;
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
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.custom-dropdown {
  position: relative;
  min-width: 160px;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
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

.note {
  font-size: 12px;
  color: #999;
}
</style>
