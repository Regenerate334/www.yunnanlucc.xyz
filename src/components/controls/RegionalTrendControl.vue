<template>
    <div class="regional-trend-control">
        <!-- 入口按钮 -->
        <button @click="openModal" class="control-btn" title="区域趋势深度监测">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" />
                <path d="M18 9l-5 5-2-2-4 4" />
            </svg>
            <span class="btn-label">区域监测</span>
        </button>

        <!-- 监测大窗 -->
        <transition name="slide-fade">
            <div v-if="isVisible" class="monitoring-modal" @click.stop>
                <div class="modal-header">
                    <div class="header-left">
                        <div class="modal-title">区域土地利用动态监测中心</div>
                        <div class="selectors">
                            <!-- 级别切换 -->
                            <div class="segmented-control">
                                <button :class="{ active: currentLevel === 'prefecture' }"
                                    @click="setLevel('prefecture')">地级市</button>
                                <button :class="{ active: currentLevel === 'county' }"
                                    @click="setLevel('county')">县级市</button>
                            </div>
                            <!-- 区域选择 -->
                            <select v-model="selectedRegion" class="region-select" :disabled="regionList.length === 0">
                                <option v-if="regionList.length === 0" value="">正在加载区域...</option>
                                <option v-for="name in regionList" :key="name" :value="name">{{ name }}</option>
                            </select>
                        </div>
                    </div>
                    <button class="close-btn" @click="closeModal">✕</button>
                </div>

                <div class="modal-body">
                    <div v-if="isLoading" class="loading-state">
                        <div class="spinner"></div>
                        <span>正在调取 {{ selectedRegion }} 历史监测数据...</span>
                    </div>
                    <RegionalTrendChart v-else-if="trendData.length > 0" :regionName="selectedRegion"
                        :level="currentLevel" :seriesData="trendData" />
                    <div v-else class="empty-state">
                        <div class="empty-icon">📊</div>
                        <span>暂无该区域监测数据</span>
                    </div>
                </div>
            </div>
        </transition>

        <transition name="fade">
            <div v-if="isVisible" class="modal-backdrop" @click="closeModal"></div>
        </transition>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import RegionalTrendChart from '../charts/RegionalTrendChart.vue';

const isVisible = ref(false);
const currentLevel = ref('prefecture');
const selectedRegion = ref('');
const regionList = ref([]);
const trendData = ref([]);
const isLoading = ref(false);

// 获取区域列表
async function fetchRegionList() {
    try {
        console.log('Fetching region list for level:', currentLevel.value);
        const resp = await fetch(`/api/regions/${currentLevel.value}`);
        regionList.value = await resp.json();
        console.log('Region list fetched:', regionList.value);
        if (regionList.value.length > 0 && !selectedRegion.value) {
            selectedRegion.value = regionList.value[0];
        }
    } catch (e) {
        console.error('Failed to fetch regions:', e);
    }
}

// 获取趋势数据
async function fetchTrendData() {
    if (!selectedRegion.value) return;
    isLoading.value = true;
    try {
        const encodedName = encodeURIComponent(selectedRegion.value);
        console.log(`Fetching trend data for: ${currentLevel.value} -> ${selectedRegion.value}`);
        const resp = await fetch(`/api/clcd/trend/${currentLevel.value}/${encodedName}`);
        trendData.value = await resp.json();
        console.log('Trend data received:', trendData.value.length, 'records');
    } catch (e) {
        console.error('Failed to fetch trend:', e);
    } finally {
        isLoading.value = false;
    }
}

function setLevel(level) {
    currentLevel.value = level;
    selectedRegion.value = ''; // 重置选择
    fetchRegionList();
}

function openModal() {
    isVisible.value = true;
    if (regionList.value.length === 0) {
        fetchRegionList();
    }
}

function closeModal() {
    isVisible.value = false;
}

watch(selectedRegion, () => {
    if (selectedRegion.value) {
        fetchTrendData();
    }
});

onMounted(() => {
    fetchRegionList();
});
</script>

<style scoped>
.regional-trend-control {
    position: relative;
}

.control-btn {
    width: 80px;
    height: 48px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(42, 61, 110, 0.2);
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    color: white;
    gap: 2px;
}

.control-btn:hover {
    background: rgba(52, 71, 130, 0.4);
    border-color: #00E5FF;
}

.icon {
    width: 20px;
    height: 20px;
}

.btn-label {
    font-size: 10px;
    font-weight: bold;
}

.monitoring-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 95vw;
    height: 90vh;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(20px);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
    padding: 20px 30px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 40px;
}

.modal-title {
    font-size: 20px;
    font-weight: bold;
    color: #fff;
    letter-spacing: 1px;
}

.selectors {
    display: flex;
    gap: 15px;
    align-items: center;
}

.segmented-control {
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
    border-radius: 6px;
    display: flex;
    gap: 4px;
}

.segmented-control button {
    padding: 6px 16px;
    border: none;
    background: transparent;
    color: #888;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
}

.segmented-control button.active {
    background: #00E5FF;
    color: #000;
    font-weight: bold;
}

.region-select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    outline: none;
    min-width: 150px;
}

.close-btn {
    background: transparent;
    border: none;
    color: #888;
    font-size: 24px;
    cursor: pointer;
    transition: color 0.2s;
}

.close-btn:hover {
    color: #fff;
}

.modal-body {
    flex: 1;
    padding: 30px;
    overflow-y: auto;
}

.loading-state,
.empty-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    color: #9cc9ff;
}

.spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(0, 229, 255, 0.1);
    border-left-color: #00E5FF;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1999;
}

.slide-fade-enter-active {
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-fade-enter-from {
    opacity: 0;
    transform: translate(-50%, -40%) scale(0.9);
}
</style>
