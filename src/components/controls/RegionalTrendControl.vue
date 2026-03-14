<template>
    <div class="regional-trend-control">
        <!-- 入口按钮 -->
        <button @click="openModal" class="control-btn" :class="{ active: isVisible }" title="区域趋势深度监测">
            <svg class="region-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 17l4-4 3 3 5-5 4 4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="18" cy="6" r="3" fill="none"/>
                <path d="M20 8l2 2" stroke-linecap="round"/>
            </svg>
            <span class="btn-label">区域监测</span>
        </button>

        <Teleport to="body">
            <!-- 监测大窗 -->
            <transition name="slide-fade">
                <div v-if="isVisible" class="monitoring-modal" @click.stop>
                    <div class="modal-header">
                        <div class="header-placeholder"></div> <!-- 占位符用于平衡布局 -->

                        <div class="modal-title">{{ selectedRegion.name }}多地类土地利用长时序变化监测</div>

                        <div class="header-right">
                            <!-- 区域选择器 -->
                            <div class="custom-region-dropdown" ref="regionDropdownRef">
                                <div class="region-trigger" @click="toggleRegionDropdown"
                                    :class="{ disabled: hierarchy.length === 0 }">
                                    <span class="selected-text">
                                        {{ selectedRegion.name || (hierarchy.length === 0 ? '正在加载...' : '请选择区域') }}
                                        <span v-if="selectedRegion.name" class="level-badge">{{ selectedRegion.level ===
                                            'prefecture' ? '地级' : '县级' }}</span>
                                    </span>
                                    <svg class="arrow" :class="{ open: isRegionDropdownOpen }" viewBox="0 0 24 24" width="14" height="14">
                                        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>

                                <transition name="dropdown-fade">
                                    <div v-if="isRegionDropdownOpen" class="region-options-panel">
                                        <!-- 搜索框 -->
                                        <div class="search-box">
                                            <input v-model="searchQuery" type="text" placeholder="搜索地州或区县..."
                                                @click.stop />
                                            <img src="../../assets/icons/search.png" class="search-icon-img" alt="搜索" />
                                        </div>

                                        <!-- 三级选择区域 -->
                                        <div class="selection-columns">
                                            <!-- 第一列：省直辖市 (固定为云南省) -->
                                            <div class="selection-column">
                                                <div class="column-header">省直辖市</div>
                                                <div class="column-list">
                                                    <div class="column-item active">云南省</div>
                                                </div>
                                            </div>

                                            <!-- 第二列：地级市州 -->
                                            <div class="selection-column">
                                                <div class="column-header">地级市州</div>
                                                <div class="column-list">
                                                    <div v-for="pref in filteredHierarchy" :key="pref.name"
                                                        class="column-item"
                                                        :class="{ active: activePrefecture === pref.name || isSelected(pref.name, 'prefecture') }"
                                                        @mouseenter="activePrefecture = pref.name"
                                                        @click="selectRegion(pref.name, 'prefecture')">
                                                        {{ pref.name }}
                                                        <svg class="sub-arrow" viewBox="0 0 12 12" width="12" height="12">
                                                            <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- 第三列：区县旗 -->
                                            <div class="selection-column">
                                                <div class="column-header">区县旗</div>
                                                <div class="column-list">
                                                    <template v-if="currentCounties.length > 0">
                                                        <div v-for="county in currentCounties" :key="county"
                                                            class="column-item"
                                                            :class="{ active: isSelected(county, 'county') }"
                                                            @click="selectRegion(county, 'county')">
                                                            {{ county }}
                                                        </div>
                                                    </template>
                                                    <div v-else class="empty-column-msg">
                                                        请先选择地州市
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="filteredHierarchy.length === 0 && searchQuery" class="no-results">
                                            未找到相关区域
                                        </div>
                                    </div>
                                </transition>
                            </div>
                            <button class="close-btn" @click="closeModal">✕</button>
                        </div>
                    </div>

                    <div class="modal-body">
                        <div v-if="isLoading" class="loading-state">
                            <div class="spinner"></div>
                            <span>正在调取 {{ selectedRegion.name }} 历史监测数据...</span>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import RegionalTrendChart from '../charts/RegionalTrendChart.vue';
import { regionApi, clcdApi } from '../../api/index.js';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'regionalTrend';

const isVisible = computed(() => globalStore.activePanel === panelName);
const selectedRegion = ref({ name: '', level: '' });
const hierarchy = ref([]); // 完整的层级数据
const trendData = ref([]);
const isLoading = ref(false);
const isRegionDropdownOpen = ref(false);
const regionDropdownRef = ref(null);

// 搜索和状态
const searchQuery = ref('');
const activePrefecture = ref(''); // 当前悬停或选中的地级市，用于显示第三列
const expandedPrefectures = ref(new Set());

