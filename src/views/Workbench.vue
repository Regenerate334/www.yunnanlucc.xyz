<template>
  <div id="cesiumContainerWrapper">
    <!-- 背景遮罩层与地图掩膜层：Dashboard模式下隐藏，增加过渡动画 -->
    <transition name="layer-fade">
      <div v-if="!isDashboardMode" class="background-layer"></div>
    </transition>

    <!-- 区域信息悬浮提示 -->
    <div v-if="selectedEntity && !isDashboardMode" class="info-tooltip" :style="popupStyle">
      <div class="tooltip-title">{{ selectedEntity.name }}</div>
      <div v-for="(value, key) in selectedEntity.properties" :key="key" class="tooltip-row">
        <span class="tooltip-label">{{ key }}:</span>
        <span class="tooltip-value">{{ value }}</span>
      </div>
    </div>
    
    <!-- 加载状态指示器 -->
    <div v-if="isLoading" class="loading-overlay">
       <div class="spinner"></div>
       <div>数据加载中...</div>
    </div>

    <transition name="layer-fade">
      <div v-if="!isDashboardMode" class="mask-layer"></div>
    </transition>
    <div id="cesiumContainer"></div>

    <!-- 顶部标题栏（Dashboard模式下隐藏 且 区域分析模式下隐藏） -->
    <div v-if="!isDashboardMode && !isRegionalAnalysisMode" class="header-container">
      <div class="header-content">
        <button class="logout-btn" @click="handleLogout" title="退出登录">
          <img :src="logoutIcon" alt="退出" class="logout-icon-img" />
        </button>
      </div>
    </div>

    <!-- ============================================================ -->
    <!--                 Regional Analysis UI (New)                   -->
    <!-- ============================================================ -->

    <!-- 顶部控制面板 - 悬浮毛玻璃设计 (全宽版) -->
    <div v-if="isRegionalAnalysisMode" class="analysis-header floating-glass">
      <div class="header-left">
        <button class="back-btn-circle" @click="exitRegionalAnalysis" title="返回工作台">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div class="divider-vertical"></div>
        <div class="header-title">区域土地利用检测分析</div>
      </div>

      <div class="header-right">
        <!-- 空间单元 (Segmented Control) -->
         <div class="segmented-control">
          <div class="segment-bg" :style="{ left: spatialUnit === 'county' ? '4px' : '50%' }"></div>
          <button 
            :class="{ active: spatialUnit === 'county' }"
            @click="spatialUnit = 'county'"
          >县级</button>
          <button 
            :class="{ active: spatialUnit === 'grid' }"
            @click="spatialUnit = 'grid'"
          >格网</button>
        </div>

        <div class="divider-vertical small"></div>

        <!-- 分析指标 -->
        <div class="glass-select-wrapper">
          <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <select v-model="selectedAttribute">
            <option v-for="attr in attributes" :key="attr.value" :value="attr.value">
              {{ attr.label }}
            </option>
          </select>
          <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        <!-- 底图 -->
        <div class="glass-select-wrapper icon-only" title="切换底图">
           <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <select @change="(e) => handleBaseMapChange(e.target.value)">
            <option value="imagery">影像底图</option>
            <option value="vector">矢量底图</option>
            <option value="terrain">地形底图</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 区域分析专属图例 -->
    <div v-if="!isDashboardMode && spatialUnit !== 'clcd'" class="floating-legend glass-panel">
      <div class="legend-header">
        <div class="legend-title">{{ currentAttributeLabel }}</div>
        <div class="legend-subtitle">{{ selectedYear }}年 (单位: km²)</div>
      </div>
      <div class="legend-list">
        <div v-for="(color, index) in currentColorScale" :key="index" class="legend-row">
          <span class="legend-color-box" :style="{ background: color }"></span>
          <!-- 防止越界访问 -->
          <span class="legend-value">{{ currentLegendLabels[index] || '' }}</span>
        </div>
      </div>
    </div>
    <!-- 顶部统一工具栏 Container -->
    <div v-if="!isDashboardMode" class="main-toolbar">
      
      <!-- 图层类型选择器 (放在第一位以防布局跳动) -->
      <DropdownSelector 
        v-model="spatialUnit" 
        :options="[ 
          { label: 'CLCD 土地覆盖', value: 'clcd' },
          { label: '县级统计', value: 'county' },
          { label: '网格统计', value: 'grid' }
        ]"
        :width="150"
        title="切换图层类型"
      >
        <template #icon>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
           </svg>
        </template>
      </DropdownSelector>

      <!-- 年份选择器 (现在所有模式都显示，与底部播放器共存或互补) -->
      <YearRangeSelector v-model:selectedYear="selectedYear" :width="200" />

    
      <!-- 属性选择器 -->
      <DropdownSelector 
        v-if="spatialUnit !== 'clcd'"
        v-model="selectedAttribute" 
        :options="attributes"
        :width="160"
        placeholder="选择分析指标"
      >
        <template #icon>
           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </template>
      </DropdownSelector>
      
      <!-- BaseMap Selector (Moved into toolbar) -->
      <BaseMapSelector @change="handleBaseMapChange" />

    </div>

    <!-- Bottom Controls (Dashboard模式下隐藏) -->

    <!-- 底部控制按钮组（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="bottom-controls-container">
      <ViewResetControl />
      <DistanceMeasureButton />
      <AreaMeasureButton />
      <EChartsPrefecturePie :year="selectedYear" />
      <EChartsCountyPie :year="selectedYear" />
      <LandUseTrendControl :seriesData="cachedClcdData" />
      <RegionalTrendControl />
      <TransferMatrixControl 
        ref="transferControlRef"
        @transfer-query="handleTransferQuery" 
        @reset-map="handleResetMap" 
      />
      
      <!-- 时间轴播放器 (moved here) -->
      <TimePlayer 
        ref="timePlayerRef"
        v-model="selectedYear" 
        :years="playerYears" 
        :interval="spatialUnit === 'clcd' ? 10000 : 800"
        :show-speed-control="spatialUnit !== 'clcd'"
        layout="vertical"
        @update:modelValue="onTimePlayerYearChange"
      />
    </div>




    <!-- 大屏指挥中心入口按钮（切换模式）（Dashboard模式下隐藏 且 只在CLCD模式下显示） -->
    <div v-if="!isDashboardMode && spatialUnit === 'clcd'" class="dashboard-entry-container">
      <button @click="isDashboardMode = true" class="dashboard-toggle-btn" title="进入大屏指挥中心">
        <img :src="dashboardIcon" class="toggle-icon-img" alt="大屏" />
      </button>
    </div>

    <!-- 右侧图表面板区域（Dashboard模式下隐藏 且 只在CLCD模式下显示） -->
    <div v-if="!isDashboardMode && spatialUnit === 'clcd'" class="right-panels">
      <div class="panel-card legend-panel">
        <div class="legend-grid">
          <div v-for="(color, name) in clcdColors" :key="name" class="legend-item">
            <span class="legend-color" :style="{ background: color }"></span>
            <span class="legend-name">{{ legendNames[name] }}</span>
          </div>
        </div>
      </div>
    </div>



    <!-- 大屏指挥中心覆盖层 -->
    <transition name="fade">
      <DashboardOverlay v-if="isDashboardMode" v-model:year="selectedYear" @close="isDashboardMode = false" />
    </transition>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, shallowRef, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import YearRangeSelector from '../components/controls/YearRangeSelector.vue';
