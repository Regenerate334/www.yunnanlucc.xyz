<template>
    <div class="echarts-county-pie">
        <button @click="toggleChart" class="control-btn" :class="{ active: isVisible }" title="县级土地利用饼图">
            <img :src="iconUrl" alt="图标" class="icon-img" />
            <span class="btn-label">县</span>
        </button>

        <Teleport to="body">
            <transition name="fade">
                <div v-if="isVisible" class="modal-backdrop" @click="toggleChart"></div>
            </transition>

            <transition name="slide-fade">
                <div v-if="isVisible" class="modal-window" @click.stop>
                    <div class="modal-header">
                        <div class="header-placeholder"></div>
                        <span class="modal-title">
                            {{ props.year }}年 {{ currentPrefectureName }} 土地利用结构
                        </span>
                        <div class="header-right">
                            <div class="custom-select" ref="dropdownRef">
                                <div class="select-trigger" @click="toggleDropdown">
                                    <span>{{ currentPrefectureName }}</span>
                                    <span class="arrow" :class="{ open: isDropdownOpen }">▼</span>
                                </div>
                                <transition name="dropdown-fade">
                                    <div v-if="isDropdownOpen" class="options-panel">
                                        <div class="options-list">
                                            <div v-for="city in prefectureList" :key="city.code" class="option-item"
                                                :class="{ selected: city.code === selectedAdcode }"
                                                @click="selectPrefecture(city)">
                                                <span class="dot" v-if="city.code === selectedAdcode"></span>
                                                {{ city.name }}
                                            </div>
                                        </div>
                                    </div>
                                </transition>
                            </div>
                            <button class="close-btn" @click.stop="toggleChart">✕</button>
                        </div>
                    </div>
                    <div class="chart-container-wrapper">
                        <!-- AI 悬浮球 (左上角) -->
                        <div class="ai-floating-ball-container">
                            <button class="ai-floating-ball" @click.stop="openAIAnalysis">
                                <div class="ball-content">
                                    <ChatGptIcon :size="24" color="#ffffff" class="ai-ball-logo" />
                                    <span class="ai-ball-text">AI 一键分析</span>
                                </div>
                            </button>
                        </div>
                        <div ref="chartContainer" class="chart-container"></div>
                    </div>
                </div>
            </transition>
        </Teleport>

        <!-- AI 分析弹窗 -->
        <AIAnalysisModal v-model:visible="showAIModal" :year="props.year" :region="currentPrefectureName"
            analysis-type="pie" :component-context="{ type: 'county_pie', region: currentPrefectureName }" />
    </div>
</template>

<script setup>
import { ref, shallowRef, watch, onMounted, onUnmounted, nextTick, computed } from 'vue';
import * as echarts from 'echarts';
import { centroid, area } from '@turf/turf';
import { clcdApi } from '../../api/index.js';
import AIAnalysisModal from '../ui/AIAnalysisModal.vue';
import ChatGptIcon from '../icons/ChatGptIcon.vue';

const props = defineProps({
    year: {
        type: Number,
        required: true
    }
});

import prefecturePieIcon from '../../assets/icons/prefecture_pie.png';
const iconUrl = prefecturePieIcon;

const isVisible = ref(false);
const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);
let countyGeoJSON = null;
let countyData = null;
let countyStats = null;
const prefectureList = ref([]);
const selectedAdcode = ref('530100'); // Default to Kunming
const currentPrefectureName = ref('昆明市');
const isDropdownOpen = ref(false);
const dropdownRef = ref(null);
const showAIModal = ref(false);

// 打开 AI 分析弹窗
const openAIAnalysis = () => {
    showAIModal.value = true;
};

function toggleDropdown() {
    isDropdownOpen.value = !isDropdownOpen.value;
}

