<template>
  <div class="echarts-prefecture-pie">
    <button @click="toggleChart" class="control-btn" :class="{ active: isVisible }" title="地级市土地利用饼图">
      <img :src="iconUrl" alt="图标" class="icon-img" />
      <span class="btn-label">市</span>
    </button>

    <Teleport to="body">
      <transition name="fade">
        <div v-if="isVisible" class="modal-backdrop" @click="toggleChart"></div>
      </transition>

      <transition name="slide-fade">
        <div v-if="isVisible" class="modal-window" @click.stop>
          <div class="modal-header">
            <div class="header-placeholder"></div>
            <span class="modal-title">{{ props.year }}年云南省地级市土地利用结构</span>
            <button class="close-btn" @click.stop="toggleChart">✕</button>
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
    <AIAnalysisModal v-model:visible="showAIModal" :year="props.year" :region="'云南省各地级市'" analysis-type="pie"
      :component-context="{ type: 'prefecture_pie' }" />
  </div>
</template>

<script setup>
import { ref, shallowRef, onUnmounted, watch, nextTick } from 'vue';
import * as echarts from 'echarts';
import { centroid, area } from '@turf/turf';
import { clcdApi } from '../../api/index.js';
import AIAnalysisModal from '../ui/AIAnalysisModal.vue';
import ChatGptIcon from '../icons/ChatGptIcon.vue';

import prefecturePieIcon from '../../assets/icons/prefecture_pie.png';
const iconUrl = prefecturePieIcon;

const props = defineProps({
  year: { type: Number, default: 1985 }
});

const isVisible = ref(false);
const showAIModal = ref(false);
const chartContainer = shallowRef(null);
const chartInstance = shallowRef(null);
let citiesGeoJSON = null;
let citiesData = null;
let landUseData = null;

const cityLayout = {
  '昆明市': { name: '昆明' },
  '曲靖市': { name: '曲靖' },
  '玉溪市': { name: '玉溪' },
  '保山市': { name: '保山' },
  '昭通市': { name: '昭通', offset: [0, -10] },
  '丽江市': { name: '丽江' },
  '普洱市': { name: '普洱' },
  '临沧市': { name: '临沧' },
  '楚雄彝族自治州': { name: '楚雄' },
  '红河哈尼族彝族自治州': { name: '红河' },
  '文山壮族苗族自治州': { name: '文山' },
  '西双版纳傣族自治州': { name: '西双版纳', offset: [0, -15] },
  '大理白族自治州': { name: '大理' },
  '德宏傣族景颇族自治州': { name: '德宏', offset: [20, 0] },
  '怒江傈僳族自治州': { name: '怒江' },
  '迪庆藏族自治州': { name: '迪庆' }
};

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

async function loadCitiesData() {
  if (citiesGeoJSON) return;
  const resp = await fetch('/data/yunnan_cities_boundary.geo.json');
  citiesGeoJSON = await resp.json();
  citiesData = citiesGeoJSON.features.map(f => {
    const name = f.properties.name;
    const config = cityLayout[name] || {};
    const centerPoint = centroid(f);
    const geometricCenter = centerPoint.geometry.coordinates;
    const regionArea = area(f);

    return {
      name: name,
      displayName: config.name || name,
      geoCenter: geometricCenter,
      area: regionArea,
      customOffset: config.offset || [0, 0]
    };
  });
}

async function loadLandUseData() {
  if (landUseData) return;
  try {
    const data = await clcdApi.getAllPrefectureData();
    landUseData = data;
  } catch (e) {
    console.error('Error fetching prefecture data:', e);
  }
}

function getCityLandUse(cityName, year) {
  if (!landUseData) return [];
  const record = landUseData.find(d => {
    const regionName = d.region_name || '';
    return regionName.includes(cityName) && d.year == year;
  });

  if (!record) return [];

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
  return types
    .map(type => {
      const dbKey = typeMapping[type];
      const val = Number(record[dbKey]);
      const valInKm2 = isNaN(val) ? 0 : val / 1000000;

      return {
        name: landUseNames[type],
        value: valInKm2,
        itemStyle: { color: landUseColors[type] }
      };
    })
    .filter(item => item.value > 0);
}

