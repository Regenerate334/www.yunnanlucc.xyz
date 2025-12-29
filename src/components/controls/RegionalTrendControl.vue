<template>
    <div class="regional-trend-control">
        <!-- 入口按钮 -->
        <button @click="openModal" class="control-btn" title="区域趋势深度监测">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" />
                <path d="M18 9l-5 5-2-2-4 4" />
            </svg>
            <span class="btn-label">区域</span>
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
                            <div class="custom-region-dropdown" ref="regionDropdownRef">
                                <div class="region-trigger" @click="toggleRegionDropdown"
                                    :class="{ disabled: regionList.length === 0 }">
                                    <span>{{ selectedRegion || (regionList.length === 0 ? '正在加载...' : '请选择区域') }}</span>
                                    <span class="arrow" :class="{ open: isRegionDropdownOpen }">▼</span>
                                </div>
                                <transition name="dropdown-fade">
                                    <div v-if="isRegionDropdownOpen" class="region-options">
                                        <div v-for="name in regionList" :key="name" class="region-option"
                                            :class="{ active: selectedRegion === name }" @click="selectRegion(name)">
                                            {{ name }}
                                        </div>
                                    </div>
                                </transition>
                            </div>
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
import { ref, watch, onMounted, onUnmounted } from 'vue';
import RegionalTrendChart from '../charts/RegionalTrendChart.vue';
import { regionApi, clcdApi } from '../../api/index.js';

const isVisible = ref(false);
const currentLevel = ref('prefecture');
const selectedRegion = ref('');
const regionList = ref([]);
const trendData = ref([]);
const isLoading = ref(false);
const isRegionDropdownOpen = ref(false);
const regionDropdownRef = ref(null);

function toggleRegionDropdown() {
    if (regionList.value.length === 0) return;
    isRegionDropdownOpen.value = !isRegionDropdownOpen.value;
}

function selectRegion(name) {
    selectedRegion.value = name;
    isRegionDropdownOpen.value = false;
}

function handleClickOutside(event) {
    if (regionDropdownRef.value && !regionDropdownRef.value.contains(event.target)) {
        isRegionDropdownOpen.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

// 获取区域列表
async function fetchRegionList() {
    try {
        console.log('Fetching region list for level:', currentLevel.value);
        const data = await regionApi.getRegions(currentLevel.value);
        regionList.value = data;
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
        console.log(`Fetching trend data for: ${currentLevel.value} -> ${selectedRegion.value}`);
        const data = await clcdApi.getRegionalTrend(currentLevel.value, selectedRegion.value);
        trendData.value = data;
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
}

.control-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.icon {
    width: 38px;
    height: 38px;
    opacity: 0.8;
    transition: all 0.3s ease;
}

.control-btn:hover .icon {
    opacity: 1;
    transform: scale(1.05);
}

.btn-label {
    position: absolute;
    bottom: 4px;
    right: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 800;
    pointer-events: none;
    letter-spacing: 0.5px;
}

.monitoring-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 95vw;
    height: 90vh;
    background: rgba(13, 25, 48, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(24px);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
    padding: 20px 30px;
    background: rgba(30, 58, 138, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
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
    font-size: 18px;
    font-weight: 600;
    color: #a5ccff;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.selectors {
    display: flex;
    gap: 15px;
    align-items: center;
}

.segmented-control {
    background: rgba(255, 255, 255, 0.05);
    padding: 4px;
    border-radius: 8px;
    display: flex;
    gap: 4px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.segmented-control button {
    padding: 6px 16px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
}

.segmented-control button.active {
    background: #3b82f6;
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.custom-region-dropdown {
    position: relative;
    pointer-events: auto;
}

.region-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    min-width: 180px;
    font-size: 13px;
    transition: all 0.2s;
    backdrop-filter: blur(12px);
}

.region-trigger span {
    pointer-events: none;
}

.region-trigger:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
}

.region-trigger.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.arrow {
    font-size: 10px;
    color: #a5ccff;
    transition: transform 0.3s;
}

.arrow.open {
    transform: rotate(180deg);
}

.region-options {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: rgba(13, 25, 48, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 6px;
    z-index: 2001;
    backdrop-filter: blur(24px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    min-width: 100%;
    max-height: 300px;
    overflow-y: auto;
}

.region-options::-webkit-scrollbar {
    width: 4px;
}

.region-options::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}

.region-option {
    padding: 10px 16px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;
    text-align: left;
}

.region-option:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #ffffff;
    padding-left: 20px;
}

.region-option.active {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    font-weight: 600;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-5px);
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