import ViewResetControl from '../components/controls/ViewResetControl.vue';
import BaseMapSelector from '../components/controls/BaseMapSelector.vue';
import DropdownSelector from '../components/controls/DropdownSelector.vue';
import LandUsePieChart from '../components/charts/LandUsePieChart.vue';
import DistanceMeasureButton from '../components/controls/DistanceMeasureButton.vue';
import AreaMeasureButton from '../components/controls/AreaMeasureButton.vue';
import EChartsPrefecturePie from '../components/controls/EChartsPrefecturePie.vue';
import EChartsCountyPie from '../components/controls/EChartsCountyPie.vue';
import LandUseTrendControl from '../components/controls/LandUseTrendControl.vue';
import RegionalTrendControl from '../components/controls/RegionalTrendControl.vue';
import TransferMatrixControl from '../components/controls/TransferMatrixControl.vue';
import SpatialLayerSelector from '../components/controls/SpatialLayerSelector.vue';
import TimePlayer from '../components/controls/TimePlayer.vue';
import DashboardOverlay from './DashboardOverlay.vue';
import { useMapStore } from '../stores/map.ts';
import { useGlobalStore } from '../stores/index.ts'; // New Import
import { clcdApi, authApi, analysisApi } from '../api/index.js';
import logoutIcon from '../assets/icons/logout.png';
import dashboardIcon from '../assets/icons/dashboard.png';

const router = useRouter();
const mapStore = useMapStore();
const globalStore = useGlobalStore();

const viewer = shallowRef(null);
const clcdLayer = shallowRef(null);
const baseMapLayer = shallowRef(null);
const spatialLayer = shallowRef(null);
const cachedClcdData = ref([]);

// State for Standard Workbench
const selectedYear = ref(1985);
const currentYearData = ref({});
const isDashboardMode = ref(false);

// State for Regional Analysis Mode
const isRegionalAnalysisMode = ref(false); // Can be removed or ignored
const isLoading = ref(false); 
const currentStatsField = ref(''); 
const spatialUnit = ref('clcd'); // Default to CLCD
const selectedAttribute = ref('cropland');
const wmsLayerCache = new Map(); // Map<cacheKey, Cesium.ImageryLayer>
const MAX_WMS_CACHE_SIZE = 15; // LRU 缓存上限，防止内存溢出

// LRU 缓存管理：添加图层到缓存，超限自动淘汰最旧图层
function addToCache(key, layer) {
  // 如果已存在，先删除再插入（移到末尾 = 最近使用）
  if (wmsLayerCache.has(key)) {
    wmsLayerCache.delete(key);
  }
  wmsLayerCache.set(key, layer);

  // 超过上限，淘汰最旧（Map 迭代顺序 = 插入顺序）
  while (wmsLayerCache.size > MAX_WMS_CACHE_SIZE) {
    const oldest = wmsLayerCache.entries().next().value;
    if (oldest) {
      const [oldestKey, oldestLayer] = oldest;
      if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.imageryLayers.remove(oldestLayer, true);
      }
      wmsLayerCache.delete(oldestKey);
      console.log('[LRU] Evicted:', oldestKey, '| Cache size:', wmsLayerCache.size);
    }
  }
}
const years = ref([]); // will be populated
const currentLegendLabels = ref([]); // Dynamic labels for WMS layer

const showRegionalTrendControl = ref(false);
const showLandTransferControl = ref(false); // New: 土地流转控制面板
const yunnanDataSource = shallowRef(null);
const provinceDataSource = shallowRef(null);
const highlightedEntity = shallowRef(null);
const transferDataSource = shallowRef(null);


// Time Player Ref
const timePlayerRef = ref(null);
const isPreloading = ref(false);
const PRELOAD_RANGE = 3; // 预加载前后各3年

// Hover Tooltip State
const selectedEntity = ref(null);
const popupStyle = ref({ left: '0px', top: '0px' });
let clickHandler = null;
let hoverDebounceTimer = null;
let lastPickPosition = null;

// Constant definitions
const clcdColors = {
  cropland: '#fae39c',
  forest: '#446f33',
  shrub: '#33a02c',
  grassland: '#abd37b',
  water: '#1e69b4',
  snow_ice: '#a6cee3',
  barren: '#cfbda3',
  impervious: '#e24290',
  wetland: '#289be8'
};

const legendNames = {
  cropland: '耕地',
  forest: '林地',
  shrub: '灌木',
  grassland: '草地',
  water: '水域',
  snow_ice: '冰雪',
  barren: '裸地',
  impervious: '建设用地',
  wetland: '湿地'
};

const legendConfigs = {
  cropland: {
    // 基于 #fae39c (淡黄) -> 深橙
    colors: ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506', '#401200']
  },
  forest: {
    // 基于 #446f33 (深绿) -> 浅绿到深绿
    colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b', '#00220e']
  },
  shrub: {
    // SLD Colors: YlGn (Yellow-Green) - Synced with shrub_dynamic.sld
    colors: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529', '#002518']
  },
  grassland: {
    // SLD Colors: YlGnBu (Yellow-Green-Blue) - Synced with grassland_dynamic.sld
    colors: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58', '#040e2c', '#020716']
  },
  water: {
    // Synced with water_dynamic.sld
    colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#041533']
  },
  wetland: {
    // Synced with wetland_dynamic.sld
    colors: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#042040']
  },
  impervious: {
    // SLD Colors: Reds - Synced with impervious_dynamic.sld
    colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d', '#330006']
  },
  barren: {
    // Synced with barren_dynamic.sld
    colors: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000', '#000000']
  },
  snow_ice: {
    // SLD Colors: PuBu (Purple-Blue) - Synced with snow_ice_dynamic.sld
    colors: ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858', '#011c2c']
  },
  // 变化分析模式 - 统一使用发散色带
  change_mode: {
    colors: ['#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac']
  }
};

const currentColorScale = computed(() => {
  // 流转模式使用专用红蓝色带
  if (selectedAttribute.value === 'transfer') {
    return transferColors;
  }
  // 变化模式使用统一发散色带
  if (isChangeMode.value) {
    return legendConfigs.change_mode.colors;
  }
  return legendConfigs[selectedAttribute.value]?.colors || legendConfigs.cropland.colors;
});

const currentAttributeLabel = computed(() => {
  if (selectedAttribute.value === 'transfer') return '土地流转量';
  const attr = attributes.value.find(a => a.value === selectedAttribute.value);
  return attr ? attr.label : selectedAttribute.value;
});

const allAttributes = [
  { label: '耕地', value: 'cropland' },
  { label: '林地', value: 'forest' },
  { label: '灌木', value: 'shrub' },
  { label: '草地', value: 'grassland' },
  { label: '水域', value: 'water' },
  { label: '冰雪', value: 'snow_ice' },
  { label: '裸地', value: 'barren' },
  { label: '建设用地', value: 'impervious' },
  { label: '湿地', value: 'wetland' }
];

const attributes = computed(() => {
  if (spatialUnit.value === 'grid') {
    return allAttributes.filter(attr => attr.value !== 'shrub');
  }
  return allAttributes;
});

// ===== 变化分析模式状态 =====
const isChangeMode = ref(false);
const changeYearFrom = ref(1985);
const changeYearTo = ref(2023);

// 监听变化模式参数变化，重新加载图层
watch([isChangeMode, changeYearFrom, changeYearTo], () => {
  if (viewer.value && spatialUnit.value !== 'clcd') {
    console.log('[Workbench] Change mode params updated, reloading WMS layer...');
    loadWMSLayer();
  }
});

// 时间播放器年份数组 - 使用globalStore.yearsAll
const playerYears = computed(() => {
  return globalStore.yearsAll || [1985, ...Array.from({ length: 2023 - 1990 + 1 }, (_, i) => 1990 + i)];
});

// ... (Colors and Attribute definitions remain same)

