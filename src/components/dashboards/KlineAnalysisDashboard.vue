<!--
  @component KlineAnalysisDashboard
  @description 区域土地利用 K 线波动分析看板，借鉴金融 K 线理念展示地类时序波动
  @props 无
  @emits 无
  @dependencies RegionalKlineChart, RegionCascader, useGlobalStore
-->
<template>
    <div class="regional-kline-control">
        <!-- 入口按钮 -->
        <button @click="toggleModal" class="control-btn" :class="{ active: isVisible }" title="土地利用长时序波动 K 线分析">
            <img class="region-icon" src="@/assets/icons/business/k-line.png" alt="波动K线分析" />
            <span class="btn-label">波动 K 线</span>
        </button>

        <Teleport to="body">
            <transition name="slide-fade">
                <div v-if="isVisible" class="monitoring-modal" @click.stop>
                    <div class="modal-header">
                        <div class="header-placeholder"></div>
                        <div class="modal-title">{{ selectedRegion.name }}土地利用变化时序趋势与盈亏动态</div>

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
                            <span>正在调取 {{ selectedRegion.name }} 波动数据...</span>
                        </div>
                        <RegionalKlineChart v-else-if="trendData.length > 0" :regionName="selectedRegion.name"
                            :seriesData="trendData" />
                        <div v-else class="empty-state">
                            <div class="empty-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="64" height="64" style="opacity: 0.2">
                                    <path d="M3 3v18h18" />
                                    <path d="M7 14V8h2v6H7zM11 18V6h2v12h-2zM15 12V10h2v2h-2z" />
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
import RegionalKlineChart from '../charts/RegionalKlineChart.vue';
import RegionCascader from '../cards/RegionCascader.vue';
import { clcdApi } from '../../api/index.js';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'regionalKline';

const isVisible = computed(() => globalStore.activePanel === panelName);
const selectedRegion = ref({ name: '云南省', level: 'province' });
const trendData = ref([]);
const isLoading = ref(false);

onMounted(() => {
    fetchTrendData();
});

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

watch(selectedRegion, (newVal) => {
    if (newVal.name) {
        fetchTrendData();
    }
}, { deep: true });
</script>

<style scoped>
/* 引用与 RegionalTrendControl 相同的样式以保持一致性 */
.regional-kline-control { position: relative; }

.control-btn {
    width: 64px; height: 64px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(13, 25, 48, 0.4);
    backdrop-filter: blur(12px);
    cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    color: #a5ccff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.control-btn.active {
    background: #3B76E1 !important;
    border-color: #3B76E1;
    color: #ffffff;
}

.btn-label { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }

.region-icon { width: 32px; height: 32px; stroke: #ffffff; opacity: 0.9; }

.monitoring-modal {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 98vw; height: 96vh;
    background: rgba(7, 16, 36, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(24px);
    z-index: 3000;
    display: flex; flex-direction: column; overflow: hidden;
}

.modal-header {
    padding: 8px 30px;
    background: rgba(30, 58, 138, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex; justify-content: space-between; align-items: center;
    position: relative;
}

.modal-title {
    position: absolute; left: 50%; transform: translateX(-50%);
    font-size: 24px; font-weight: 700; color: #ffffff;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.header-placeholder, .header-right { width: 300px; }
.header-right { display: flex; align-items: center; gap: 20px; justify-content: flex-end; }

.modal-body { flex: 1; padding: 20px; display: flex; flex-direction: column; }

.loading-state, .empty-state {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px;
    color: rgba(255, 255, 255, 0.5);
}

.spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(59, 130, 246, 0.1);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.close-btn {
    background: none; border: none; color: rgba(255, 255, 255, 0.5);
    font-size: 24px; cursor: pointer; padding: 10px;
}

/* 动画映射自 RegionalTrendControl */
.slide-fade-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-fade-enter-from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
.modal-backdrop {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 2999;
}
</style>