function selectPrefecture(city) {
    selectedAdcode.value = city.code;
    currentPrefectureName.value = city.name;
    handlePrefectureChange();
    isDropdownOpen.value = false;

    // 搜索定位逻辑：在地图更新后触发高亮
    nextTick(() => {
        if (chartInstance.value) {
            // 取消之前的所有选中
            chartInstance.value.dispatchAction({
                type: 'geoUnSelect',
                seriesIndex: 0
            });
            // 触发新的选中高亮（虽然县级图是按地州加载的，但这里可以预留逻辑或触发整体视图调整）
        }
    });
}

function handleClickOutside(event) {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
        isDropdownOpen.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    if (chartInstance.value) {
        window.removeEventListener('resize', handleResize);
        chartInstance.value.dispose();
        chartInstance.value = null;
    }
});

const landUseColors = {
    cropland: '#FAE39C',
    forest: '#446F33',
    shrubland: '#33A02C',
    grassland: '#ABD37B',
    water: '#1E69B4',
    wetland: '#2899E8',
    impervious: '#E24290',
    bareland: '#CFBDA3',
    tundra: '#A6CEE3'
};

const landUseNames = {
    cropland: '耕地',
    forest: '林地',
    shrubland: '灌木地',
    grassland: '草地',
    water: '水体',
    wetland: '湿地',
    impervious: '建设用地',
    bareland: '裸地',
    tundra: '冻土'
};