// 响应年份变化，自动更新图层（已被onTimePlayerYearChange和手动触发取代）
watch(selectedYear, (newYear, oldYear) => {
  if (viewer.value && newYear !== oldYear) {
    loadYearData(newYear); // Always update global stats/charts
    
    if (spatialUnit.value === 'clcd') {
      loadStandardLayer(newYear);
    }
    // 注意：county/grid模式的图层切换由onTimePlayerYearChange处理
  }
});

// 时间播放器年份变化处理 - 带预加载和平滑过渡
function onTimePlayerYearChange(newYear) {
  if (spatialUnit.value === 'clcd') return;
  
  console.log('[TimePlayer] Year changed to:', newYear);
  
  // 1. 切换当前图层（使用平滑过渡）
  switchToYearWithTransition(newYear);
  
  // 2. 预加载附近年份
  preloadNearbyYears(newYear);
}

// 平滑切换到指定年份的图层
async function switchToYearWithTransition(targetYear) {
  const cacheKey = `${targetYear}_${spatialUnit.value}_${selectedAttribute.value}`;
  
  // 检查缓存
  if (wmsLayerCache.has(cacheKey)) {
    console.log('[Transition] Cache HIT, smooth switch to:', cacheKey);
    smoothLayerTransition(cacheKey);
  } else {
    console.log('[Transition] Cache MISS, loading:', cacheKey);
    await loadWMSLayer(targetYear, true);
  }
}

// 平滑图层过渡动画
function smoothLayerTransition(targetKey) {
  const targetLayer = wmsLayerCache.get(targetKey);
  if (!targetLayer) return;
  
  // 立即显示目标图层
  targetLayer.show = true;
  targetLayer.alpha = 1;
  
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.imageryLayers.raiseToTop(targetLayer);
  }
  
  spatialLayer.value = targetLayer;
  
  // 隐藏其他图层
  wmsLayerCache.forEach((layer, key) => {
    if (key !== targetKey) {
      layer.alpha = 0;
      layer.show = false;
    }
  });
}

// 预加载附近年份的图层
async function preloadNearbyYears(centerYear) {
  if (isPreloading.value) return;
  isPreloading.value = true;
  
  const yearsToPreload = [];
  const allYears = playerYears.value;
  const centerIndex = allYears.indexOf(centerYear);
  
  if (centerIndex === -1) {
    isPreloading.value = false;
    return;
  }
  
  // 收集需要预加载的年份（前后各PRELOAD_RANGE年）
  for (let offset = -PRELOAD_RANGE; offset <= PRELOAD_RANGE; offset++) {
    const idx = centerIndex + offset;
    if (idx >= 0 && idx < allYears.length) {
      const year = allYears[idx];
      const cacheKey = `${year}_${spatialUnit.value}_${selectedAttribute.value}`;
      if (!wmsLayerCache.has(cacheKey)) {
        yearsToPreload.push(year);
      }
    }
  }
  
  console.log('[Preload] Years to preload:', yearsToPreload);
  
  // 并行预加载（静默模式，不切换显示）
  const preloadPromises = yearsToPreload.map(year => 
    loadWMSLayer(year, false).catch(err => 
      console.warn('[Preload] Failed for year:', year, err)
    )
  );
  
  await Promise.all(preloadPromises);
  
  // 清理超出范围的缓存
  cleanupDistantCache(centerYear);
  
  isPreloading.value = false;
  console.log('[Preload] Complete. Cache size:', wmsLayerCache.size);
}

// 清理距离当前年份过远的缓存
function cleanupDistantCache(centerYear) {
  const allYears = playerYears.value;
  const centerIndex = allYears.indexOf(centerYear);
  const maxDistance = PRELOAD_RANGE + 2; // 保留稍微多一点的缓存
  
  const keysToRemove = [];
  
  wmsLayerCache.forEach((layer, key) => {
    // 解析缓存key获取年份
    const yearMatch = key.match(/^(\d+)_/);
    if (yearMatch) {
      const cachedYear = parseInt(yearMatch[1]);
      const cachedIndex = allYears.indexOf(cachedYear);
      
      if (cachedIndex !== -1 && Math.abs(cachedIndex - centerIndex) > maxDistance) {
        keysToRemove.push(key);
      }
    }
  });
  
  keysToRemove.forEach(key => {
    const layer = wmsLayerCache.get(key);
    if (layer && viewer.value && !viewer.value.isDestroyed()) {
      viewer.value.imageryLayers.remove(layer, true);
    }
    wmsLayerCache.delete(key);
    console.log('[Cache Cleanup] Removed:', key);
  });
}



// 响应区域分析参数变化 (图层切换 & 属性切换)
watch([spatialUnit, selectedAttribute], ([newUnit, newAttr], [oldUnit, oldAttr]) => {
  // 流转模式由 handleTransferQuery 独立管理，不走 WMS 流程
  if (newAttr === 'transfer') return;

  // 1. Handle Pause
  if (timePlayerRef.value && typeof timePlayerRef.value.pause === 'function') {
      timePlayerRef.value.pause();
  }
  
  // 2. Clear UI Selection
  selectedEntity.value = null;
  clearHighlight();

  // 3. Manage Data Source Visibility immediately
  if (yunnanDataSource.value) {
      yunnanDataSource.value.show = (newUnit === 'city' || newUnit === 'county');
  }
  if (provinceDataSource.value) {
      provinceDataSource.value.show = (newUnit === 'clcd');
  }

  // 4. Clear Cache & Switch Layers
  clearWMSCache(); 

  if (newUnit === 'clcd') {
    // Switch to Standard
    loadStandardLayer(selectedYear.value);
    loadYearData(selectedYear.value);
  } else {
    // Switch to Analysis
    if (clcdLayer.value) {
       if (viewer.value && !viewer.value.isDestroyed()) {
          viewer.value.imageryLayers.remove(clcdLayer.value, true);
       }
       clcdLayer.value = null;
    }
    
    // Auto-fix Shrub for Grid
    if (newUnit === 'grid' && selectedAttribute.value === 'shrub') {
         // This will trigger watcher again? No, checks at top might prevent loops or we should set it carefully.
         // But allowMultiple calls is acceptable if guarded. 
         // Better to just notify user or let it switch. 
         // Let's just set it.
         selectedAttribute.value = 'grassland';
         return; // Let the next watcher firing handle everything.
    }

    loadWMSLayer(selectedYear.value, true).then(() => {
      preloadNearbyYears(selectedYear.value);
    });
  }
});

// ... (other refs)

// ...

// ===== 土地流转 WMS 渲染 =====
const transferControlRef = ref(null);
let transferWmsLayer = null; // 当前的流转 WMS 图层引用

// transfer_dynamic.sld 的 10 级红蓝色带（与 SLD 一致）
const transferColors = [
  '#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0',
  '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'
];

/**
 * 处理来自 LandTransferControl 的流转查询事件
 * 使用 WMS 服务端渲染（通过 GeoServer SQL View + viewparams + transfer_dynamic SLD）
 */
