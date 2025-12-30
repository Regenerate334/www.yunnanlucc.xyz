<template>
  <div class="left-panel-container">
    <!-- 1. 关键指标卡片 -->
    <div class="section-container" style="flex: 0 0 20%;">
      <TechBorder color="#0ea5e9">
        <div class="panel-title">实时监测 (Monitoring)</div>
        <div v-if="loading" class="loading-placeholder">加载中...</div>
        <div v-else class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">耕地保有量</div>
            <div class="metric-value text-green">{{ (currentData.Cropland / 1000000).toFixed(2) }}</div>
            <div class="metric-unit">km²</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">建设用地</div>
            <div class="metric-value text-red">{{ (currentData.Impervious / 1000000).toFixed(2) }}</div>
            <div class="metric-unit">km²</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">森林覆盖率</div>
            <div class="metric-value text-blue">{{ forestRate }}%</div>
            <div class="metric-unit">占比</div>
          </div>
        </div>
      </TechBorder>
    </div>

    <!-- 2. 动态度排行 -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#0ea5e9">
        <div class="panel-title">动态度排行 (Ranking)</div>
        <div class="chart-wrapper">
          <DynamicDegreeBar :data="rankingData" />
        </div>
      </TechBorder>
    </div>

    <!-- 3. 预警中心 -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#f59e0b">
        <div class="panel-title">预警中心 (Warning Center)</div>
        <div class="warning-layout">
          <div class="gauge-area">
            <WarningGauge :value="currentData.Cropland" :baseValue="baseData.Cropland" />
          </div>
          <div class="list-area">
            <AlertList :data="alertsData" />
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
import WarningGauge from '../charts/WarningGauge.vue';
import AlertList from '../controls/AlertList.vue';
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

const forestRate = computed(() => {
  const forest = currentData.value.Forest || 0;
  const total = Object.values(currentData.value).reduce((a, b) => typeof b === 'number' ? a + b : a, 0);
  return total ? ((forest / total) * 100).toFixed(1) : '0.0';
});

async function fetchData() {
  loading.value = true;
  try {
    const data = await analysisApi.getDashboardData(props.year);
    if (data) {
      currentData.value = transformDataForCalculation(data.summary);
      baseData.value = transformDataForCalculation(data.baseSummary);
      rankingData.value = data.ranking || [];
      alertsData.value = data.alerts || [];
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
  font-size: 14px;
  font-weight: bold;
  color: #e2e8f0;
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid currentColor;
  display: flex;
  align-items: center;
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
