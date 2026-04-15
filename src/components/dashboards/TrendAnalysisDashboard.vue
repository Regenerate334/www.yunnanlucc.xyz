<!--
  @component TrendAnalysisDashboard
  @description 区域土地利用趋势分析看板，实现长时序动态趋势可视化与历史监测
  @props 无
  @emits 无
  @dependencies RegionalTrendChart, RegionCascader, useGlobalStore, clcdApi
-->
<template>
    <div class="regional-trend-control">
        <!-- 入口按钮 -->
        <button @click="toggleModal" class="control-btn" :class="{ active: isVisible }" title="土地利用长时序演化趋势监测">
            <svg class="region-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 17l4-4 3 3 5-5 4 4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="18" cy="6" r="3" fill="none"/>
                <path d="M20 8l2 2" stroke-linecap="round"/>
            </svg>
            <span class="btn-label">演化监测</span>
        </button>

        <Teleport to="body">
            <transition name="slide-fade">
                <div v-if="isVisible" class="monitoring-modal" @click.stop>
                    <div class="modal-header">
                        <div class="header-placeholder"></div>
                        <div class="modal-title">{{ selectedRegion.name }}土地利用长时序演化监测分析</div>

                        <div class="header-right">
                            <RegionCascader 
                                v-model="selectedRegion" 
                                placeholder="切换区域" 
                                :show-level-badge="true"
                            />
                            <button class="close-btn" @click="closeModal">✕</button>
                        </div>
                    </div>

                    <div class="modal-body">
                        <div v-if="isLoading" class="loading-state">
                            <div class="spinner"></div>
                            <span>正在加载 {{ selectedRegion.name }} 历史监测数据...</span>
                        </div>
                        <RegionalTrendChart v-else-if="trendData.length > 0" :regionName="selectedRegion.name"
                            :level="selectedRegion.level" :seriesData="trendData" />
                        <div v-else class="empty-state">
                            <div class="empty-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64" style="opacity: 0.2">
                                    <path d="M3 3v18h18" />
                                    <path d="M18 9l-5 5-2-2-5 5" />
                                </svg>
                            </div>
                            <span>请选择右上角区域查看数据</span>
                        </div>
                    </div>
                </div>
            </transition>

            <transition name="fade">
                <div v-if="isVisible" class="modal-backdrop" @click="closeModal"></div>
            </transition>
        </Teleport>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import RegionalTrendChart from '../charts/RegionalTrendChart.vue';
import RegionCascader from '../cards/RegionCascader.vue';
import { clcdApi } from '../../api/index.js';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'regionalTrend';

const isVisible = computed(() => globalStore.activePanel === panelName);
const selectedRegion = computed({
    get: () => ({ 
        name: globalStore.scope.name, 
        level: globalStore.scope.level,
        code: globalStore.scope.code
    }),
    set: (val) => {
        globalStore.setScope(val.level, val.code || '', val.name);
    }
});

const trendData = ref([]);
const isLoading = ref(false);

onMounted(() => {
    // 初始加载趋势数据
    fetchTrendData();
});

// 获取趋势数据
async function fetchTrendData() {
    if (!selectedRegion.value.name) return;
    isLoading.value = true;
    try {
        let res;
        if (selectedRegion.value.level === 'province') {
            res = await clcdApi.getProvinceTrend();
        } else {
            res = await clcdApi.getRegionalTrend(selectedRegion.value.level, selectedRegion.value.name);
        }
        trendData.value = Array.isArray(res) ? res : (res?.data || []);
    } catch (e) {
        console.error('Failed to fetch trend:', e);
        trendData.value = [];
    } finally {
        isLoading.value = false;
    }
}

function toggleModal() {
    if (globalStore.activePanel === panelName) {
        globalStore.setActivePanel(null);
    } else {
        globalStore.setActivePanel(panelName);
    }
}

function closeModal() {
    globalStore.setActivePanel(null);
}