async function handleTransferQuery(params) {
  console.log('[Transfer] Query params:', params);
  isLoading.value = true;

  if (transferControlRef.value?.setLoading) {
    transferControlRef.value.setLoading(true);
  }

  try {
    const { yearStart, yearEnd, fromClass, toClass, unit } = params;

    // 1. 清理旧的流转图层
    clearTransferLayer();

    // 1b. 隐藏现有的面积 WMS 图层和 CLCD 图层，避免遮挡
    wmsLayerCache.forEach((layer) => { layer.show = false; layer.alpha = 0; });
    if (clcdLayer.value) clcdLayer.value.show = false;

    // 2. 调用 breaks API（transfer 模式）获取 sumExpr + breaks
    const token = localStorage.getItem('auth_token');
    const breaksUrl = `/api/clcd/breaks?mode=transfer&year_start=${yearStart}&year_end=${yearEnd}&from_class=${fromClass}&to_class=${toClass}&unit=${unit}&classes=10&method=jenks`;

    const response = await fetch(breaksUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `API error: ${response.status}`);
    }

    const breaksData = await response.json();
    console.log('[Transfer] Breaks data:', breaksData);

    if (!breaksData.breaks || breaksData.breaks.length === 0) {
      const msg = breaksData.message || '该时间段内无转移数据';
      if (transferControlRef.value?.setError) transferControlRef.value.setError(msg);
      return;
    }

    // 3. 构建 env 参数（分级阈值传给 SLD）
    //    _transfer_sum 列值单位为 km²（后端已除以 1,000,000）
    let breaks = breaksData.breaks;
    const numClasses = 10;

    // 补齐断点到 numClasses + 1
    if (breaks.length > 1 && breaks.length < numClasses + 1) {
      const lastVal = breaks[breaks.length - 1];
      const firstVal = breaks[0];
      const step = (lastVal - firstVal) / numClasses;
      const newBreaks = [];
      for (let i = 0; i <= numClasses; i++) {
        newBreaks.push(firstVal + i * step);
      }
      breaks = newBreaks;
    } else {
      while (breaks.length < numClasses + 1) breaks.push(breaks[breaks.length - 1]);
    }

    // _transfer_sum 列值为 km²（后端已除以 1,000,000），SLD 阈值直接用 km² 浮点数
    const dynamicAttr = breaksData.field; // '_transfer_sum'
    let envParams = `attr:${dynamicAttr}`;
    let lastThreshold = -Infinity;
    for (let i = 1; i < numClasses; i++) {
      const val = i < breaks.length - 1 ? breaks[i] : breaks[breaks.length - 1];
      // 用浮点数（km²），保留4位小数
      let thVal = parseFloat(val.toFixed(4));
      if (thVal <= lastThreshold) thVal = lastThreshold + 0.0001;
      lastThreshold = thVal;
      envParams += `;th${i}:${thVal}`;
    }

    // 4. 确定 GeoServer 图层名（直接表图层，非 SQL View）
    const layerName = unit === 'grid'
      ? 'WebGIS:spatial_grid_yunnan_transfer'
      : 'WebGIS:spatial_county_yunnan_transfer';

    console.log('[Transfer] WMS params:', { layerName, dynamicAttr, envParams });

    // 5. 创建 WMS 图层
    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: 'http://localhost:8080/geoserver/WebGIS/wms',
      layers: layerName,
      enablePickFeatures: true,
      parameters: {
        service: 'WMS',
        version: '1.1.0',
        request: 'GetMap',
        transparent: 'true',
        format: 'image/png',
        styles: 'transfer_dynamic',
        env: envParams,
        info_format: 'application/json'
      }
    });

    // 调试: 输出可直接在浏览器测试的 WMS GetMap URL
    const testUrl = `http://localhost:8080/geoserver/WebGIS/wms?service=WMS&version=1.1.0&request=GetMap&layers=${layerName}&styles=transfer_dynamic&format=image/png&transparent=true&width=256&height=256&srs=EPSG:4326&bbox=97.5,21.1,106.2,29.3&env=${encodeURIComponent(envParams)}`;
    console.log('[Transfer] 🧪 测试 URL (可直接在浏览器打开):', testUrl);

    // 错误日志: 瓦片加载失败时输出详情（首次输出完整信息，后续静默）
    let tileErrorCount = 0;
    wmsProvider.errorEvent.addEventListener((err) => {
      tileErrorCount++;
      if (tileErrorCount <= 3) {
        console.warn(`[Transfer] 瓦片加载失败 #${tileErrorCount}:`, err?.message || err);
      }
    });

    const newLayer = viewer.value.imageryLayers.addImageryProvider(wmsProvider);
    newLayer.alpha = 1;
    newLayer.show = true;
    viewer.value.imageryLayers.raiseToTop(newLayer);
    transferWmsLayer = newLayer;

    // 7. 更新图例
    const formatKm2 = (num) => {
      if (num === 0) return '0';
      const abs = Math.abs(num);
      if (abs >= 100) return Math.round(num).toString();
      if (abs >= 1) return num.toFixed(1);
      if (abs >= 0.01) return num.toFixed(3);
      if (abs >= 0.001) return num.toFixed(4);
      return num.toFixed(5);
    };
    const labels = [];
    for (let i = 0; i < numClasses; i++) {
      if (i > 0 && breaks[i] === breaks[breaks.length - 1]) break;
      labels.push(`${formatKm2(breaks[i])}-${formatKm2(breaks[i + 1])}`);
    }
    currentLegendLabels.value = labels;

    // 标记为 transfer 模式（图例使用）
    selectedAttribute.value = 'transfer';

    console.log('[Transfer] WMS layer rendered successfully.');

  } catch (err) {
    console.error('[Transfer] Query failed:', err);
    if (transferControlRef.value?.setError) {
      transferControlRef.value.setError(err.message || '查询失败，请检查服务器连接');
    }
  } finally {
    isLoading.value = false;
    if (transferControlRef.value?.setLoading) transferControlRef.value.setLoading(false);
  }
}

/**
 * 清除流转 WMS 图层
 */
function clearTransferLayer() {
  if (transferWmsLayer && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.imageryLayers.remove(transferWmsLayer, true);
    transferWmsLayer = null;
  }
  // 兼容旧的 DataSource 方式（如有残留）
  if (transferDataSource.value && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.dataSources.remove(transferDataSource.value, true);
    transferDataSource.value = null;
  }
}

/**
 * 重置地图：清除流转图层，恢复原有图层
 */
function handleResetMap() {
  clearTransferLayer();

  if (selectedAttribute.value === 'transfer') {
    selectedAttribute.value = 'cropland';
  }

  // 恢复正常图层（根据当前空间单元模式）
  if (spatialUnit.value === 'clcd') {
    loadStandardLayer(selectedYear.value);
  } else {
    // 恢复县级/格网面积图层
    loadWMSLayer(selectedYear.value, true);
  }
  console.log('[Transfer] Map reset complete.');
}


