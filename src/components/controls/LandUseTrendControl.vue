<template>
  <div class="land-use-trend-control">
    <button @click="toggleChart" class="control-btn" :class="{ active: isVisible }" title="省级土地利用变化趋势">
      <svg class="trend-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 17l6-6 4 4 8-8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M17 7h4v4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="btn-label">省级趋势</span>
    </button>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="isVisible" class="modal-backdrop" @click="closeChart"></div>
      </transition>

      <transition name="slide-fade">
        <div v-if="isVisible" class="modal-window" @click.stop>
          <div class="modal-header">
            <div class="header-placeholder"></div>
            <span class="modal-title">云南省各地类土地利用长时序变化监测</span>
            <button class="close-btn" @click.stop="closeChart">✕</button>
          </div>
          <div class="chart-wrapper">
            <!-- AI 悬浮球 (左上角) -->
            <div class="ai-floating-ball-container">
              <button class="ai-floating-ball" @click.stop="openAIAnalysis">
                <div class="ball-content">
                  <ChatGptIcon :size="28" color="#ffffff" class="ai-ball-logo" />
                  <span class="ai-ball-text">AI 趋势分析</span>
                </div>
              </button>
            </div>
            <div v-if="isLoading" class="loading-container">
              <div class="spinner"></div>
              <span>正在从数据库加载序列数据...</span>
            </div>
            <div v-else-if="hasError && localSeriesData.length === 0" class="error-container">
              <span>数据加载失败，请检查后端服务。</span>
              <button @click="fetchTrendData" class="retry-btn">重试</button>
            </div>
            <LandUseTrendChart v-if="isVisible && localSeriesData.length > 0" :seriesData="localSeriesData" />
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- AI 分析弹窗 -->
    <AIAnalysisModal v-model:visible="showAIModal" :year="2023" region="云南省" analysis-type="trend"
      :component-context="{ type: 'province_trend' }" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import LandUseTrendChart from '../charts/LandUseTrendChart.vue';
import { clcdApi } from '../../api/index.js';
import AIAnalysisModal from '../ui/AIAnalysisModal.vue';
import ChatGptIcon from '../icons/ChatGptIcon.vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'trend';

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
});

const isVisible = computed(() => globalStore.activePanel === panelName);
const localSeriesData = ref([]);
const isLoading = ref(false);
const hasError = ref(false);
const showAIModal = ref(false);

async function fetchTrendData() {
  if (localSeriesData.value.length > 0) return; // 避免重复加载

  isLoading.value = true;
  hasError.value = false;
  try {
    const data = await clcdApi.getProvinceTrend();
    localSeriesData.value = data;
  } catch (error) {
    console.error('Error fetching trend data:', error);
    hasError.value = true;
    if (props.seriesData && props.seriesData.length > 0) {
      localSeriesData.value = props.seriesData;
    }
  } finally {
    isLoading.value = false;
  }
}

function toggleChart() {
  globalStore.setActivePanel(panelName);
  if (globalStore.activePanel === panelName) {
    fetchTrendData();
  }
}

function closeChart() {
  globalStore.setActivePanel(null);
}

// 打开 AI 分析弹窗
const openAIAnalysis = () => {
  showAIModal.value = true;
};
</script>

<style scoped>
.land-use-trend-control {
  position: relative;
}

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
  gap: 2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #a5ccff;
}

.btn-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.control-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.control-btn.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.icon-img {
  width: 40px;
  height: 40px;
  object-fit: cover;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.control-btn:hover .icon-img {
  opacity: 1;
}

.trend-icon {
  width: 32px;
  height: 32px;
  stroke: #ffffff;
  opacity: 0.9;
  transition: all 0.3s ease;
}

.control-btn:hover .trend-icon {
  opacity: 1;
  stroke: #60a5fa;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 999;
}

.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 98vw;
  height: 96vh;
  background: rgba(13, 25, 48, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 2000; /* Standardized High Z-Index */
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 8px 24px;
  background: rgba(30, 58, 138, 0.3);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-placeholder {
  width: 32px;
}

.modal-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
  white-space: nowrap;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 16px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  transform: rotate(90deg);
}

.chart-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow: hidden;
  position: relative;
  background: rgba(0, 0, 0, 0.1);
}

.loading-container,
.error-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  color: #a5ccff;
  font-size: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.1);
  border-left-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-btn {
  padding: 8px 24px;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #a5ccff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.retry-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #ffffff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

/* AI 悬浮球样式 */
.ai-floating-ball-container {
  position: absolute;
  top: 20px;
  right: 30px;
  z-index: 100;
}

.ai-floating-ball {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 56px;
  /* 初始圆形宽度 */
  height: 56px;
  padding: 0 14px;
  background: rgba(30, 58, 138, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(59, 130, 246, 0.5);
  border-radius: 28px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  white-space: nowrap;
}

.ai-floating-ball:hover {
  width: 160px;
  /* 展开后的宽度 */
  background: rgba(30, 58, 138, 0.8);
  border-color: rgba(59, 130, 246, 0.8);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
}

.ball-content {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 140px;
  /* 确保文字不换行 */
}

.ai-ball-logo {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.ai-floating-ball:hover .ai-ball-logo {
  transform: scale(1.1) rotate(5deg);
}

.ai-ball-text {
  font-size: 14px;
  font-weight: 600;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.4s ease 0.1s;
}

.ai-floating-ball:hover .ai-ball-text {
  opacity: 1;
  transform: translateX(0);
}
</style>