// 监听全局 Scope 变化，自动刷新数据
watch(() => globalStore.scope, () => {
    if (isVisible.value) {
        fetchTrendData();
    }
}, { deep: true });

// 监听面板打开，确保数据是最新的
watch(isVisible, (visible) => {
    if (visible) {
        fetchTrendData();
    }
});
</script>

<style scoped>
.regional-trend-control {
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
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: #a5ccff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    position: relative;
    padding: 0;
    overflow: hidden;
    flex-direction: column;
    gap: 2px;
}

.control-btn.active {
    background: #3B76E1 !important;
    border-color: #3B76E1;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.control-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.region-icon {
    width: 32px;
    height: 32px;
    stroke: #ffffff;
    opacity: 0.9;
    transition: all 0.3s ease;
}

.control-btn:hover .region-icon {
    opacity: 1;
    stroke: #60a5fa;
}

.btn-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
    pointer-events: none;
    letter-spacing: 0.5px;
}

.monitoring-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 98vw;
    height: 96vh;
    background: rgba(7, 16, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(24px);
    z-index: 3000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
    padding: 8px 30px;
    background: rgba(30, 58, 138, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
}

.header-placeholder {
    width: 300px;
    /* 与 header-right 保持宽度一致以实现标题居中 */
}

.header-right {
    display: flex;
    align-items: center;
    gap: 20px;
    width: 300px;
    justify-content: flex-end;
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

.custom-region-dropdown {
    position: relative;
    width: 240px;
}

.region-trigger {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 40px;
}

.region-trigger:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
}

.region-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.selected-text {
    color: #fff;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.level-badge {
    font-size: 10px;
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.arrow {
    width: 12px;
    height: 12px;
    color: #a5ccff;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.arrow.open {
    transform: rotate(180deg);
}

.region-options-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    /* 改为右对齐 */
    width: 500px;
    background: rgba(13, 25, 48, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(16px);
    z-index: 100;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.search-box {
    padding: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    position: relative;
}

.search-box input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 8px 32px 8px 12px;
    color: #fff;
    font-size: 13px;
    outline: none;
}

.search-box input:focus {
    border-color: #3b82f6;
    background: rgba(255, 255, 255, 0.08);
}

.selection-columns {
    display: flex;
    height: 320px;
    background: rgba(13, 25, 48, 0.4);
}

.selection-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    min-width: 120px;
}

.selection-column:last-child {
    border-right: none;
    flex: 1.5;
}

.column-header {
    padding: 10px 15px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-weight: 600;
}

.column-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0;
}

.column-list::-webkit-scrollbar {
    width: 4px;
}

.column-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
}

.column-item {
    padding: 8px 15px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.column-item:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #fff;
}

.column-item.active {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    font-weight: 600;
}

.sub-arrow {
    font-size: 10px;
    opacity: 0.3;
}

.empty-column-msg {
    padding: 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.2);
    font-size: 12px;
}

.search-icon-img {
    position: absolute;
    right: 22px;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    opacity: 0.6;
}

.no-results {
    padding: 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
}

.close-btn {
    background: rgba(255, 255, 255, 0.05);
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 24px;
    cursor: pointer;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.close-btn:hover {
    background: rgba(245, 108, 108, 0.2);
    color: #fff;
    transform: rotate(90deg) scale(1.1);
}

.close-btn:active {
    transform: rotate(90deg) scale(0.95);
}

.modal-body {
    flex: 1;
    padding: 15px 24px 20px;
    background: rgba(7, 16, 36, 0.45); /* 底部容器增加透明度，使其更轻量通透 */
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.loading-state,
.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: rgba(255, 255, 255, 0.5);
}

.spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(59, 130, 246, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.empty-icon {
    font-size: 64px;
    opacity: 0.2;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

/* 动画 */
.slide-fade-enter-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-fade-leave-active {
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0;
}

.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 2999;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}
</style>
