<template>
  <div class="monitoring-panel-wrapper">
    <!-- 触发按钮 -->
    <button @click="togglePanel" class="control-btn" :class="{ active: isVisible }" title="土地利用综合监测">
      <span class="icon">📊</span>
      <span class="btn-label">监测</span>
    </button>

    <transition name="fade">
      <div v-if="isVisible" class="modal-backdrop" @click="togglePanel"></div>
    </transition>

    <transition name="slide-up">
      <div v-if="isVisible" class="modal-window" @click.stop>
        <div class="modal-header">
          <div class="header-left">
            <span class="modal-title">土地利用综合监测与预警系统</span>
            <span class="modal-subtitle">{{ year }}年</span>
          </div>
          <div class="header-right">
            <div class="tabs">
              <button 
                v-for="tab in tabs" 
                :key="tab.id"
                class="tab-btn"
                :class="{ active: currentTab === tab.id }"
                @click="currentTab = tab.id"
              >
                {{ tab.name }}
              </button>
            </div>
            <button class="close-btn" @click="togglePanel">✕</button>
          </div>
        </div>

        <div class="modal-body">
          <!-- Tab 1: 动态监测 -->
          <div v-if="currentTab === 'dynamic'" class="tab-content grid-layout">
            <div class="chart-card">
              <div class="card-title">全省土地利用动态度趋势</div>
              <div class="card-body">
                <DynamicTrendChart />
              </div>
            </div>
            <div class="chart-card">
              <div class="card-title">各州市综合动态度排行 (Top 10)</div>
              <div class="card-body">
                <DynamicDegreeBar :startYear="year - 5" :endYear="year" />
              </div>
            </div>
          </div>

          <!-- Tab 2: 生态评估 -->
          <div v-if="currentTab === 'eco'" class="tab-content grid-layout">
            <div class="chart-card">
              <div class="card-title">多维生态评估雷达图 (vs 1985)</div>
              <div class="card-body">
                <EcoRadarChart :year="year" />
              </div>
            </div>
            <div class="chart-card">
              <div class="card-title">土地利用结构玫瑰图</div>
              <div class="card-body">
                <StructureRoseChart :year="year" />
              </div>
            </div>
          </div>

          <!-- Tab 3: 预警中心 -->
          <div v-if="currentTab === 'warning'" class="tab-content grid-layout">
            <div class="chart-card">
              <div class="card-title">耕地红线预警</div>
              <div class="card-body">
                <WarningGauge :year="year" />
              </div>
            </div>
            <div class="chart-card">
              <div class="card-title">实时监测预警列表</div>
              <div class="card-body">
                <AlertList :year="year" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import DynamicTrendChart from '../charts/DynamicTrendChart.vue';
import DynamicDegreeBar from '../charts/DynamicDegreeBar.vue';
import EcoRadarChart from '../charts/EcoRadarChart.vue';
import StructureRoseChart from '../charts/StructureRoseChart.vue';
import WarningGauge from '../charts/WarningGauge.vue';
import AlertList from './AlertList.vue';

const props = defineProps({
  year: { type: Number, default: 2023 }
});

const isVisible = ref(false);
const currentTab = ref('dynamic');

const tabs = [
  { id: 'dynamic', name: '动态监测' },
  { id: 'eco', name: '生态评估' },
  { id: 'warning', name: '预警中心' }
];

function togglePanel() {
  isVisible.value = !isVisible.value;
}
</script>

<style scoped>
.monitoring-panel-wrapper {
  position: relative;
}

/* 复用 Workbench 中的按钮样式，但稍作修改 */
.control-btn {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #a5ccff;
  gap: 2px;
}

.control-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.control-btn.active {
  background: #3b82f6;
  border-color: #60a5fa;
  color: #ffffff;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

.icon {
  font-size: 24px;
  margin-bottom: 2px;
}

.btn-label {
  font-size: 12px;
  font-weight: 800;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 998;
}

.modal-window {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 80vw;
  height: 70vh;
  background: rgba(13, 25, 48, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  z-index: 999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 24px;
  background: rgba(30, 58, 138, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.modal-subtitle {
  font-size: 14px;
  color: #a5ccff;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 4px;
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #fff;
}

.tab-btn.active {
  background: #3b82f6;
  color: #fff;
  font-weight: 600;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #fff;
}

.modal-body {
  flex: 1;
  padding: 20px;
  overflow: hidden;
}

.tab-content {
  width: 100%;
  height: 100%;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 100%;
}

.chart-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-title {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.card-body {
  flex: 1;
  padding: 16px;
  position: relative;
  overflow: hidden;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0;
}
</style>
