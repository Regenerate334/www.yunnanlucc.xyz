<template>
  <div class="kpi-dashboard">
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
    </div>
    
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>
    
    <div v-else class="kpi-grid">
      <!-- 土地利用结构 -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 3h18v18H3z" stroke-width="2"/>
            <path d="M3 9h18M9 3v18" stroke-width="2"/>
          </svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">总面积</div>
          <div class="kpi-value">{{ formatNumber(kpiData.totalArea) }}</div>
          <div class="kpi-unit">km²</div>
        </div>
      </div>

      <!-- 生态空间占比 -->
      <div class="kpi-card" :class="getStatusClass(kpiData.ecologicalRatio, 70, 50)">
        <div class="kpi-icon" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke-width="2"/>
          </svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">生态空间占比</div>
          <div class="kpi-value">{{ formatPercent(kpiData.ecologicalRatio) }}</div>
          <div class="kpi-change" :class="kpiData.ecologicalChange > 0 ? 'positive' : 'negative'">
            {{ formatChange(kpiData.ecologicalChange) }}
          </div>
        </div>
        <div class="kpi-status">
          <span class="status-indicator"></span>
          {{ getStatus(kpiData.ecologicalRatio, 70, 50) }}
        </div>
      </div>

      <!-- 森林覆盖率 -->
      <div class="kpi-card" :class="getStatusClass(kpiData.forestCoverage, 60, 40)">
        <div class="kpi-icon" style="background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="2"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke-width="2"/>
          </svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">森林覆盖率</div>
          <div class="kpi-value">{{ formatPercent(kpiData.forestCoverage) }}</div>
          <div class="kpi-change" :class="kpiData.forestChange > 0 ? 'positive' : 'negative'">
            {{ formatChange(kpiData.forestChange) }}
          </div>
        </div>
        <div class="kpi-status">
          <span class="status-indicator"></span>
          {{ getStatus(kpiData.forestCoverage, 60, 40) }}
        </div>
      </div>

      <!-- 耕地面积 -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke-width="2"/>
          </svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">耕地面积</div>
          <div class="kpi-value">{{ formatNumber(kpiData.croplandArea) }}</div>
          <div class="kpi-unit">km²</div>
          <div class="kpi-change" :class="kpiData.croplandChange > 0 ? 'positive' : 'negative'">
            {{ formatChange(kpiData.croplandChange) }}
          </div>
        </div>
      </div>

      <!-- 建设用地 -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke-width="2"/>
            <polyline points="9 22 9 12 15 12 15 22" stroke-width="2"/>
          </svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">建设用地</div>
          <div class="kpi-value">{{ formatNumber(kpiData.urbanArea) }}</div>
          <div class="kpi-unit">km²</div>
          <div class="kpi-change positive">
            {{ formatChange(kpiData.urbanChange) }}
          </div>
        </div>
      </div>

      <!-- 开发强度 -->
      <div class="kpi-card" :class="getStatusClass(100 - kpiData.developmentIntensity, 95, 85)">
        <div class="kpi-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke-width="2"/>
          </svg>
        </div>
        <div class="kpi-content">
          <div class="kpi-label">开发强度</div>
          <div class="kpi-value">{{ formatPercent(kpiData.developmentIntensity) }}</div>
          <div class="kpi-subtitle">集约度评分</div>
        </div>
        <div class="kpi-status">
          <span class="status-indicator"></span>
          {{ getStatus(100 - kpiData.developmentIntensity, 95, 85) }}
        </div>
      </div>

      <!-- 年份选择卡片 -->
      <div class="kpi-card control-card">
        <div class="control-content">
          <label>监测年份</label>
          <select v-model="selectedYear" @change="loadData" class="year-selector">
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}年
            </option>
          </select>
          
          <label>对比基准</label>
          <select v-model="baseYear" @change="loadData" class="year-selector">
            <option v-for="year in availableYears" :key="year" :value="year">
              {{ year }}年
            </option>
          </select>
        </div>
      </div>

      <!-- 更新时间 -->
      <div class="kpi-card info-card">
        <div class="info-content">
          <div class="info-label">数据源</div>
          <div class="info-value">CLCD 1985-2023</div>
          <div class="info-label">更新时间</div>
          <div class="info-value">{{ updateTime }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { loadLandUseConfig, loadProvinceData } from '@/utils/clcdDataLoader'
import {
  calculateStructureIndicators,
  calculateDevelopmentIntensity,
  calculateEcologicalSpaceIndicators
} from '@/utils/indicators'

// Refs
const loading = ref(true)
const error = ref(null)
const kpiData = ref({})
const availableYears = ref([])
const selectedYear = ref(2023)
const baseYear = ref(2000)
const updateTime = ref('')

// Methods
const loadData = async () => {
  try {
    loading.value = true
    error.value = null
    
    const config = await loadLandUseConfig()
    const data = await loadProvinceData()
    
    // 提取年份
    availableYears.value = [...new Set(data.map(d => d.year))].sort((a, b) => a - b)
    
    // 获取选定年份和基准年份数据
    const currentData = data.find(d => d.year === selectedYear.value)
    const baseData = data.find(d => d.year === baseYear.value)
    
    if (!currentData || !baseData) {
      error.value = '数据不完整'
      return
    }
    
    // 计算指标
    const structure = calculateStructureIndicators(currentData, config)
    const ecological = calculateEcologicalSpaceIndicators(currentData)
    const development = calculateDevelopmentIntensity(currentData)
    
    const baseEcological = calculateEcologicalSpaceIndicators(baseData)
    
    // 构建KPI数据
    kpiData.value = {
      totalArea: structure.totalArea,
      ecologicalRatio: ecological.ecologicalRatio,
      ecologicalChange: ecological.ecologicalRatio - baseEcological.ecologicalRatio,
      forestCoverage: ecological.forestCoverage,
      forestChange: ecological.forestCoverage - calculateEcologicalSpaceIndicators(baseData).forestCoverage,
      croplandArea: currentData.cropland || 0,
      croplandChange: (currentData.cropland || 0) - (baseData.cropland || 0),
      urbanArea: currentData.impervious || 0,
      urbanChange: (currentData.impervious || 0) - (baseData.impervious || 0),
      developmentIntensity: development
    }
    
    updateTime.value = new Date().toLocaleDateString('zh-CN')
    
  } catch (err) {
    console.error('加载失败:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const formatNumber = (num) => {
  if (!num) return '0'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

const formatPercent = (num) => {
  if (!num) return '0%'
  return `${num.toFixed(2)}%`
}

const formatChange = (num) => {
  if (!num) return '0%'
  const prefix = num > 0 ? '+' : ''
  return `${prefix}${num.toFixed(2)}%`
}

const getStatus = (value, goodThreshold, fairThreshold) => {
  if (value >= goodThreshold) return '优秀'
  if (value >= fairThreshold) return '良好'
  return '预警'
}

const getStatusClass = (value, goodThreshold, fairThreshold) => {
  if (value >= goodThreshold) return 'status-good'
  if (value >= fairThreshold) return 'status-fair'
  return 'status-warning'
}

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.kpi-dashboard {
  width: 100%;
  height: 100%;
  position: relative;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 12px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.kpi-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
}

.kpi-card.status-good {
  border-left: 4px solid #4caf50;
}

.kpi-card.status-fair {
  border-left: 4px solid #ff9800;
}

.kpi-card.status-warning {
  border-left: 4px solid #f44336;
}

.kpi-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.kpi-icon svg {
  width: 28px;
  height: 28px;
  color: white;
}

.kpi-content {
  position: relative;
}

.kpi-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.kpi-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  line-height: 1.2;
}

.kpi-unit {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.kpi-subtitle {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.kpi-change {
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}

.kpi-change.positive {
  color: #4caf50;
}

.kpi-change.negative {
  color: #f44336;
}

.kpi-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 13px;
  font-weight: 500;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4caf50;
}

.status-warning .status-indicator {
  background: #f44336;
}

.status-fair .status-indicator {
  background: #ff9800;
}

.control-card,
.info-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.control-content,
.info-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-content label,
.info-label {
  font-size: 13px;
  opacity: 0.9;
  font-weight: 500;
}

.year-selector {
  padding: 10px 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.year-selector:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
}

.year-selector option {
  color: #333;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
}

.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #f44336;
}
</style>