// 过滤后的层级数据
const filteredHierarchy = computed(() => {
    if (!hierarchy.value) return [];
    if (!searchQuery.value || !searchQuery.value.trim()) return hierarchy.value;

    const query = searchQuery.value.trim().toLowerCase();
    const result = [];

    hierarchy.value.forEach(pref => {
        const prefMatch = pref.name.toLowerCase().includes(query);
        const matchingChildren = pref.children ? pref.children.filter(c => c.toLowerCase().includes(query)) : [];

        if (prefMatch || matchingChildren.length > 0) {
            result.push({
                name: pref.name,
                children: matchingChildren.length > 0 ? matchingChildren : pref.children
            });
        }
    });
    return result;
});

// 监听过滤结果，自动展开和定位
watch(filteredHierarchy, (newVal) => {
    if (searchQuery.value && newVal.length > 0) {
        // 1. 如果只有一个地州匹配，或某个地州下有匹配的县，自动选中第一个
        const firstMatch = newVal[0];
        if (firstMatch) {
            // 如果尚未选中或当前选中的不在结果中，则更新选中
            if (!activePrefecture.value || !newVal.find(p => p.name === activePrefecture.value)) {
                activePrefecture.value = firstMatch.name;
            }
            
            // 2. 尝试滚动到匹配的县
            setTimeout(() => {
                const query = searchQuery.value.trim().toLowerCase();
                // 查找第一个匹配的县
                const matchedCounty = firstMatch.children.find(c => c.toLowerCase().includes(query));
                
                if (matchedCounty) {
                    // 使用 ref 查找，因为 modal 被 teleport 到 body，不能使用 .regional-trend-control 选择器
                    let items = [];
                    if (regionDropdownRef.value) {
                        items = regionDropdownRef.value.querySelectorAll('.column-item');
                    } else {
                        // Fallback global selector formatted for the modal class
                        items = document.querySelectorAll('.monitoring-modal .column-item');
                    }
                    
                    for (const item of items) {
                        if (item.textContent.trim() === matchedCounty) {
                            item.scrollIntoView({ block: 'center', behavior: 'smooth' });
                            break;
                        }
                    }
                }
            }, 100);
        }
    }
});

// 当前显示的县级列表
const currentCounties = computed(() => {
    if (!activePrefecture.value) return [];
    
    // 保持与 RegionCascader 一致：搜索时从过滤结果中获取
    if (searchQuery.value) {
        const pref = filteredHierarchy.value.find(p => p.name === activePrefecture.value);
        return pref ? pref.children : [];
    }
    
    const pref = hierarchy.value.find(p => p.name === activePrefecture.value);
    return pref ? pref.children : [];
});

function toggleRegionDropdown() {
    if (hierarchy.value.length === 0) return;
    isRegionDropdownOpen.value = !isRegionDropdownOpen.value;
    // 重置搜索
    if (!isRegionDropdownOpen.value) {
        searchQuery.value = '';
    }
}

function toggleExpand(prefName) {
    if (expandedPrefectures.value.has(prefName)) {
        expandedPrefectures.value.delete(prefName);
    } else {
        expandedPrefectures.value.add(prefName);
    }
}

function isExpanded(prefName) {
    return expandedPrefectures.value.has(prefName);
}

function isSelected(name, level) {
    return selectedRegion.value.name === name && selectedRegion.value.level === level;
}

function selectRegion(name, level) {
    selectedRegion.value = { name, level };
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

// 获取层级数据
async function fetchHierarchy() {
    try {
        const data = await regionApi.getRegionHierarchy();
        hierarchy.value = data;

        // 默认选中第一个地级市
        if (hierarchy.value.length > 0 && !selectedRegion.value.name) {
            selectRegion(hierarchy.value[0].name, 'prefecture');
            activePrefecture.value = hierarchy.value[0].name;
        } else if (selectedRegion.value.name) {
            // 如果已有选中，设置 activePrefecture
            const pref = hierarchy.value.find(p =>
                p.name === selectedRegion.value.name ||
                (p.children && p.children.includes(selectedRegion.value.name))
            );
            if (pref) activePrefecture.value = pref.name;
        }
    } catch (e) {
        console.error('Failed to fetch region hierarchy:', e);
    }
}

// 获取趋势数据
async function fetchTrendData() {
    if (!selectedRegion.value.name) return;
    isLoading.value = true;
    try {
        console.log(`Fetching trend data for: ${selectedRegion.value.level} -> ${selectedRegion.value.name}`);
        const res = await clcdApi.getRegionalTrend(selectedRegion.value.level, selectedRegion.value.name);
        trendData.value = res.data;
    } catch (e) {
        console.error('Failed to fetch trend:', e);
        trendData.value = [];
    } finally {
        isLoading.value = false;
    }
}

function openModal() {
    globalStore.setActivePanel(panelName);
    if (hierarchy.value.length === 0) {
        fetchHierarchy();
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

onMounted(() => {
    fetchHierarchy();
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
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 24px;
    cursor: pointer;
    padding: 10px;
    transition: color 0.2s;
}

.close-btn:hover {
    color: #fff;
}

.modal-body {
    flex: 1;
    padding: 30px;
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
    z-index: 1999;
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