function updatePiePositions() {
  if (!chartInstance.value || !citiesData) return;

  const geoCoordSys = chartInstance.value.getModel().getComponent('geo', 0).coordinateSystem;
  const zoom = geoCoordSys.getZoom();
  const maxArea = Math.max(...citiesData.map(c => c.area || 0));
  const baseRadius = 35;

  const seriesUpdates = citiesData.map((city) => {
    const areaScale = city.area ? Math.sqrt(city.area / maxArea) : 0.5;
    const adaptiveRadius = baseRadius * (0.5 + 0.5 * areaScale) * zoom;

    return {
      radius: [0, adaptiveRadius],
      emphasis: {
        label: {
          fontSize: Math.max(12, 13 * zoom * (0.8 + 0.2 * areaScale))
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

  await Promise.all([
    loadCitiesData(),
    loadLandUseData()
  ]);

  if (!echarts.getMap('yunnan_cities')) {
    echarts.registerMap('yunnan_cities', citiesGeoJSON);
  }

  chartInstance.value = echarts.init(chartContainer.value, null, {
    devicePixelRatio: window.devicePixelRatio,
    renderer: 'canvas'
  });
  const baseOption = getBaseChartOption(props.year);
  chartInstance.value.setOption(baseOption);
  updatePiePositions();

  chartInstance.value.on('georoam', () => {
    updatePiePositions();
  });

  window.addEventListener('resize', handleResize);
}

function getBaseChartOption(year) {
  const pieSeries = citiesData.map(city => ({
    type: 'pie',
    coordinateSystem: 'geo',
    name: city.name,
    center: city.name,
    radius: [0, 35],
    data: getCityLandUse(city.name, year),
    label: { show: false },
    tooltip: { show: false },
    emphasis: {
      scale: true,
      scaleSize: 10,
      label: {
        show: true,
        position: 'inside',
        formatter: params => {
          const val = params.value;
          const areaStr = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km²';
          return `${params.name}\n${areaStr}\n${params.percent.toFixed(1)}%`;
        },
        fontSize: 13,
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
      padding: [8, 12],
      borderRadius: 4,
      borderWidth: 0,
      shadowBlur: 10,
      shadowColor: 'rgba(0,0,0,0.15)',
      textStyle: {
        color: '#1e293b',
        fontSize: 15,
        fontWeight: '600',
        fontFamily: "'Inter', 'Microsoft YaHei', sans-serif"
      },
      formatter: params => {
        if (params.componentType === 'geo') {
          const city = citiesData.find(c => c.name === params.name);
          return city ? city.displayName : params.name;
        }
        return null;
      }
    },
    legend: {
      data: Object.values(landUseNames),
      orient: 'horizontal',
      bottom: '0%',
      left: 'center',
      textStyle: {
        color: '#fff',
        fontSize: 12
      },
      itemWidth: 12,
      itemHeight: 12
    },
    geo: {
      map: 'yunnan_cities',
      roam: true,
      scaleLimit: { min: 0.8, max: 4 },
      aspectScale: 1.0,
      layoutCenter: ['50%', '50%'],
      layoutSize: '90%',
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
  if (!chartInstance.value || !citiesData || !landUseData) return;
  const baseOption = getBaseChartOption(newYear);
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

watch(() => props.year, (newYear) => {
  if (isVisible.value && chartInstance.value) {
    updateYear(newYear);
  }
});

onUnmounted(() => {
  // 移除 resize 事件监听
  window.removeEventListener('resize', handleResize);
  
  // 销毁 ECharts 实例
  if (chartInstance.value) {
    try {
      chartInstance.value.dispose();
    } catch (e) {
      console.warn('[EChartsPrefecturePie] Chart dispose warning:', e);
    }
    chartInstance.value = null;
  }
  
  // 清理 GeoJSON 和数据缓存
  citiesGeoJSON = null;
  citiesData = null;
  landUseData = null;
});

// 打开 AI 分析弹窗
const openAIAnalysis = () => {
  showAIModal.value = true;
};
</script>

<style scoped>
.echarts-prefecture-pie {
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

.header-placeholder {
  width: 32px;
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
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -45%);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -48%);
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
