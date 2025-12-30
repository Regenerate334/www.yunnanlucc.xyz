<template>
  <div class="sci-panel-wrapper">
    <!-- 触发按钮 -->
    <button @click="togglePanel" class="control-btn" :class="{ active: isVisible }" title="SCI级综合监测">
      <span class="icon">🔬</span>
      <span class="btn-label">科研监测</span>
    </button>

    <transition name="fade">
      <div v-if="isVisible" class="modal-backdrop" @click="togglePanel"></div>
    </transition>

    <transition name="slide-up">
      <div v-if="isVisible" class="modal-window" @click.stop>
        <div class="modal-header">
          <div class="header-left">
            <span class="modal-title">区域生态环境演变机理分析</span>
            <span class="modal-subtitle">Scientific Analysis Platform</span>
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
          <!-- Tab 1: 耦合协调度 (CCDM) -->
          <div v-if="currentTab === 'ccdm'" class="tab-content">
            <div class="chart-card full-height">
              <div class="card-header">
                <div class="card-title">城市化与生态环境耦合协调度演变 (CCDM)</div>
                <div class="card-meta">Model: $D = \sqrt{C \times T}$</div>
              </div>
              <div class="card-body">
                <CouplingCoordinationChart />
              </div>
              <div class="card-footer">
                <div class="legend-item"><span class="dot red"></span> 失调区 (0-0.4)</div>
                <div class="legend-item"><span class="dot yellow"></span> 过渡区 (0.4-0.6)</div>
                <div class="legend-item"><span class="dot green"></span> 协调区 (0.6-1.0)</div>
              </div>
            </div>
          </div>

          <!-- Tab 2: 土地转移流 (Transition) -->
          <div v-if="currentTab === 'transition'" class="tab-content">
            <div class="chart-card full-height">
              <div class="card-header">
                <div class="card-title">土地利用类型转移流 (Transition Flow)</div>
                <div class="card-meta">Visualization: Chord Diagram</div>
              </div>
              <div class="card-body">
                <LandUseChordChart />
              </div>
            </div>
          </div>

          <!-- Tab 3: 景观格局 (Landscape Pattern) -->
          <div v-if="currentTab === 'landscape'" class="tab-content">
            <div class="chart-card full-height">
              <div class="card-header">
                <div class="card-title">景观格局指数时空演变 (Spatio-temporal Evolution)</div>
                <div class="card-meta">Indices: SHDI, SHEI, LSI, AI</div>
              </div>
              <div class="card-body">
                <LandscapeMetricsHeatmap />
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
import CouplingCoordinationChart from '../charts/sci/CouplingCoordinationChart.vue';
import LandUseChordChart from '../charts/sci/LandUseChordChart.vue';
import LandscapeMetricsHeatmap from '../charts/sci/LandscapeMetricsHeatmap.vue';

const isVisible = ref(false);
const currentTab = ref('ccdm');

const tabs = [
  { id: 'ccdm', name: '耦合协调度 (CCDM)' },
  { id: 'transition', name: '土地转移流 (Flow)' },
  { id: 'landscape', name: '景观格局 (Pattern)' }
];

function togglePanel() {
  isVisible.value = !isVisible.value;
}
</script>

<style scoped>
.sci-panel-wrapper {
  position: relative;
}

/* 按钮样式：更严谨的深蓝色调 */
.control-btn {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  color: #94a3b8;
  gap: 2px;
}

.control-btn:hover {
  border-color: #3b82f6;
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.2);
}

.control-btn.active {
  background: #3b82f6;
  color: #fff;
  border-color: #60a5fa;
}

.icon {
  font-size: 24px;
}

.btn-label {
  font-size: 12px;
  font-weight: 600;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 998;
}

.modal-window {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 85vw;
  height: 75vh;
  background: #0f172a; /* Slate 900 */
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.6);
  z-index: 999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
}

.modal-header {
  padding: 16px 24px;
  background: #1e293b; /* Slate 800 */
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  flex-direction: column;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: 0.5px;
}

.modal-subtitle {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-top: 2px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.tabs {
  display: flex;
  background: #0f172a;
  border-radius: 6px;
  padding: 3px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #94a3b8;
}

.tab-btn.active {
  background: #3b82f6;
  color: #fff;
}

.close-btn {
  background: transparent;
  border: none;
  color: #64748b;
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
  background: #0b1120; /* Darker Slate */
  overflow: hidden;
}

.tab-content {
  width: 100%;
  height: 100%;
}

.chart-card {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.full-height {
  height: 100%;
}

.card-header {
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
}

.card-meta {
  font-size: 12px;
  color: #64748b;
  font-family: 'Courier New', monospace;
}

.card-body {
  flex: 1;
  padding: 20px;
  position: relative;
}

.card-footer {
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #94a3b8;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.red { background: #ef4444; }
.dot.yellow { background: #f59e0b; }
.dot.green { background: #22c55e; }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translate(-50%, 100%); opacity: 0; }
</style>