function setupClickHandler() {
  if (!viewer.value) return;
  
  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);
  clickHandler.setInputAction((movement) => {
    const position = movement.position;
    
    // 如果测量工具正在使用，不处理点击事件（避免与测距/测面积冲突）
    if (mapStore.activeMeasurementTool) {
        return;
    }
    
    // 仅在县域模式下展示标注
    if (spatialUnit.value !== 'county') {
        selectedEntity.value = null;
        clearHighlight();
        return;
    }

    const ray = viewer.value.camera.getPickRay(position);
    if (!ray) return;
    
    const featurePromise = viewer.value.scene.imageryLayers.pickImageryLayerFeatures(ray, viewer.value.scene);
    
    if (Cesium.defined(featurePromise)) {
        featurePromise.then(features => {
            if (features && features.length > 0) {
                const feature = features[0];
                const props = feature.properties || feature.data?.properties || {};
                
                // 尝试获取地名
                const regionName = props['地名'] || props['地级'] || props['省级'] || '未知区域';
                const displayProps = {};
                
                if (currentStatsField.value && props[currentStatsField.value] !== undefined) {
                    const rawVal = Number(props[currentStatsField.value]);
                    const valKm2 = (rawVal / 1000000).toFixed(2);
                    displayProps[currentAttributeLabel.value] = `${valKm2} km²`;
                }
                
                if (Object.keys(displayProps).length > 0) {
                   selectedEntity.value = {
                       name: regionName,
                       properties: displayProps
                   };
                   // 确保位置在鼠标点击处上方
                   popupStyle.value = {
                        left: position.x + 'px',
                        top: position.y - 20 + 'px'
                   };
                   // 高亮区域
                   highlightRegion(regionName);
                } else {
                    selectedEntity.value = null;
                    clearHighlight();
                }
            } else {
                selectedEntity.value = null;
                clearHighlight();
            }
        }).catch(() => {
            selectedEntity.value = null;
            clearHighlight();
        });
    } else {
        selectedEntity.value = null;
        clearHighlight();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 右键清除高亮和标注
  clickHandler.setInputAction(() => {
    selectedEntity.value = null;
    clearHighlight();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

// 高亮区域逻辑
function highlightRegion(name) {
    if (!yunnanDataSource.value) return;

    // 清除上一个高亮
    clearHighlight();

    const entities = yunnanDataSource.value.entities.values;
    // 模糊匹配，尝试匹配名称
    const target = entities.find(e => {
        const eName = e.properties.name ? e.properties.name.getValue() : '';
        // 增加匹配容错，比如 WMS 返回 "五华区"，GeoJSON 可能是 "五华区" 或 "昆明市五华区"
        return eName === name || eName.includes(name) || name.includes(eName);
    });

    if (target) {
        console.log('[Workbench] Highlighting region:', target.properties.name ? target.properties.name.getValue() : 'Unknown');
        if (target.polygon) {
            target.polygon.fill = true;
            // Flashing Cyan Effect
            target.polygon.material = new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty((time, result) => {
                // Alpha oscillates between 0.3 and 0.8 for strong pulsing
                const alpha = (Math.sin(time.secondsOfDay * 8) + 1.0) / 2.0 * 0.5 + 0.3;
                return Cesium.Color.fromCssColorString('#00E5FF').withAlpha(alpha, result);
            }, false));
            
            // White Outline
            target.polygon.outline = true;
            target.polygon.outlineColor = Cesium.Color.fromCssColorString('#FFFFFF');
            target.polygon.outlineWidth = 3;
        }
        highlightedEntity.value = target;
    } else {
        console.warn('[Workbench] No matching vector entity found for region:', name);
    }
}

function clearHighlight() {
    if (highlightedEntity.value) {
        if (highlightedEntity.value.polygon) {
            // Revert to invisible but pickable state
            highlightedEntity.value.polygon.fill = true; 
            highlightedEntity.value.polygon.material = Cesium.Color.WHITE.withAlpha(0.01);
            highlightedEntity.value.polygon.outline = false; 
        }
        highlightedEntity.value = null;
    }
}

// 监听测量工具激活事件，自动清除县域标注（问题4的修复）
window.addEventListener('clearCountyHighlight', () => {
  selectedEntity.value = null;
  clearHighlight();
});

onMounted(async () => {
  // ... (Cesium Init code)
  try {
     const viewerInstance = new Cesium.Viewer("cesiumContainer", {
      // ... (existing config)
      imageryProvider: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      infoBox: false,
      fullscreenButton: false,
      shouldAnimate: true,
      contextOptions: {
        webgl: {
          alpha: true,
          depth: true,
          stencil: true,
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false
        },
        allowTextureFilterAnisotropic: true
      }
    });
    viewer.value = viewerInstance;

    viewer.value.scene.postProcessStages.fxaa.enabled = true;
    viewer.value.scene.highDynamicRange = true;
    viewer.value.resolutionScale = window.devicePixelRatio || 1.0;
    viewer.value.cesiumWidget.creditContainer.style.display = "none";
    viewer.value.scene.screenSpaceCameraController.enableTilt = false;

    loadBaseMap('imagery');

    // 1. Load Standard Cloud-based Yunnan Counties GeoJSON (For County Analysis)
    Cesium.GeoJsonDataSource.load('/data/yunnan_all_counties.geojson', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF').withAlpha(0.2), 
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 1, 
      markerSize: 0,
      clampToGround: true
    }).then(function (dataSource) {
       viewer.value.dataSources.add(dataSource);
       yunnanDataSource.value = dataSource;
       
       const entities = dataSource.entities.values;
       for (let i = 0; i < entities.length; i++) {
         const entity = entities[i];
         if (entity.polygon) {
             // Invisible but pickable (fill must be true for picking)
             entity.polygon.fill = true; 
             entity.polygon.material = Cesium.Color.WHITE.withAlpha(0.01);
             entity.polygon.outline = false; // Hide clutter
         }
         if (entity.polyline) entity.polyline.show = false;
       }
       // Initial visibility check
       dataSource.show = spatialUnit.value === 'city'; // 'city' implies vector mode here effectively
    }).catch(e => {
        console.error('Failed to load cloud county data:', e);
    });

    // 2. Load Original Province Boundary (For CLCD Mode)
    // Use the optimized single-province file created by the extraction script
    Cesium.GeoJsonDataSource.load('/data/yunnan_province_only.geojson', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF'),
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 5,
      markerSize: 0,
      clampToGround: true
    }).then(function (dataSource) {
       viewer.value.dataSources.add(dataSource);
       provinceDataSource.value = dataSource;
       
       const entities = dataSource.entities.values;
       // No need to filter, file only contains Yunnan
       
       for (let i = 0; i < entities.length; i++) {
           const entity = entities[i];
           if (entity.polygon) {
               entity.polygon.fill = false;
               entity.polygon.outline = true;
               entity.polygon.outlineColor = Cesium.Color.fromCssColorString('#00E5FF');
               entity.polygon.outlineWidth = 3;
           }
           if (entity.polyline) {
               entity.polyline.width = 3;
               entity.polyline.material = Cesium.Color.fromCssColorString('#00E5FF');
           }
       }
       // Initial visibility check
       dataSource.show = spatialUnit.value === 'clcd';
    }).catch(console.error);
    
    // ... (Camera View)
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
      orientation: {
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });

    window.cesiumViewer = viewer.value;
    mapStore.setViewer(viewer.value);

    // 初始化视图锁定逻辑
    setupViewLock();
    // 设置鼠标事件
    setupClickHandler();

    // Initial Load based on default spatialUnit ('clcd')
    if (spatialUnit.value === 'clcd') {
        loadStandardLayer(selectedYear.value);
        loadYearData(selectedYear.value);
    } else {
        loadWMSLayer(selectedYear.value);
    }

  } catch (e) {
    console.error('Cesium initialization error:', e);
  }
});

/**
 * 视图锁定逻辑：防止云南省走出视野
 */
function setupViewLock() {
  if (!viewer.value) return;

  // 云南外接矩形 (W, S, E, N)
  const YUNNAN_RECT = {
    west: 97.5,
    south: 21.1,
    east: 106.2,
    north: 29.3
  };

  const RECT_CORNERS = [
    Cesium.Cartesian3.fromDegrees(YUNNAN_RECT.west, YUNNAN_RECT.south),
    Cesium.Cartesian3.fromDegrees(YUNNAN_RECT.east, YUNNAN_RECT.south),
    Cesium.Cartesian3.fromDegrees(YUNNAN_RECT.west, YUNNAN_RECT.north),
    Cesium.Cartesian3.fromDegrees(YUNNAN_RECT.east, YUNNAN_RECT.north),
    Cesium.Cartesian3.fromDegrees((YUNNAN_RECT.west + YUNNAN_RECT.east) / 2, (YUNNAN_RECT.south + YUNNAN_RECT.north) / 2)
  ];

  let outOfBoundsTimer = null;
  const BUFFER_TIME = 1500; // 1.5秒缓冲时间

  viewer.value.camera.moveEnd.addEventListener(() => {
    const scene = viewer.value.scene;
    const canvas = scene.canvas;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // 检查是否有任何点在屏幕内
    let anyPointVisible = false;
    let allLeft = true;
    let allRight = true;
    let allTop = true;
    let allBottom = true;

    for (const corner of RECT_CORNERS) {
      const pos = Cesium.SceneTransforms.worldToWindowCoordinates(scene, corner);
      if (pos) {
        if (pos.x >= 0 && pos.x <= width && pos.y >= 0 && pos.y <= height) {
          anyPointVisible = true;
          break;
        }
        if (pos.x >= 0) allLeft = false;
        if (pos.x <= width) allRight = false;
        if (pos.y >= 0) allTop = false;
        if (pos.y <= height) allBottom = false;
      } else {
        // 点在相机背面，不一定是完全不可见，但对于判定“滑出”来说，这种简单的点检查可能失效
        // 我们通过检查相机视锥体是否包含云南矩形来辅助判断
        continue;
      }
    }

    // 如果所有关键点都消失在同一侧，或者视锥体完全不包含云南
    const viewRect = viewer.value.camera.computeViewRectangle();
    const isIntersecting = viewRect ? Cesium.Rectangle.intersection(viewRect, Cesium.Rectangle.fromDegrees(YUNNAN_RECT.west, YUNNAN_RECT.south, YUNNAN_RECT.east, YUNNAN_RECT.north)) : true;

    const isCompletelyGone = !anyPointVisible && (allLeft || allRight || allTop || allBottom || !isIntersecting);

    if (isCompletelyGone) {
      console.warn('[ViewLock] 云南已移出视野，启动复位倒计时...');
      if (!outOfBoundsTimer) {
        outOfBoundsTimer = setTimeout(() => {
          console.log('[ViewLock] 执行视角复位');
          viewer.value.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
            duration: 1.5
          });
          outOfBoundsTimer = null;
        }, BUFFER_TIME);
      }
    } else {
      if (outOfBoundsTimer) {
        clearTimeout(outOfBoundsTimer);
        outOfBoundsTimer = null;
      }
    }
  });
}