async function loadCountyGeo() {
    try {
        const resp = await fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${selectedAdcode.value}_full.json`);
        if (!resp.ok) throw new Error('GeoJSON not found');
        countyGeoJSON = await resp.json();

        countyData = countyGeoJSON.features.map(f => {
            const name = f.properties.name;
            const centerPoint = centroid(f);
            const geometricCenter = centerPoint.geometry.coordinates;
            const regionArea = area(f);

            return {
                name: name,
                geoCenter: geometricCenter,
                area: regionArea
            };
        });
    } catch (e) {
        console.error("Failed to load GeoJSON:", e);
    }
}

async function loadCountyStats(prefectureName) {
    try {
        const data = await clcdApi.getCountyDataByPrefecture(prefectureName);
        countyStats = data;
    } catch (e) {
        console.error('Error fetching county data:', e);
    }
}

function getLandUseSeriesData(regionName, year) {
    if (!countyStats) return [];
    const data = countyStats.find(d => d.region_name === regionName && d.year == year);
    if (!data) return [];

    const typeMapping = {
        cropland: 'cropland',
        forest: 'forest',
        shrubland: 'shrub',
        grassland: 'grassland',
        water: 'water',
        wetland: 'wetland',
        impervious: 'impervious',
        bareland: 'barren',
        tundra: 'snow_ice'
    };

    const types = ['cropland', 'forest', 'shrubland', 'grassland', 'water', 'wetland', 'impervious', 'bareland', 'tundra'];
    return types.map(type => {
        const dbKey = typeMapping[type];
        const val = Number(data[dbKey]);
        const valInKm2 = isNaN(val) ? 0 : val / 1000000;
        return {
            name: landUseNames[type],
            value: valInKm2,
            itemStyle: { color: landUseColors[type] }
        };
    }).filter(item => item.value > 0);
}

function updatePiePositions() {
    if (!chartInstance.value || !countyData) return;

    const geoCoordSys = chartInstance.value.getModel().getComponent('geo', 0).coordinateSystem;
    const zoom = geoCoordSys.getZoom();

    const maxArea = Math.max(...countyData.map(c => c.area || 0));
    const baseRadius = 30;

    const seriesUpdates = countyData.map((item) => {
        const areaScale = item.area ? Math.sqrt(item.area / maxArea) : 0.5;
        const adaptiveRadius = baseRadius * (0.5 + 0.5 * areaScale) * zoom;

        return {
            radius: [0, adaptiveRadius],
            emphasis: {
                label: {
                    fontSize: Math.max(10, 11 * zoom * (0.8 + 0.2 * areaScale))
                }
            }
        };
    });

    chartInstance.value.setOption({
        series: seriesUpdates,
        geo: {
            regions: []
        }
    });
}

async function initChart() {
    if (!chartContainer.value) return;

    await loadPrefectureList();
    await loadCountyGeo();
    await loadCountyStats(currentPrefectureName.value);

    const mapName = `map_${selectedAdcode.value}`;
    if (!echarts.getMap(mapName)) {
        echarts.registerMap(mapName, countyGeoJSON);
    }

    chartInstance.value = echarts.init(chartContainer.value, null, {
        devicePixelRatio: window.devicePixelRatio,
        renderer: 'canvas'
    });
    const option = getBaseChartOption(props.year, countyData);
    chartInstance.value.setOption(option);

    updatePiePositions();

    chartInstance.value.on('georoam', () => {
        updatePiePositions();
    });

    window.addEventListener('resize', handleResize);
}

function getBaseChartOption(year, dataList) {
    const pieSeries = dataList.map(item => ({
        type: 'pie',
        coordinateSystem: 'geo',
        name: item.name,
        center: item.name,
        radius: [0, 30], // 彻底恢复初始半径
        data: getLandUseSeriesData(item.name, year),
        label: { show: false },
        tooltip: { show: false },
        emphasis: {
            label: {
                show: true,
                position: 'inside',
                formatter: params => {
                    const val = params.value;
                    const areaStr = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km²';
                    return `${params.name}\n${areaStr}\n${params.percent.toFixed(1)}%`;
                },
                fontSize: 12,
                fontWeight: '700',
                fontFamily: "'Inter', 'Microsoft YaHei', sans-serif",
                color: '#1e293b',
                textBorderColor: '#fff',
                textBorderWidth: 2
            },
            itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
        },
        labelLine: { show: false },
        zlevel: 2,
        animation: false
    }));

    return {
        backgroundColor: 'transparent',
        tooltip: {
            show: true,
            trigger: 'item',
            backgroundColor: '#fff',
            padding: [6, 10],
            borderRadius: 4,
            borderWidth: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.15)',
            textStyle: {
                color: '#1e293b',
                fontSize: 14,
                fontWeight: '600',
                fontFamily: "'Inter', 'Microsoft YaHei', sans-serif"
            },
            formatter: params => {
                if (params.componentType === 'geo') {
                    return params.name;
                }
                return null;
            }
        },
        legend: {
            data: Object.values(landUseNames),
            orient: 'horizontal',
            bottom: '0%',
            left: 'center',
            textStyle: { color: '#fff', fontSize: 12 },
            itemWidth: 12,
            itemHeight: 12
        },
        geo: {
            map: `map_${selectedAdcode.value}`,
            roam: true,
            scaleLimit: { min: 0.8, max: 10 },
            aspectScale: 1.0,
            layoutCenter: ['50%', '50%'], // 彻底恢复中心
            layoutSize: '90%', // 彻底恢复地图比例
            label: { show: false },
            itemStyle: {
                areaColor: '#e7e8ea',
                borderColor: '#fff',
                borderWidth: 1
            },
            emphasis: {
                label: { show: false },
                itemStyle: {
                    areaColor: '#fef08a'
                }
            },
            zlevel: 0
        },
        series: pieSeries
    };
}

function updateYear(newYear) {
    if (!chartInstance.value || !countyStats) return;
    const baseOption = getBaseChartOption(newYear, countyData);
    chartInstance.value.setOption(baseOption, { notMerge: true });
    updatePiePositions();
}

function handleResize() {
    if (chartInstance.value) {
        chartInstance.value.resize();
        updatePiePositions();
    }
}

async function toggleChart() {
    isVisible.value = !isVisible.value;
    if (isVisible.value) {
        await nextTick();
        if (chartInstance.value) {
            chartInstance.value.dispose();
            chartInstance.value = null;
        }
        await initChart();
    } else {
        if (chartInstance.value) {
            chartInstance.value.dispose();
            chartInstance.value = null;
        }
    }
}

async function loadPrefectureList() {
    try {
        const response = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/530000_full.json');
        if (response.ok) {
            const geoData = await response.json();
            prefectureList.value = geoData.features.map(f => ({
                name: f.properties.name,
                code: f.Adcode || f.properties.adcode
            }));
            const initial = prefectureList.value.find(p => p.code === selectedAdcode.value);
            if (initial) {
                currentPrefectureName.value = initial.name;
            }
        }
    } catch (e) {
        console.error('Error loading prefecture list:', e);
    }
}

async function handlePrefectureChange() {
    if (!chartInstance.value) return;
    await Promise.all([
        loadCountyGeo(),
        loadCountyStats(currentPrefectureName.value)
    ]);
    const mapName = `map_${selectedAdcode.value}`;
    if (!echarts.getMap(mapName)) {
        echarts.registerMap(mapName, countyGeoJSON);
    }
    const option = getBaseChartOption(props.year, countyData);
    chartInstance.value.setOption(option, { notMerge: true });

    // 关键修复：切换地州后重置地图视角，实现“定位”效果
    chartInstance.value.dispatchAction({
        type: 'restore'
    });

    nextTick(() => {
        updatePiePositions();
    });
}

watch(() => props.year, (newYear) => {
    if (isVisible.value && chartInstance.value) {
        updateYear(newYear);
    }
});
</script>

<style scoped>
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2;
    padding: 0;
    overflow: hidden;
    color: #a5ccff;
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

.icon-img {
    width: 60px;
    height: 60px;
    object-fit: contain;
    opacity: 0.8;
    transition: all 0.3s ease;
}

.control-btn:hover .icon-img {
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
    width: 60vw;
    height: 85vh;
    background: rgba(13, 25, 48, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
    padding: 16px 24px;
    background: rgba(30, 58, 138, 0.3);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.header-placeholder {
    width: 300px;
}

.header-right {
    display: flex;
    align-items: center;
    gap: 15px;
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

.custom-select {
    position: relative;
    font-size: 14px;
    pointer-events: auto;
}

.select-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    width: 160px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(12px);
}

.select-trigger:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
}

.arrow {
    font-size: 10px;
    color: #a5ccff;
    transition: transform 0.3s;
}

.arrow.open {
    transform: rotate(180deg);
}

.options-panel {
    position: absolute;
    top: 100%;
    right: 0;
    width: 180px;
    /* 缩小宽度 */
    max-height: 400px;
    display: flex;
    flex-direction: column;
    background: rgba(13, 25, 48, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    margin-top: 8px;
    padding: 0;
    z-index: 1002;
    backdrop-filter: blur(24px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
}

.no-results {
    padding: 20px;
    text-align: center;
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
}

.options-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.options-list::-webkit-scrollbar {
    width: 4px;
}

.options-list::-webkit-scrollbar-track {
    background: transparent;
}

.options-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
}

.option-item {
    padding: 10px 16px;
    text-align: left;
    cursor: pointer;
    border-radius: 8px;
    color: rgba(255, 255, 255, 0.8);
    transition: all 0.2s ease;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 10px;
}

.option-item:hover {
    background: rgba(59, 130, 246, 0.1);
    color: #ffffff;
    padding-left: 20px;
}

.option-item.selected {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    font-weight: 600;
}

.dot {
    width: 6px;
    height: 6px;
    background: #3b82f6;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
}

.chart-container-wrapper {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
}

.chart-container {
    width: 100%;
    height: 100%;
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

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
    opacity: 0;
    transform: translateY(-5px);
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
    width: 48px;
    /* 初始圆形宽度 */
    height: 48px;
    padding: 0 12px;
    background: rgba(30, 58, 138, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(59, 130, 246, 0.5);
    border-radius: 24px;
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
    width: 24px;
    height: 24px;
    object-fit: contain;
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
