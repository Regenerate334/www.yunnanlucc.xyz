<template>
  <div class="land-use-trend-control">
    <button @click="toggleChart" class="control-btn" :class="{ active: isVisible }" title="土地利用变化趋势">
      <img src="../../assets/icons/zhexiantu_icon.png" alt="趋势图" class="icon-img" />
    </button>

    <transition name="fade">
      <div v-if="isVisible" class="modal-backdrop" @click="toggleChart"></div>
    </transition>

    <transition name="slide-fade">
      <div v-if="isVisible" class="modal-window" @click.stop>
        <div class="modal-header">
          <span class="modal-title">土地利用类型变化趋势</span>
          <button class="close-btn" @click.stop="toggleChart">✕</button>
        </div>
        <div class="chart-wrapper">
          <div v-if="isLoading" class="loading-container">
            <div class="spinner"></div>
            <span>正在从数据库加载趋势数据...</span>
          </div>
          <div v-else-if="hasError && localSeriesData.length === 0" class="error-container">
            <span>数据加载失败，请检查后端服务。</span>
            <button @click="fetchTrendData" class="retry-btn">重试</button>
          </div>
          <LandUseTrendChart v-else :seriesData="localSeriesData" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import LandUseTrendChart from '../charts/LandUseTrendChart.vue';
import { clcdApi } from '../../api/index.js';

const props = defineProps({
  seriesData: {
    type: Array,
    default: () => []
  }
});

const isVisible = ref(false);
const localSeriesData = ref([]);
const isLoading = ref(false);
const hasError = ref(false);

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
  isVisible.value = !isVisible.value;
  if (isVisible.value) {
    fetchTrendData();
  }
}
</script>

<style scoped>
.land-use-trend-control {
  position: relative;
}

.control-btn {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(42, 61, 110, 0.2);
  backdrop-filter: blur(8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  color: white;
}

.control-btn:hover {
  background: rgba(52, 71, 130, 0.4);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.control-btn.active {
  background: rgba(156, 201, 255, 0.2);
  border-color: #9cc9ff;
  box-shadow: 0 0 3px rgba(156, 201, 255, 0.2);
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  z-index: 999;
}

.modal-window {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90vw;
  height: 85vh;
  background: rgba(42, 61, 110, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  color: white;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  position: relative;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  text-align: center;
  pointer-events: none;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 20px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

.chart-wrapper {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 16px;
  overflow: hidden;
  position: relative;
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
  color: #9cc9ff;
  font-size: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(156, 201, 255, 0.1);
  border-left-color: #00E5FF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-btn {
  padding: 8px 20px;
  background: rgba(0, 229, 255, 0.2);
  border: 1px solid #00E5FF;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.retry-btn:hover {
  background: rgba(0, 229, 255, 0.4);
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

.slide-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}
</style>