// 响应年份变化，自动更新图层
watch(selectedYear, (newYear, oldYear) => {
  if (viewer.value && newYear !== oldYear) {
    console.log('[Workbench] Year changed:', newYear, 'Mode:', spatialUnit.value);
    if (spatialUnit.value === 'clcd') {
      loadStandardLayer(newYear);
    } else {
      loadWMSLayer(newYear);
    }
    // Always update chart data
    loadYearData(newYear);
  }
});

// Deprecated watcher removed to prevent conflict with the main [spatialUnit, selectedAttribute] watcher

// 响应属性变化 (当 selectedAttribute = 'transfer' 时表示流转模式，跳过 WMS 加载，避免 400 循环)
watch(selectedAttribute, (newAttr, oldAttr) => {
  if (viewer.value && spatialUnit.value !== 'clcd' && newAttr !== oldAttr && newAttr !== 'transfer') {
    console.log('[Workbench] Attribute changed:', newAttr);
    clearWMSCache();
    loadWMSLayer(selectedYear.value);
  }
});



async function loadYearData(year) {
  try {
    if (cachedClcdData.value.length === 0) {
      const data = await clcdApi.getProvinceTrend();
      cachedClcdData.value = data;
    }

    if (cachedClcdData.value.length > 0) {
      const yearData = cachedClcdData.value.find(item => item.year === year);
      if (yearData) {
        currentYearData.value = {
          year: yearData.year,
          耕地: yearData.cropland,
          林地: yearData.forest,
          灌木: yearData.shrub,
          草地: yearData.grassland,
          水域: yearData.water,
          湿地: yearData.wetland,
          建设用地: yearData.impervious,
          裸地: yearData.barren,
          冰雪: yearData.snow_ice
        };
      }
    }
  } catch (error) {
    console.error('加载年度数据失败:', error);
  }
}

function loadBaseMap(mapType) {
  if (!viewer.value) return;
  if (baseMapLayer.value) {
    viewer.value.imageryLayers.remove(baseMapLayer.value);
    baseMapLayer.value = null;
  }

  const token = 'ab70e90828db5b27aa040f2cb879c7f1';
  let layerName, url;

  switch (mapType) {
    case 'imagery':
      layerName = 'img';
      url = `http://t0.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'vector':
      layerName = 'vec';
      url = `http://t0.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'terrain':
      layerName = 'ter';
      url = `http://t0.tianditu.gov.cn/ter_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'dark':
      // 使用天地图矢量底图作为分析模式底图（避免 ArcGIS 异步初始化兼容性问题）
      layerName = 'vec';
      url = `http://t0.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    default:
      return;
  }

  try {
    const imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
      url: url,
      layer: layerName,
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: 'w',
      maximumLevel: 18
    });
    baseMapLayer.value = viewer.value.imageryLayers.addImageryProvider(imageryProvider, 0);
  } catch (e) {
    console.error('加载底图失败:', e);
  }
}

function handleBaseMapChange(mapType) {
  loadBaseMap(mapType);
}

// 标准模式图层加载 (Standard CLCD)
function loadStandardLayer(year) {
  if (!viewer.value) return;

  const oldLayer = clcdLayer.value;

  try {
    const newLayer = viewer.value.imageryLayers.addImageryProvider(
      new Cesium.WebMapServiceImageryProvider({
        url: 'http://localhost:8080/geoserver/WebGIS/wms',
        layers: `WebGIS:${year}_yunnan_CLCD_raster`,
        parameters: {
          service: 'WMS',
          version: '1.1.0',
          request: 'GetMap',
          format: 'image/png',
          transparent: true
        }
      })
    );

    clcdLayer.value = newLayer;

    if (oldLayer) {
      viewer.value.imageryLayers.remove(oldLayer, true);
    }
  } catch (e) {
    console.error(`加载 ${year} 年 CLCD 图层失败:`, e);
  }
}

// (土地流转 handleTransferQuery / handleResetMap 已在上方第628行新版实现)


