<template>
  <div class="left-panel-container">
    <!-- 1. 关键指标卡片 -->
    <div class="section-container" style="flex: 0 0 20%;">
      <TechBorder color="#0ea5e9">
        <div class="panel-title centered-title">实时监测</div>
        <div v-if="loading" class="loading-placeholder">加载中...</div>
        <div v-else class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">耕地保有量</div>
            <div class="metric-value text-green">{{ animatedCropland.toFixed(2) }}</div>
            <div class="metric-unit">km²</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">建设用地</div>
            <div class="metric-value text-red">{{ animatedImpervious.toFixed(2) }}</div>
            <div class="metric-unit">km²</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">森林覆盖率</div>
            <div class="metric-value text-blue">{{ animatedForestRate }}%</div>
            <div class="metric-unit">占比</div>
          </div>
        </div>
      </TechBorder>
    </div>

    <!-- 2. 动态度排行 -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#0ea5e9">
        <div class="panel-title centered-title">
          <select v-model="dynamicType" class="type-select" @change="fetchData">
            <option value="comprehensive">综合</option>
            <option value="cropland">耕地</option>
            <option value="forest">森林</option>
            <option value="grassland">草地</option>
            <option value="impervious">建设用地</option>
            <option value="water">水域</option>
          </select>
          动态度排行
        </div>
        <div class="chart-wrapper">
          <DynamicDegreeBar :data="rankingData" :type="dynamicType" />
        </div>
      </TechBorder>
    </div>

    <!-- 3. 土地利用演变监测 -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#0ea5e9">
        <div style="height: 100%; display: flex; flex-direction: column;">
          <div class="panel-title centered-title">土地利用演变监测</div>
          <div class="gauge-area" style="flex: 1; width: 100%; min-height: 0;">
            <LandUseChangeChart :currentData="currentData" :baseData="baseData" />
          </div>
        </div>
      </TechBorder>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import TechBorder from '../ui/TechBorder.vue';
import DynamicDegreeBar from '../charts/DynamicDegreeBar.vue';
import LandUseChangeChart from '../charts/LandUseChangeChart.vue';
import { analysisApi } from '../../api/index.js';
import { transformDataForCalculation } from '../../utils/indices.ts';

const props = defineProps({
  year: { type: Number, default: 2023 }
});

const currentData = ref({});
const baseData = ref({});
const rankingData = ref([]);
const alertsData = ref([]);
const loading = ref(true);
const dynamicType = ref('comprehensive');

// 动画数值
const animatedCropland = ref(0);
const animatedImpervious = ref(0);
const animatedForestRate = ref(0);

const forestRate = computed(() => {
  const forest = currentData.value.Forest || 0;
  const total = Object.values(currentData.value).reduce((a, b) => typeof b === 'number' ? a + b : a, 0);
  return total ? parseFloat(((forest / total) * 100).toFixed(1)) : 0;
});



async function fetchData() {
  loading.value = true;
  try {
    const data = await analysisApi.getDashboardData(props.year, dynamicType.value);
    if (data) {
      console.log(`[Dashboard] Received ranking for ${dynamicType.value}:`, data.ranking);
      currentData.value = transformDataForCalculation(data.summary);
      baseData.value = transformDataForCalculation(data.baseSummary);
      rankingData.value = data.ranking || [];
      alertsData.value = data.alerts || [];

      // 直接赋值，移除动画
      animatedCropland.value = (currentData.value.Cropland || 0) / 1000000;
      animatedImpervious.value = (currentData.value.Impervious || 0) / 1000000;
      animatedForestRate.value = forestRate.value;
    }
  } catch (e) {
    console.error('DashboardLeftPanel fetch failed', e);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchData);
watch(() => props.year, fetchData);
</script>

<style scoped>
.left-panel-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.section-container {
  width: 100%;
  min-height: 0;
}

.panel-title {
  font-size: 16px;
  font-weight: bold;
  color: #a5ccff;
  margin-bottom: 15px;
  padding-left: 12px;
  border-left: 4px solid #3b82f6;
  display: flex;
  align-items: center;
  text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  letter-spacing: 1px;
}

.panel-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(59, 130, 246, 0.5), transparent);
  margin-left: 15px;
}

.centered-title {
  justify-content: center;
  padding-left: 0;
  border-left: none;
}

.centered-title::before {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to left, rgba(59, 130, 246, 0.5), transparent);
  margin-right: 15px;
}

.centered-title::after {
  display: block;
  /* Ensure it's visible */
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(59, 130, 246, 0.5), transparent);
  margin-left: 15px;
}

.type-select {
  margin-right: 10px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(59, 130, 246, 0.5);
  color: #a5ccff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  transition: all 0.3s;
  z-index: 10;
}

.type-select:hover {
  border-color: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
}

.type-select option {
  background: #0f172a;
  color: #a5ccff;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  height: calc(100% - 25px);
  align-content: center;
}

.metric-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  padding: 10px 5px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.metric-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 20px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.metric-unit {
  font-size: 10px;
  color: #64748b;
}

.text-green {
  color: #22c55e;
}

.text-red {
  color: #ef4444;
}

.text-blue {
  color: #3b82f6;
}

.chart-wrapper {
  width: 100%;
  height: calc(100% - 25px);
}

.warning-layout {
  display: flex;
  height: calc(100% - 25px);
  gap: 10px;
}

.gauge-area {
  flex: 1;
}

.list-area {
  flex: 1.2;
  overflow: hidden;
}

.loading-placeholder {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a5ccff;
  font-size: 14px;
}
</style>