// 区域分析模式图层加载 (Regional Analysis WMS)
async function loadWMSLayer(targetYear = null, visible = true) {
  // 流转模式不使用 WMS 图层，避免调用 breaks API 产生 400 错误
  if (selectedAttribute.value === 'transfer') return;

  if (!viewer.value) {
    return;
  }

  const year = targetYear || selectedYear.value;
  
  // 变化模式使用不同的缓存键
  const cacheKey = isChangeMode.value 
    ? `change_${changeYearFrom.value}_${changeYearTo.value}_${spatialUnit.value}_${selectedAttribute.value}`
    : `${year}_${spatialUnit.value}_${selectedAttribute.value}`;

  // 1. 如果缓存中存在，直接切换可见性
  if (wmsLayerCache.has(cacheKey)) {
    console.log('[Workbench] Cache HIT for:', cacheKey);
    if (visible) updateLayerVisibility(cacheKey);
    return;
  }

  console.log('[Workbench] Cache MISS for:', cacheKey, '- Loading new layer');

  const layerNameMap = {
    county: 'WebGIS:spatial_county_yunnan_stats',
    grid: 'WebGIS:spatial_grid_yunnan_stats'
  };
  
  const layerName = layerNameMap[spatialUnit.value];
  if (!layerName) {
    console.warn('[Workbench] Invalid spatialUnit:', spatialUnit.value);
    return;
  }
  
  try {
    // 统一使用自然断点法 (Jenks) 进行分级
    const method = 'jenks';
    const numClasses = 10; // SLD 样式需要 10 级 (th1-th9)
    
    const token = localStorage.getItem('auth_token');
    
    // 构建 API URL - 变化模式使用 yearFrom/yearTo
    let url;
    if (isChangeMode.value) {
      url = `/api/clcd/breaks?attr=${selectedAttribute.value}&yearFrom=${changeYearFrom.value}&yearTo=${changeYearTo.value}&method=${method}&classes=${numClasses}&unit=${spatialUnit.value}`;
    } else {
      url = `/api/clcd/breaks?attr=${selectedAttribute.value}&year=${year}&method=${method}&classes=${numClasses}&unit=${spatialUnit.value}`;
    }
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        console.error('[Workbench] Breaks API failed:', response.status, response.statusText);
        throw new Error(`API error: ${response.status}`);
    }

    const breaksData = await response.json();
    console.log('[Workbench] Breaks Data:', breaksData);
    
    const dynamicAttr = breaksData.field;
    currentStatsField.value = dynamicAttr;
    let breaks = breaksData.breaks;

    // km² 自适应精度格式化
    const formatKm2 = (num) => {
      if (num === 0) return '0';
      const abs = Math.abs(num);
      if (abs >= 100) return Math.round(num).toString();
      if (abs >= 1) return num.toFixed(1);
      if (abs >= 0.01) return num.toFixed(3);
      if (abs >= 0.001) return num.toFixed(4);
      return num.toFixed(5);
    };

    // 如果返回的断点数量不足，进行线性插值
    if (breaks.length > 1 && breaks.length < numClasses + 1) {
      const lastVal = breaks[breaks.length - 1];
      const firstVal = breaks[0];
      const step = (lastVal - firstVal) / numClasses;
      const newBreaks = [];
      for (let i = 0; i <= numClasses; i++) {
        newBreaks.push(firstVal + i * step);
      }
      breaks = newBreaks;
    } else {
      while (breaks.length < numClasses + 1) breaks.push(breaks[breaks.length - 1]);
    }

    // 图例标签
    if (year === selectedYear.value) {
      const labels = [];
      for (let i = 0; i < numClasses; i++) {
        if (i > 0 && breaks[i] === breaks[breaks.length - 1]) break;
        labels.push(`${formatKm2(breaks[i])}-${formatKm2(breaks[i + 1])}`);
      }
      currentLegendLabels.value = labels;
    }

    // 生成 SLD 环境变量参数
    let envParams = `attr:${dynamicAttr}`;
    let lastThreshold = isChangeMode.value ? -Infinity : 0;
    for (let i = 1; i < numClasses; i++) {
      const val = i < breaks.length - 1 ? breaks[i] : breaks[breaks.length - 1];
      let valSqM = Math.round(val * 1000000);
      if (valSqM <= lastThreshold) {
        valSqM = lastThreshold + 1;
      }
      lastThreshold = valSqM;
      envParams += `;th${i}:${valSqM}`;
    }
    
    // 变化模式使用专用发散色带样式
    const styleName = isChangeMode.value 
        ? 'landuse_change_dynamic' 
        : `${selectedAttribute.value}_dynamic`;
    
    // 调试日志
    console.log('[Workbench] WMS Debug Info:', {
        isChangeMode: isChangeMode.value,
        yearFrom: changeYearFrom.value,
        yearTo: changeYearTo.value,
        attr: selectedAttribute.value,
        breaksField: dynamicAttr,
        envParams: envParams,
        styleName: styleName
    });
  
    const wmsParameters = {
          service: 'WMS',
          version: '1.1.0',
          request: 'GetMap',
          transparent: 'true',
          format: 'image/png',
          styles: styleName,
          env: envParams,
          info_format: 'application/json'
    };

    console.log('[Workbench] Adding WMS Provider:', { layerName, wmsParameters });

    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: 'http://localhost:8080/geoserver/WebGIS/wms',
      layers: layerName,
      enablePickFeatures: true,
      parameters: wmsParameters
    });

    const newLayer = viewer.value.imageryLayers.addImageryProvider(wmsProvider);
    newLayer.alpha = 0; 
    newLayer.show = true;

    addToCache(cacheKey, newLayer);

    if (visible) {
        console.log('[Workbench] Setting layer visible:', cacheKey);
        updateLayerVisibility(cacheKey);
    }
    
  } catch (err) {
    console.error('[Workbench] Failed to load WMS:', err);
  }
}


function updateLayerVisibility(targetKey) {
    // console.log('[Workbench] updateLayerVisibility called for:', targetKey);
    
    // Ensure CLCD layer is gone (Brute Force Check)
    cleanupCLCDLayer();

    // 1. 设置当前层可见
    const targetLayer = wmsLayerCache.get(targetKey);
    if (targetLayer) {
        targetLayer.alpha = 1;
        targetLayer.show = true;
        if (viewer.value && !viewer.value.isDestroyed()) {
             viewer.value.imageryLayers.raiseToTop(targetLayer);
        }
        spatialLayer.value = targetLayer; 
    }

    // 2. 隐藏其他层
    wmsLayerCache.forEach((layer, key) => {
        if (key !== targetKey) {
          layer.alpha = 0;
          layer.show = false;
        }
    });
}

function cleanupCLCDLayer() {
   if (viewer.value && !viewer.value.isDestroyed()) {
       // 1. Remove tracked ref
       if (clcdLayer.value) {
           viewer.value.imageryLayers.remove(clcdLayer.value, true);
           clcdLayer.value = null;
       }
       // 2. Extra safety: try to find layers with similar characteristics or just rely on tracking for now.
       // Given Cesium layers don't have IDs by default, we must rely on our refs or custom props.
   }
}

function clearWMSCache() {
  wmsLayerCache.forEach((layer) => {
    try {
      if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.imageryLayers.remove(layer, true);
      }
    } catch (e) {}
  });
  wmsLayerCache.clear();
  spatialLayer.value = null;
  
  // Secondary Brute-Force Cleanup to catch stragglers
  cleanupResidueLayers();
}

// 暴力清理残留的“spatial_”开头的图层
function cleanupResidueLayers() {
    if (!viewer.value || viewer.value.isDestroyed()) return;

    const layers = viewer.value.imageryLayers;
    const count = layers.length;
    
    // Iterate backwards to safely remove
    for (let i = count - 1; i >= 0; i--) {
        const layer = layers.get(i);
        // Skip base map and CLCD
        if (layer === baseMapLayer.value || layer === clcdLayer.value) continue;

        const provider = layer.imageryProvider;
        if (provider instanceof Cesium.WebMapServiceImageryProvider) {
             // Access internal 'layers' property if possible, or usually it's passed in constructor options
             // Cesium providers store options in `_layers` (private) or we can infer.
             // But actually, we can just remove EVERYTHING that isn't white-listed.
             
             // Safer check if possible:
             // If this layer is NOT in our new cache, and NOT clcd/base, nuke it.
             
             // For now, let's rely on the fact that if we called clearWMSCache, 
             // we expect NO spatial layers to remain.
             
             console.log('[Workbench] Cleanup: Checking layer', i);
             // Verify if it's one of ours by checking if we still track it? No we cleared cache.
             
             // Assuming explicit removal is safer.
             // If we are unsure, we can try to identify if it is a "stats" layer.
             // But simple logic: If I called clearWMSCache, I want NO analysis layers.
             // Any layer that is NOT clcdLayer and NOT baseMapLayer is suspect.
             
             layers.remove(layer, true);
             console.log('[Workbench] Force removed lingering layer at index', i);
        }
    }
}

// 切换：进入区域分析
function enterRegionalAnalysis() {
  isRegionalAnalysisMode.value = true;
  
  // 移除 Standard CLCD
  if (clcdLayer.value) {
    viewer.value.imageryLayers.remove(clcdLayer.value, true);
    clcdLayer.value = null;
  }
  
  // 初始化加载
  loadWMSLayer(selectedYear.value);
  
  // 调整相机视角 (Optional: Sync with RegionalAnalysis view)
  // viewer.value.camera.flyTo(...) 
}

// 切换：退出区域分析 (返回工作台)
function exitRegionalAnalysis() {
  isRegionalAnalysisMode.value = false;
  
  // 清理 Regional Layers
  clearWMSCache();
  
  // 恢复 Standard CLCD
  loadStandardLayer(selectedYear.value);
}

// 跳转到区域检测分析页面 (Deprecated: Now acts as Switcher)
function goToRegionalAnalysis() {
  // router.push('/regional-analysis'); // Old
  console.log('[Workbench] Switching to Regional Analysis Mode');
  enterRegionalAnalysis();
}

onUnmounted(() => {
  console.log('[Workbench] Component unmounting, starting cleanup...');
  
  // 1. 移除 CLCD 图层
  if (viewer.value && clcdLayer.value) {
    try {
      viewer.value.imageryLayers.remove(clcdLayer.value, true);
    } catch (e) {}
    clcdLayer.value = null;
  }
  
  // Cleanup WMS Cache
  clearWMSCache();
  
  // 2. 移除底图图层
  if (viewer.value && baseMapLayer.value) {
    try {
      viewer.value.imageryLayers.remove(baseMapLayer.value, true);
    } catch (e) {}
    baseMapLayer.value = null;
  }
  
  // 4. 移除所有数据源（如云南边界等）
  if (viewer.value) {
    try {
      viewer.value.dataSources.removeAll(true);
    } catch (e) {}
  }
  
  // 5. 清除 mapStore 中的 viewer 引用
  mapStore.setViewer(null);
  
  // 6. 销毁 Cesium Viewer
  if (viewer.value && typeof viewer.value.destroy === 'function') {
    try {
      viewer.value.destroy();
    } catch (e) {}
    viewer.value = null;
  }
  
  window.cesiumViewer = null;
  cachedClcdData.value = [];
  currentYearData.value = {};
  
  if (clickHandler) {
      clickHandler.destroy();
      clickHandler = null;
  }
  
  console.log('[Workbench] Cleanup complete');
});


// 空间图层逻辑已迁移
</script>

<style>
body,
html {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden;
  width: 100%;
  height: 100%;
}

#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#cesiumContainerWrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.header-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  z-index: 1000;
  pointer-events: none;
}

.header-content {
  width: 100%;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
}

.logout-btn {
  position: absolute;
  right: 20px;
  top: 15px;
  width: 40px;
  height: 40px;
  background: rgba(13, 25, 48, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  transform: translateY(-2px);
}

.logout-icon-img {
  width: 24px;
  height: 24px;
  opacity: 0.8;
}

.background-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 100;
  pointer-events: none;
  background-image: url('../assets/images/front_bg.png');
  background-size: 106% 103%;
  background-position: center;
  background-repeat: no-repeat;
}

.mask-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 105;
  pointer-events: none;
  background-image: url('../assets/images/mask.png');
  background-size: 108% 104%;
  background-position: center;
  background-repeat: no-repeat;
}

/* Main Toolbar Container (Flexbox) - Moved to Right */
.main-toolbar {
  position: fixed;
  top: 80px; /* Moved up slightly per user request */
  right: 80px;
  left: auto;
  z-index: 900; /* Lowered z-index so popup windows (z-index 1000+) can cover it */
  display: flex;
  align-items: center;
  gap: 16px; /* Compact spacing */
}

/* BaseMap Selector - Moved to Left */
.basemap-selector-container {
  position: fixed;
  top: 20px;
  left: 20px;
  right: auto;
  z-index: 1100;
}

.spatial-layer-selector-container {
  position: fixed;
  top: 40px;
  left: 380px;
  z-index: 1100;
}

.bottom-controls-container {
  position: fixed;
  left: 20px;
  right: auto;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 110;
  pointer-events: auto; /* 确保可点击 */
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
  gap: 4px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #a5ccff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.control-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-4px);
  color: #ffffff;
}

.control-btn .icon {
  width: 24px;
  height: 24px;
}

.btn-label {
  font-size: 10px;
  font-weight: 600;
}

.dashboard-entry-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 110;
}

.dashboard-toggle-btn {
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
}

.dashboard-toggle-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-4px);
}

.toggle-icon-img {
  width: 32px;
  height: 32px;
  opacity: 0.9;
}

.right-panels {
  position: fixed;
  bottom: 24px;
  right: 24px;
  left: auto;
  z-index: 110;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.legend-panel {
  min-width: 160px;
}

.legend-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 20px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.legend-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

/* 过渡动画 */
.layer-fade-enter-active,
.layer-fade-leave-active {
  transition: opacity 0.5s ease;
}

.layer-fade-enter-from,
.layer-fade-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* ==========================================================================
   Regional Analysis Styles (Ported)
   ========================================================================== */

/* ==========================================================================
   Regional Analysis Styles (Ported & Adapted)
   ========================================================================== */



/* 浮动图例 (Regional Only) */
.floating-legend {
  position: fixed;
  bottom: 24px;
  right: 24px; /* 右下角 */
  left: auto;
  background: rgba(15, 23, 42, 0.6); 
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
  z-index: 900;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 200px;
}

.floating-legend .legend-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  border: none;
  padding: 0;
  text-align: center; /* Center Title */
}

.floating-legend .legend-subtitle {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 12px;
  text-align: center; /* Center Subtitle */
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color-box {
  width: 20px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(255,255,255,0.3);
}

.legend-value {
  font-size: 11px;
  color: rgba(255,255,255,0.9);
  /* Use same font as TimePlayer Year Selector: "PingFang SC", "Microsoft YaHei", sans-serif */
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif; 
}


/* 悬浮提示框 - 样式调整为与 DropdownSelector 一致 */
.info-tooltip {
  position: fixed;
  background: rgba(13, 25, 48, 0.4); /* 调整为 0.4 与按钮一致 */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2); /* 阴影稍微淡一点适配高透明度 */
  z-index: 2000;
  pointer-events: none;
  min-width: 180px;
  padding: 12px;
  transform: translate(-50%, -100%);
  animation: tooltipFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@keyframes tooltipFadeIn {
  from { opacity: 0; transform: translate(-50%, -90%); }
  to { opacity: 1; transform: translate(-50%, -100%); }
}

.tooltip-title {
  font-size: 20px; /* Increased from 16px */
  font-weight: 600;
  color: #fff;
  margin-bottom: 6px; /* Adjusted spacing */
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
  letter-spacing: 0.5px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 4px 4px; 
  font-size: 16px; /* Increased from 14px */
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  font-weight: 500;
}

.tooltip-value {
  color: #60a5fa; /* Blue accent for value */
  font-weight: 600;
  font-size: 18px; /* Explicitly larger for values */
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;
}

/* 时间轴播放器容器 - 放置在右侧 */
.time-player-container {
  position: fixed;
  top: 50%;
  left: auto; 
  right: 20px; /* Adjusted to 20px to match left toolbar symmetry */
  bottom: auto;
  transform: translateY(-50%);
  z-index: 1100;
  pointer-events: auto;
}

/* 滑入动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(30px);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ===== 变化分析模式 UI ===== */
.change-mode-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(30, 41, 59, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
}

.change-mode-toggle:hover {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(255, 255, 255, 0.25);
}

.change-mode-toggle.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.4));
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
}

.change-year-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(30, 41, 59, 0.9);
  border-radius: 8px;
  backdrop-filter: blur(8px);
}

.change-year-selector .year-select {
  padding: 6px 10px;
  background: rgba(51, 65, 85, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
}

.change-year-selector .year-select:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.5);
}

.change-year-selector .arrow {
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
}

</style>
