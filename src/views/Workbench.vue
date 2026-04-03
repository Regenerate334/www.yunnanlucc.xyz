<!--
  工作台主视图 (Workbench View)
  职责：系统核心业务交互中心，集成 Cesium 3D 地图引擎，负责土地利用数据渲染、时空演变分析及各类专题计算的逻辑调度。
  
  修改提示：
  1. 若涉及地图底图或图层逻辑，请检查 refreshMapLayer 与 loadWMSLayer 函数。
  2. 新增分析面板或工具栏组件，请在 <template> 的浮动层标记位进行挂载。
  3. 预加载逻辑由 PRELOAD_RANGE 控制，调整时需兼顾缓存上限 UI_CONFIG.maxWmsCacheSize。
-->
<template>
  <div id="cesiumContainerWrapper">
    <div class="background-layer"></div>
    <div id="cesiumContainer"></div>


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

    <AnalysisLegend 
      v-if="spatialUnit === 'clcd' && !globalStore.legendData && !showAnalysisPanels" 
      class="floating-legend"
      title="土地利用分类 (CLCD)"
      :items="clcdLegendItems"
    />

    <AnalysisLegend 
      v-if="spatialUnit !== 'clcd' && !globalStore.legendData && !showAnalysisPanels" 
      class="floating-legend"
      :title="selectedYear + '年' + currentAttributeLabel + '面积(km²)'"
      :items="areaLegendItems"
    />

    <AnalysisLegend 
      v-if="globalStore.legendData && !showAnalysisPanels" 
      class="global-analysis-legend" 
    />




    <transition name="wing-fade-left">
      <div v-if="showAnalysisPanels" class="analysis-wing left">
        <DashboardLeftPanel v-model:year="selectedYear" />
      </div>
    </transition>

    <transition name="wing-fade-right">
      <div v-if="showAnalysisPanels" class="analysis-wing right">
        <DashboardRightPanel v-model:year="selectedYear" />
        
        <button class="close-analysis-btn" @click="showAnalysisPanels = false">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </transition>

    <BottomNav 
      :selectedYear="selectedYear"
      :playerYears="playerYears"
      :spatialUnit="spatialUnit"
      :selectedAttribute="selectedAttribute"
      :attributes="attributes"
      :cachedClcdData="cachedClcdData"
      ref="bottomNavRef"
      @transfer-query="handleTransferQuery"
      @rate-query="handleRateQuery"
      @stats-query="handleSpatialStatsQuery"
      @update-visibility="handleSpatialStatsVisibility"
      @reset-map="handleResetMap"
      @base-map-change="handleBaseMapChange"
      @overview-click="showAnalysisPanels = !showAnalysisPanels"
      @update:selectedYear="onYearChange"
      @update:spatialUnit="(val) => spatialUnit = val"
      @update:selectedAttribute="(val) => selectedAttribute = val"
    />
  </div>
</template>

 * @logic 集成 Cesium 3D 地图引擎，协调 CLCD 土地利用数据加载、空间单元切换（县级/格网）及多维分析面板联动。
 */
<script setup>
import { onMounted, onUnmounted, ref, shallowRef, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import DropdownSelector from '../components/cards/DropdownSelector.vue';
import DashboardLeftPanel from '../components/dashboards/DashboardLeftPanel.vue';
import DashboardRightPanel from '../components/dashboards/DashboardRightPanel.vue';
import BottomNav from '../components/ui/BottomNav.vue';
import AnalysisLegend from '../components/ui/AnalysisLegend.vue';
import { useMapStore } from '../stores/map.ts';
import { useGlobalStore } from '../stores/index.ts'; 
import { clcdApi, authApi, analysisApi } from '../api/index.js';
import { addExclusiveAnalysisLayer, clearAllAnalysisLayers } from '../utils/cesiumUtils.js';
import { GEOSERVER_CONFIG, UI_CONFIG } from '../config/index.js';
import { CLCD_COLORS, LANDUSE_NAMES, LEGEND_CONFIGS, SDE_COLORS, ATTRIBUTE_LABELS } from '../constants/landuse.js';

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
const showAnalysisPanels = ref(true);
const isDashboardMode = showAnalysisPanels; // Keep for compatibility if needed elsewhere

// State for Regional Analysis Mode
const isRegionalAnalysisMode = ref(false); // Can be removed or ignored
const isLoading = ref(false); 
const currentStatsField = ref(''); 
const spatialUnit = computed({
  get: () => globalStore.activeLayer,
  set: (val) => globalStore.setActiveLayer(val)
});
const selectedAttribute = ref('cropland');
const wmsLayerCache = new Map(); // Map<cacheKey, Cesium.ImageryLayer>
const clcdLayerCache = new Map(); // 用于 Standard (CLCD) 模式的平滑切换缓存
const breaksCache = new Map(); // 缓存 API 返回的分级断点，消除请求延迟
const activeWmsKey = ref(null); // 记录当前意图加载的活跃图层键名，用于防止竞态冲突
const lastRequestId = ref(0);   // 用于追踪最新的加载请求，过时的请求将被丢弃

// LRU 缓存管理：添加图层到缓存，超限自动淘汰最旧图层
function addToCache(key, layer) {
  // 如果已存在，先删除再插入（移到末尾 = 最近使用）
  if (wmsLayerCache.has(key)) {
    wmsLayerCache.delete(key);
  }
  wmsLayerCache.set(key, layer);

  // 超过上限，淘汰最旧（Map 迭代顺序 = 插入顺序）
  while (wmsLayerCache.size > UI_CONFIG.maxWmsCacheSize) {
    const oldest = wmsLayerCache.entries().next().value;
    if (oldest) {
      const [oldestKey, oldestLayer] = oldest;
      if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.imageryLayers.remove(oldestLayer, true);
      }
      wmsLayerCache.delete(oldestKey);
        // console.log('[LRU] Evicted:', oldestKey, '| Cache size:', wmsLayerCache.size);
    }
  }
}
const years = ref([]); // will be populated
const currentLegendLabels = ref([]); // Dynamic labels for WMS layer

const yunnanDataSource = shallowRef(null);
const provinceDataSource = shallowRef(null);
const highlightedEntity = shallowRef(null);
const transferDataSource = shallowRef(null);


// Bottom Nav Ref
const bottomNavRef = ref(null);
const isPreloading = ref(false);
const PRELOAD_RANGE = 3; // 提升预加载深度，提前拉取前后各 3 年的瓦片与断点数据
const BUFFER_DELAY = 800; // 全局缓冲延迟 (ms)

// Hover Tooltip State
const selectedEntity = ref(null);
const popupStyle = ref({ left: '0px', top: '0px' });
let clickHandler = null;
let hoverDebounceTimer = null;
let lastPickPosition = null;

// Constant definitions
// Constants now imported from @/constants/landuse.js
const clcdColors = CLCD_COLORS;
const legendNames = LANDUSE_NAMES;
const configs = LEGEND_CONFIGS;

const currentColorScale = computed(() => {
  // 流转模式使用专用红蓝色带
  if (selectedAttribute.value === 'transfer') {
    return transferColors;
  }
  // 变化模式使用统一发散色带
  if (isChangeMode.value) {
    return LEGEND_CONFIGS.change_mode.colors;
  }
  return LEGEND_CONFIGS[selectedAttribute.value]?.colors || LEGEND_CONFIGS.cropland.colors;
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

// 变化分析模式状态
const isChangeMode = ref(false);
const changeYearFrom = ref(1985);
const changeYearTo = ref(2023);

// 响应变化模式参数变化已被集成到下方的统一 watch 中

// 时间播放器年份数组 - 强制使用 33 个物理可用年份
const playerYears = computed(() => {
  return [
    1985, 
    1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 
    2001, 
    2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023
  ];
});

// 统一构建图例项传给组件，确保全平台视觉一致
const areaLegendItems = computed(() => {
  if (!currentColorScale.value || !currentLegendLabels.value) return [];
  return currentColorScale.value.map((color, index) => ({
    color: color,
    label: currentLegendLabels.value[index] || ''
  })).filter(item => item.label);
});

// CLCD 专用图例项
const clcdLegendItems = computed(() => {
  return Object.keys(clcdColors).map(name => ({
    color: clcdColors[name],
    label: legendNames[name]
  }));
});



// 统一地图刷新逻辑 (核心入口)
async function refreshMapLayer(forceClearCache = false) {
  const requestId = ++lastRequestId.value;
  const currentId = requestId; // 闭包锁定当前 ID
  const year = selectedYear.value;
  const unit = spatialUnit.value;
  const attr = selectedAttribute.value;
  
  // console.log(`[MapRefresh] Request #${requestId} | ${year} | ${unit} | ${attr}`);

  if (forceClearCache) {
    clearWMSCache();
    breaksCache.clear();
  }

  // 1. 同步加载侧边栏数据
  loadYearData(year);

  // 2. 根据模式执行特定加载逻辑
  if (unit === 'clcd') {
    loadStandardLayer(year);
  } else {
    // 处理 Shrub 兼容性 (格网无灌木)
    if (unit === 'grid' && attr === 'shrub') {
      selectedAttribute.value = 'grassland';
      return; // 会触发下一次 watch，交给下个周期处理
    }

    // 3. 执行核心图层加载 (非流转/非率分析模式)
    const thematicModes = ['transfer', 'reclamation', 'conversion'];
    if (!thematicModes.includes(attr)) {
      // 执行平滑过渡
      await switchToYearWithTransition(year);
      
      // 预加载附近年份 (仅针对 WMS)
      preloadNearbyYears(year);
    }
  }
}

// 响应各个其间参数的变化，统一驱动地图刷新 (Global Watcher)
watch(
  [selectedYear, spatialUnit, selectedAttribute, isChangeMode, changeYearFrom, changeYearTo], 
  ([newYear, newUnit, newAttr, newIsChange, newYFrom, newYTo], [oldYear, oldUnit, oldAttr, oldIsChange, oldYFrom, oldYTo]) => {
    if (!viewer.value) return;

    // console.log('[Workbench-GlobalWatch] Triggered by parameter change');

    // 如果是从分析模式切回 CLCD，或者切换了空间分辨率/属性，或者是进入/退出变化模式，清理 WMS 状态
    const needsCleanup = newUnit !== oldUnit || newAttr !== oldAttr || newIsChange !== oldIsChange;
    
    // 如果空间分辨率从 CLCD 改变，执行默认跳转逻辑 (如 1985 耕地)
    if (newUnit !== oldUnit && ['county', 'grid'].includes(newUnit) && oldUnit === 'clcd') {
        let moved = false;
        if (selectedYear.value !== 1985) { selectedYear.value = 1985; moved = true; }
        if (selectedAttribute.value !== 'cropland') { selectedAttribute.value = 'cropland'; moved = true; }
        if (moved) return; // 让 setter 触发下一次 watch
    }

    refreshMapLayer(needsCleanup);
  }, 
  { deep: false }
);

// 年份变化处理入口 (保留给 UI 事件)
function onYearChange(newYear) {
  selectedYear.value = newYear;
}

// 平滑切换到指定年份的图层
async function switchToYearWithTransition(targetYear) {
  const cacheKey = `${targetYear}_${spatialUnit.value}_${selectedAttribute.value}`;
  
  if (wmsLayerCache.has(cacheKey)) {
    updateLayerVisibility(cacheKey, lastRequestId.value);
  } else {
    await loadWMSLayer(targetYear, true, lastRequestId.value);
  }
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
  
  // console.log('[Preload] Years to preload:', yearsToPreload);
  
  // 并行预加载（静默模式，不切换显示）
  const preloadPromises = yearsToPreload.map(async (year) => {
    if (spatialUnit.value === 'clcd') {
      return loadStandardLayer(year); 
    }
    // 关键：预加载 WMS 的同时，提前拉取 breaks 统计数据并存入缓存
    return loadWMSLayer(year, false).catch(err => 
      console.warn('[Preload] Failed for year:', year, err)
    );
  });
  
  await Promise.all(preloadPromises);
  
  // 清理超出范围的缓存
  cleanupDistantCache(centerYear);
  
  isPreloading.value = false;
  // console.log('[Preload] Complete. Cache size:', wmsLayerCache.size);
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
    // console.log('[Cache Cleanup] Removed:', key);
  });
}



// 响应区域分析参数变化已被集成到上方的统一 watch 中





// 垦殖率 / 转换率 WMS 渲染
// 率分析颜色
const reclamationColors = LEGEND_CONFIGS.reclamation.colors;
const conversionColors  = LEGEND_CONFIGS.conversion.colors;
let rateWmsLayer = null;
let currentRateColors = []; // 用于共享给图例更新

async function handleRateQuery(params) {
  // console.log('[Rate] Query params:', params);
  // 自动清理上一专题的图层
  cleanupThemeLayers(globalStore.activeTheme);
  globalStore.setActiveTheme('rate');

  isLoading.value = true;
  if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(true);

  try {
    const token = localStorage.getItem('auth_token');
    const { year, year_start, year_end, from_class, to_class, attribute, unit, legendTitle } = params;

    // 1. 获取分级断点
    let breaksUrl = `/api/clcd/breaks?mode=rate&attr=${attribute}&year=${year}&unit=${unit}&classes=10&method=jenks`;
    if (attribute === 'conversion') {
      breaksUrl += `&year_start=${year_start}&year_end=${year_end}`;
      if (from_class !== '') breaksUrl += `&from_class=${from_class}`;
      if (to_class   !== '') breaksUrl += `&to_class=${to_class}`;
    }

    const bResp = await fetch(breaksUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!bResp.ok) throw new Error(`Breaks API error: ${bResp.status}`);
    const breaksData = await bResp.json();
    // console.log('[Rate] Breaks data:', breaksData);

    if (!breaksData.breaks || breaksData.breaks.length === 0) {
      throw new Error('该参数下无有效计算数据，请检查年份或流转方向');
    }

    // 2. 隐藏现有图层
    wmsLayerCache.forEach(layer => { layer.show = false; layer.alpha = 0; });
    if (clcdLayer.value) clcdLayer.value.show = false;

    // 3. 构建 env 参数
    const numClasses = 10;
    let breaks = [...breaksData.breaks];
    while (breaks.length < numClasses + 1) breaks.push(breaks[breaks.length - 1]);

    const dynamicAttr = breaksData.field; // '_rate_val'
    let envParams = `attr:${dynamicAttr}`;
    let lastThreshold = -Infinity;
    for (let i = 1; i < numClasses; i++) {
      let thVal = parseFloat(breaks[i].toFixed(6));
      if (thVal <= lastThreshold) thVal = lastThreshold + 0.000001;
      lastThreshold = thVal;
      envParams += `;th${i}:${thVal}`;
    }

    // 4. 创建 WMS 图层
    const activeStyle = attribute === 'reclamation' ? 'reclamation_rate' : 'conversion_rate';
    currentRateColors = attribute === 'reclamation' ? reclamationColors : conversionColors;

    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_CONFIG.wmsUrl,
      layers: 'WebGIS:spatial_county_yunnan_stats',
      enablePickFeatures: true,
      parameters: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        transparent: 'true',
        format: 'image/png',
        styles: `WebGIS:${activeStyle}`,
        env: envParams,
        info_format: 'application/json'
      }
    });

    const newLayer = new Cesium.ImageryLayer(wmsProvider);
    newLayer.isAnalysisLayer = true;
    newLayer.alpha = 1; 
    newLayer.show = true;
    
    // 专题图层不进入 WMS 缓存，直接使用互斥策略显示
    addExclusiveAnalysisLayer(viewer.value, newLayer, BUFFER_DELAY);
    rateWmsLayer = newLayer;

    // 5. 更新图例
    globalStore.updateLegend({
      title: legendTitle,
      type: 'continuous',
      items: currentRateColors.map((c, i) => ({
        color: c,
        label: `${(breaks[i] * 100).toFixed(2)}% - ${(breaks[i + 1] * 100).toFixed(2)}%`
      }))
    });

  } catch (err) {
    console.error('[Rate] Error:', err);
    if (bottomNavRef.value?.rateControl?.setError) bottomNavRef.value.rateControl.setError(err.message);
  } finally {
    isLoading.value = false;
    if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(false);
  }
}

// ===== 时空演变与标准差椭圆渲染 =====
let spatialStatsDataSource = null;
let blankBoundaryWmsLayer = null;
const sdeColors = SDE_COLORS;
const spatialStatsVisibility = ref({ trajectory: true, sde: true });

function handleSpatialStatsVisibility(visibility) {
  spatialStatsVisibility.value = visibility;
  if (!spatialStatsDataSource || !viewer.value) return;

  const entities = spatialStatsDataSource.entities.values;
  entities.forEach(ent => {
    const type = ent.properties.type ? ent.properties.type.getValue() : '';
    if (type === 'trajectory') {
      ent.show = visibility.trajectory;
    } else if (type === 'sde' || type === 'center') {
      ent.show = visibility.sde;
    }
  });
}

async function handleSpatialStatsQuery(params) {
  // console.log('[SpatialStats] params:', params);
  // 自动清理上一专题的图层
  cleanupThemeLayers(globalStore.activeTheme);
  globalStore.setActiveTheme('spatial_stats');

  isLoading.value = true;
  if (bottomNavRef.value?.spatialStatsControl?.setLoading) {
    bottomNavRef.value.spatialStatsControl.setLoading(true);
  }
  try {
    const { showBlankBoundary, showTrajectory, showSDE } = params;
    spatialStatsVisibility.value = { trajectory: showTrajectory, sde: showSDE };
    const response = await analysisApi.getSpatialStatsSeries(params);

    if (!response || !response.features || response.features.length === 0) {
      throw new Error(response.message || '没有足够流转数据生成标准差椭圆');
    }

    if (spatialStatsDataSource && viewer.value) {
      viewer.value.dataSources.remove(spatialStatsDataSource, true);
    }
    if (blankBoundaryWmsLayer && viewer.value) {
      viewer.value.imageryLayers.remove(blankBoundaryWmsLayer, true);
      blankBoundaryWmsLayer = null;
    }

    // 处理“空白行政边界”模式 (直接从数据库加载 WMS)
    if (showBlankBoundary) {
      // 1. 隐藏所有业务 WMS
      wmsLayerCache.forEach(layer => { layer.show = false; layer.alpha = 0; });
      if (clcdLayer.value) clcdLayer.value.show = false;
      if (transferWmsLayer) transferWmsLayer.show = false;
      if (rateWmsLayer) rateWmsLayer.show = false;

      // 2. 加载数据库中的行政边界 WMS (通过 SLD 实现白底黑框)
      const sldBody = `
        <StyledLayerDescriptor version="1.0.0">
          <NamedLayer>
            <Name>WebGIS:yunnan_country_level_city_boundaries</Name>
            <UserStyle>
              <FeatureTypeStyle>
                <Rule>
                  <PolygonSymbolizer>
                    <Fill><CssParameter name="fill">#FFFFFF</CssParameter></Fill>
                    <Stroke>
                      <CssParameter name="stroke">#000000</CssParameter>
                      <CssParameter name="stroke-width">0.5</CssParameter>
                    </Stroke>
                  </PolygonSymbolizer>
                </Rule>
              </FeatureTypeStyle>
            </UserStyle>
          </NamedLayer>
        </StyledLayerDescriptor>
      `;

      const wmsProvider = new Cesium.WebMapServiceImageryProvider({
        url: GEOSERVER_CONFIG.wmsUrl,
        layers: 'WebGIS:yunnan_country_level_city_boundaries',
        parameters: {
          service: 'WMS',
          version: '1.1.0',
          request: 'GetMap',
          transparent: 'true',
          format: 'image/png',
          sld_body: sldBody
        }
      });
      blankBoundaryWmsLayer = new Cesium.ImageryLayer(wmsProvider);
      blankBoundaryWmsLayer.alpha = 1.0; // 纯白底
      viewer.value.imageryLayers.add(blankBoundaryWmsLayer);
      // 不要 lowerToBottom，否则会被卫星图遮挡
      viewer.value.imageryLayers.raiseToTop(blankBoundaryWmsLayer);
    }

    spatialStatsDataSource = new Cesium.GeoJsonDataSource();
    await spatialStatsDataSource.load(response, {
      clampToGround: false
    });

    const entities = spatialStatsDataSource.entities.values;
    
    // 找出所有所有的 period 并排序，以分配固定颜色
    const periods = Array.from(new Set(entities.filter(e => e.properties.period).map(e => e.properties.period.getValue()))).sort();

    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];
      const type = ent.properties.type ? ent.properties.type.getValue() : '';
      const periodStr = ent.properties.period ? ent.properties.period.getValue() : '';
      const colorIdx = periods.indexOf(periodStr) % sdeColors.length;
      const baseColor = Cesium.Color.fromCssColorString(periodStr ? sdeColors[colorIdx] : '#E24290');

      if (type === 'sde') {
        const sdeProps = ent.properties.standardDeviationalEllipse ? ent.properties.standardDeviationalEllipse.getValue() : null;
        
        if (sdeProps) {
           const lat = sdeProps.meanCenterCoordinates[1];
           const lon = sdeProps.meanCenterCoordinates[0];
           ent.position = Cesium.Cartesian3.fromDegrees(lon, lat, 10000);
           
           const R_METER_PER_DEG = 111320;
           ent.ellipse = new Cesium.EllipseGraphics({
              semiMajorAxis: sdeProps.semiMajorAxis * R_METER_PER_DEG,
              semiMinorAxis: (sdeProps.semiMinorAxis * R_METER_PER_DEG) * Math.cos(Cesium.Math.toRadians(lat)),
              rotation: Cesium.Math.toRadians(90 - sdeProps.angle),
              height: 10000, 
              outline: true,
              outlineColor: baseColor,
              outlineWidth: 2, // 减细线宽
              material: Cesium.Color.TRANSPARENT // 内部透明，仅留边框
           });
           ent.polygon = undefined; 
        } else {
            ent.polygon.height = 10000;
            ent.polygon.material = Cesium.Color.TRANSPARENT;
            ent.polygon.outline = true;
            ent.polygon.outlineColor = baseColor;
            ent.polygon.outlineWidth = 2;
        }
        ent.show = spatialStatsVisibility.value.sde;
      } else if (type === 'center') {
        const pos = ent.position.getValue(Cesium.JulianDate.now());
        if (pos) {
            const carto = Cesium.Cartographic.fromCartesian(pos);
            ent.position = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 12000);
        }

        ent.point = new Cesium.PointGraphics({
          color: baseColor,
          pixelSize: 8, // 减小点的大小
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        });
        
        let yearText = '';
        if (ent.properties.yearStart) {
            yearText = ent.properties.yearStart.getValue();
        } else if (periodStr) {
            const yy1 = parseInt(periodStr.substring(1, 3));
            yearText = yy1 > 50 ? `19${yy1}` : `20${String(yy1).padStart(2, '0')}`;
        }

        if (yearText) {
           ent.label = new Cesium.LabelGraphics({
             text: String(yearText),
             font: '12px "Inter", sans-serif',
             fillColor: Cesium.Color.WHITE,
             outlineColor: Cesium.Color.BLACK,
             outlineWidth: 2,
             pixelOffset: new Cesium.Cartesian2(0, -15),
             style: Cesium.LabelStyle.FILL_AND_OUTLINE,
             disableDepthTestDistance: Number.POSITIVE_INFINITY,
             eyeOffset: new Cesium.Cartesian3(0, 0, -2000)
           });
        }
        ent.show = spatialStatsVisibility.value.sde;
      } else if (type === 'trajectory') {
        const positions = ent.polyline.positions.getValue(Cesium.JulianDate.now());
        if (positions) {
            const raisedPositions = positions.map(p => {
                const carto = Cesium.Cartographic.fromCartesian(p);
                return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 11000);
            });
            ent.polyline.positions = raisedPositions;
        }

        // 细黑色箭头线样式，模仿参考图
        ent.polyline.material = new Cesium.PolylineArrowMaterialProperty(Cesium.Color.BLACK.withAlpha(0.6));
        ent.polyline.width = 4;
        ent.polyline.arcType = Cesium.ArcType.NONE;
        ent.show = spatialStatsVisibility.value.trajectory;
      }
    }

    viewer.value.dataSources.add(spatialStatsDataSource);
    
    // 自动定位到结果
    viewer.value.flyTo(spatialStatsDataSource, {
       offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-90), 600000)
    });

    // 6. 更新图例
    globalStore.updateLegend({
      title: params.legendTitle || '时空演变分析',
      type: 'categorical',
      items: periods.map((p, i) => ({
        label: p,
        color: sdeColors[i % sdeColors.length]
      }))
    });

  } catch (err) {
    console.error('[SpatialStats] Error:', err);
    alert(err.message || '分析查询失败');
  } finally {
    isLoading.value = false;
    if (bottomNavRef.value?.spatialStatsControl?.setLoading) {
      bottomNavRef.value.spatialStatsControl.setLoading(false);
    }
  }
}

// ===== 土地流转 WMS 渲染 =====
let transferWmsLayer = null; // 当前的流转 WMS 图层引用

/**
 * 按专题类型精准清理图层（专题切换时自动调用）
 * @param {string|null} themeToClean - 要清理的专题：'transfer' | 'rate' | 'spatial_stats' | null
 */
function cleanupThemeLayers(themeToClean) {
  if (!themeToClean || !viewer.value || viewer.value.isDestroyed()) return;
  // console.log('[Workbench] Auto-cleanup theme:', themeToClean);

  if (themeToClean === 'transfer' || themeToClean === 'all') {
    if (transferWmsLayer) {
      viewer.value.imageryLayers.remove(transferWmsLayer, true);
      transferWmsLayer = null;
    }
    if (transferDataSource.value) {
      viewer.value.dataSources.remove(transferDataSource.value, true);
      transferDataSource.value = null;
    }
  }

  if (themeToClean === 'rate' || themeToClean === 'all') {
    if (rateWmsLayer) {
      viewer.value.imageryLayers.remove(rateWmsLayer, true);
      rateWmsLayer = null;
    }
  }

  if (themeToClean === 'spatial_stats' || themeToClean === 'all') {
    if (spatialStatsDataSource) {
      viewer.value.dataSources.remove(spatialStatsDataSource, true);
      spatialStatsDataSource = null;
    }
    if (blankBoundaryWmsLayer) {
      viewer.value.imageryLayers.remove(blankBoundaryWmsLayer, true);
      blankBoundaryWmsLayer = null;
    }
    // 恢复行政边界原始样式（针对"空白背景"模式）
    if (yunnanDataSource.value) {
      const entities = yunnanDataSource.value.entities.values;
      entities.forEach(ent => {
        if (ent.polygon) {
          ent.polygon.material = Cesium.Color.WHITE.withAlpha(0.01);
          ent.polygon.outline = false;
        }
      });
    }
  }

  // 清除图例
  globalStore.clearLegend();
  if (selectedAttribute.value === 'transfer') {
    selectedAttribute.value = 'cropland';
  }
}

// 处理重置/清理分析图层
function handleResetMap() {
  // console.log('[Workbench] handleResetMap called, clearing analysis layers');
  // 1. 恢复之前的基础图层状态
  globalStore.restorePreviousLayer();
  
  // 2. 清理流转图层和其他专属UI
  clearAllAnalysisLayers(viewer.value);
  transferWmsLayer = null;
  rateWmsLayer = null;

  if (transferDataSource.value && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.dataSources.remove(transferDataSource.value, true);
    transferDataSource.value = null;
  }

  if (spatialStatsDataSource && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.dataSources.remove(spatialStatsDataSource, true);
    spatialStatsDataSource = null;
  }
  if (blankBoundaryWmsLayer && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.imageryLayers.remove(blankBoundaryWmsLayer, true);
    blankBoundaryWmsLayer = null;
  }

  globalStore.clearLegend();
  if (selectedAttribute.value === 'transfer') {
    selectedAttribute.value = 'cropland';
  }
  
  // 3. 恢复行政边界原始样式 (针对之前开启了“空白背景”模式的情况)
  if (yunnanDataSource.value) {
    const entities = yunnanDataSource.value.entities.values;
    entities.forEach(ent => {
        if (ent.polygon) {
            ent.polygon.material = Cesium.Color.WHITE.withAlpha(0.01);
            ent.polygon.outline = false;
        }
    });
    // 如果是 CLCD 模式，完全隐藏县级边界 DataSource；若是统计模式，则保持显示但变为透明
    yunnanDataSource.value.show = (globalStore.activeLayer !== 'clcd');
  }

  // 4. 触发当前 activeLayer 所对应图层的重新显示
  if (globalStore.activeLayer === 'clcd' && clcdLayer.value) {
     clcdLayer.value.show = true;
  } else if (['county', 'grid'].includes(globalStore.activeLayer)) {
     const cacheKey = `${selectedYear.value}_${globalStore.activeLayer}_${selectedAttribute.value}`;
     const layer = wmsLayerCache.get(cacheKey);
     if (layer) {
       layer.show = true;
       layer.alpha = 1;
     } else {
       loadWMSLayer(selectedYear.value, true);
     }
  }

  // 5. 重置专题状态
  globalStore.setActiveTheme(null);
}

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
  // console.log('[Transfer] Query params:', params);
  // 自动清理上一专题的图层
  cleanupThemeLayers(globalStore.activeTheme);
  globalStore.setActiveTheme('transfer');

  isLoading.value = true;

  if (bottomNavRef.value?.transferControl?.setLoading) {
    bottomNavRef.value.transferControl.setLoading(true);
  }

  try {
    const { yearStart, yearEnd, fromClass, toClass, unit, legendTitle } = params;

    // 1. 记录旧图层引用用于平滑过渡 (Double Buffering)
    const oldLayer = transferWmsLayer;

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
    // console.log('[Transfer] Breaks data:', breaksData);

    if (!breaksData.breaks || breaksData.breaks.length === 0) {
      const msg = breaksData.message || '该时间段内无转移数据';
      if (bottomNavRef.value?.transferControl?.setError) bottomNavRef.value.transferControl.setError(msg);
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

    // console.log('[Transfer] WMS params:', { layerName, dynamicAttr, envParams });

    // 5. 创建 WMS 图层
    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_CONFIG.wmsUrl,
      layers: layerName,
      enablePickFeatures: true,
      parameters: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        transparent: 'true',
        format: 'image/png',
        styles: 'WebGIS:transfer_dynamic',
        env: envParams,
        info_format: 'application/json'
      }
    });

    // 调试: 输出可直接在浏览器测试的 WMS GetMap URL
    const testUrl = `/geoserver/WebGIS/wms?service=WMS&version=1.1.1&request=GetMap&layers=${layerName}&styles=WebGIS:transfer_dynamic&format=image/png&transparent=true&width=256&height=256&srs=EPSG:4326&bbox=97.5,21.1,106.2,29.3&env=${encodeURIComponent(envParams)}`;
    // console.log('[Transfer] 🧪 WMS Test URL:', testUrl);

    // 错误日志: 瓦片加载失败时输出详情（首次输出完整信息，后续静默）
    let tileErrorCount = 0;
    wmsProvider.errorEvent.addEventListener((err) => {
      tileErrorCount++;
      if (tileErrorCount <= 3) {
        console.warn(`[Transfer] 瓦片加载失败 #${tileErrorCount}:`, err?.message || err);
      }
    });

    const newLayer = new Cesium.ImageryLayer(wmsProvider);
    newLayer.alpha = 1;
    newLayer.show = true;
    
    // 使用互斥策略添加
    addExclusiveAnalysisLayer(viewer.value, newLayer, BUFFER_DELAY);
    
    // 更新当前引用
    transferWmsLayer = newLayer;

    // 延迟销毁逻辑在互斥模式下已由 addExclusiveAnalysisLayer 自动处理（即刻清理旧图层）
    // 如果由于性能原因仍需保留 oldLayer 做平滑过渡，可以手动在 addExclusiveAnalysisLayer 中跳过清理或维持当前双缓冲逻辑
    // 但根据“全局单例”要求，此处回归标准互斥调用。

    // 7. 更新图例
    const formatKm2 = (num) => {
      if (num === 0) return '0';
      if (Number.isInteger(num)) return num.toString();
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

    // 7. 同步更新全局图例 Store
    globalStore.updateLegend({
      title: legendTitle,
      type: unit === 'grid' ? 'categorical' : 'continuous',
      items: labels.map((l, i) => ({
        label: l,
        color: transferColors[i]
      }))
    });

    // console.log('[Transfer] WMS layer rendered successfully.');

  } catch (err) {
    console.error('[Transfer] Query failed:', err);
    if (bottomNavRef.value?.transferControl?.setError) {
      bottomNavRef.value.transferControl.setError(err.message || '查询失败，请检查服务器连接');
    }
  } finally {
    isLoading.value = false;
    if (bottomNavRef.value?.transferControl?.setLoading) bottomNavRef.value.transferControl.setLoading(false);
  }
}

// 清理图层逻辑已挪到上方的 handleResetMap


function setupClickHandler() {
  if (!viewer.value) return;
  
  clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);
  
  // 1. 左键点击：高亮并弹出信息
  clickHandler.setInputAction((movement) => {
    const position = movement.position;
    
    // 如果测量工具正在使用，不处理点击事件
    if (mapStore.activeMeasurementTool) return;
    
    // 支持县域和格网模式下的点击（CLCD模式暂时屏蔽）
    if (spatialUnit.value === 'clcd') {
        selectedEntity.value = null;
        clearHighlight();
        return;
    }

    const ray = viewer.value.camera.getPickRay(position);
    if (!ray) return;
    
    // 从 ImageryLayers 中拾取 WMS 特征
    const featurePromise = viewer.value.scene.imageryLayers.pickImageryLayerFeatures(ray, viewer.value.scene);
    
    if (Cesium.defined(featurePromise)) {
        featurePromise.then(features => {
            if (features && features.length > 0) {
                const feature = features[0];
                const props = feature.properties || feature.data?.properties || {};
                
                // 更加宽容的地名提取逻辑
                const regionName = props['地名'] || props['name'] || props['NAME'] || props['county'] || props['region'] || props['REGION_NAME'] || props['地级'] || props['省级'] || '未知区域';
                const displayProps = {};
                
                // 提取数值属性
                if (spatialUnit.value === 'land_transfer' || selectedAttribute.value === 'transfer') {
                    // 流转模式专用逻辑：寻找流转量字段
                    const transferVal = props['_transfer_sum'] || props['_sum'] || props['transfer_sum'] || props['sum'];
                    if (transferVal !== undefined) {
                        const valKm2 = Number(transferVal).toFixed(2);
                        // 使用当前属性标签或通用标签
                        const label = currentAttributeLabel.value || '流转面积';
                        displayProps[label] = `${valKm2} km²`;
                    }
                } else if (currentStatsField.value && props[currentStatsField.value] !== undefined) {
                    const rawVal = Number(props[currentStatsField.value]);
                    // 假设单位为平方米，转为平方公里
                    const valKm2 = (rawVal / 1000000).toFixed(2);
                    displayProps[currentAttributeLabel.value] = `${valKm2} km²`;
                }
                
                // 即使没有数值属性，也要显示地名并高亮
                selectedEntity.value = {
                    name: regionName,
                    properties: displayProps
                };
                
                // 执行高亮 (确保图层可见并在最上方)
                if (yunnanDataSource.value) {
                    yunnanDataSource.value.show = true;
                    viewer.value.dataSources.raiseToTop(yunnanDataSource.value);
                }
                highlightRegion(regionName);

                // 记录地理位置用于实时投影（实现“依比例”锚定）
                // 优先使用面中心或拾取点
                const cartesian = viewer.value.camera.pickEllipsoid(position);
                if (cartesian) {
                    lastPickPosition = cartesian;
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

  // 2. 鼠标移动：切换手型指针
  clickHandler.setInputAction((movement) => {
    if (mapStore.activeMeasurementTool) return;
    
    const ray = viewer.value.camera.getPickRay(movement.endPosition);
    if (!ray) {
        viewer.value.scene.canvas.style.cursor = 'default';
        return;
    }
    
    // 这里简单判定：如果是县域或格网模式，且鼠标在要素上方，则变手型
    // 注意：pickImageryLayerFeatures 是异步的，这里不宜频繁调用 API
    // 我们可以结合 scene.pick 快速判定背景矢量
    const pickedObject = viewer.value.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id && (spatialUnit.value === 'county' || spatialUnit.value === 'grid')) {
        viewer.value.scene.canvas.style.cursor = 'pointer';
    } else {
        viewer.value.scene.canvas.style.cursor = 'default';
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

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
    // 模糊匹配，尝试匹配名称（去掉可能的行政区划后缀，增加匹配度）
    const cleanSearchName = name.replace(/(省|市|州|区|县|镇|乡)$/, '');
    
    const target = entities.find(e => {
        const eName = e.properties.name ? e.properties.name.getValue() : '';
        const eNameClean = eName.replace(/(省|市|州|区|县|镇|乡)$/, '');
        return eName === name || eName.includes(name) || name.includes(eName) || (cleanSearchName && eNameClean === cleanSearchName);
    });

    if (target) {
        // console.log('[Workbench] Highlighting region:', target.properties.name ? target.properties.name.getValue() : 'Unknown');
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
  
  try {
     const viewerInstance = new Cesium.Viewer("cesiumContainer", {
      
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
    viewer.value.scene.highDynamicRange = true; // 恢复 HDR
    viewer.value.resolutionScale = window.devicePixelRatio || 1.0; // 恢复分辨率倍数
    
    // 渲染精度优化 (保留瓦片缓存限制)
    viewer.value.scene.globe.maximumScreenSpaceError = 2.0; // 恢复默认精度
    viewer.value.scene.globe.tileCacheSize = 50; // 保留较小的瓦片缓存以节省基础显存
    
    // 监听渲染事件，实时更新提示框位置与比例
    viewer.value.scene.postRender.addEventListener(updatePopupPosition);

    viewer.value.cesiumWidget.creditContainer.style.display = "none";
    
    // 禁用双击缩放
    viewer.value.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    
    // 锁定相机：禁用倾斜和查看模式，确保护视角始终垂直向下
    viewer.value.scene.screenSpaceCameraController.enableTilt = false;
    viewer.value.scene.screenSpaceCameraController.enableLook = false;


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
       dataSource.show = spatialUnit.value !== 'clcd'; 
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

    // 新增：高度限制判断（防止缩放过小）
    // 默认高度约 1.9M，超过 5M (5000km) 则判定为缩放过小
    const currentHeight = viewer.value.camera.positionCartographic.height;
    const MAX_ALTITUDE = 5000000; 
    const isTooFar = currentHeight > MAX_ALTITUDE;

    const isOutOfControl = (!anyPointVisible && (allLeft || allRight || allTop || allBottom || !isIntersecting)) || isTooFar;

    if (isOutOfControl) {
      if (isTooFar) {
         console.warn('[ViewLock] 缩放跨度过大，即将自动复位...');
      } else {
         console.warn('[ViewLock] 云南已移出视野，启动复位倒计时...');
      }
      
      if (!outOfBoundsTimer) {
        outOfBoundsTimer = setTimeout(() => {
          // console.log('[ViewLock] 执行视角复位');
          viewer.value.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
            duration: 1.5
          });
          outOfBoundsTimer = null;
        }, isTooFar ? 500 : BUFFER_TIME); // 如果缩得太小，缩短等待时间
      }
    } else {
      if (outOfBoundsTimer) {
        clearTimeout(outOfBoundsTimer);
        outOfBoundsTimer = null;
      }
    }
  });
}

// (土地使用率 loadYearData 已在下方实现)



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

  const token = import.meta.env.VITE_TIANDITU_TOKEN;
  let layerName, url;

  switch (mapType) {
    case 'imagery':
      layerName = 'img';
      url = `https://t0.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'vector':
      layerName = 'vec';
      url = `https://t0.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'terrain':
      layerName = 'ter';
      url = `https://t0.tianditu.gov.cn/ter_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'dark':
      // 使用天地图矢量底图作为分析模式底图（避免 ArcGIS 异步初始化兼容性问题）
      layerName = 'vec';
      url = `https://t0.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
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
function loadStandardLayer(year, visible = true) {
  if (!viewer.value) return;
  
  // 校验年份有效性 (根据 D 盘物理文件清单)
  const validYears = [
    1985, 
    1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 
    2001, 
    2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023
  ];
  if (!validYears.includes(Number(year))) {
    if (visible && clcdLayer.value) {
      clcdLayer.value.show = false;
    }
    return;
  }

  const cacheKey = `yunnan_${year}`;
  
  // 检查缓存
  if (clcdLayerCache.has(cacheKey)) {
    const cachedLayer = clcdLayerCache.get(cacheKey);
    if (visible) {
      const targetKey = `yunnan_${year}`;
      updateLayerVisibility(targetKey, lastRequestId.value, true);
      clcdLayer.value = cachedLayer;
    }
    return;
  }

  try {
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_CONFIG.wmsUrl,
      layers: GEOSERVER_CONFIG.layers.yunnanTime,
      parameters: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        format: 'image/png',
        transparent: true,
        time: `${year}-01-01`
      }
    });

    const newLayer = new Cesium.ImageryLayer(provider);
    newLayer.isAnalysisLayer = true;
    newLayer.alpha = 0; // 预加载默认透明
    newLayer.show = true;
    
    // 加入缓存
    clcdLayerCache.set(cacheKey, newLayer);
    
    // 如果需要显示，执行渐变切换
    if (visible) {
      updateLayerVisibility(cacheKey, lastRequestId.value, true);
      clcdLayer.value = newLayer;
    } else {
      // 仅加入场景但不切换
      if (!viewer.value.imageryLayers.contains(newLayer)) {
        viewer.value.imageryLayers.add(newLayer);
      }
    }
    
  } catch (e) {
    console.error(`加载 ${year} 年 CLCD 图层失败:`, e);
  }
}

// (土地流转 handleTransferQuery / handleResetMap 已在上方第628行新版实现)


// 区域分析模式图层加载 (Regional Analysis WMS)
async function loadWMSLayer(targetYear = null, visible = true, reqId = null) {
  // 专题分析模式（流转、率分析）不使用 WMS 缓存逻辑，避免调用 breaks API 产生 400 错误
  const thematicAttrs = ['transfer', 'reclamation', 'conversion'];
  if (thematicAttrs.includes(selectedAttribute.value)) return;

  if (!viewer.value) {
    return;
  }

  // 如果提供了 reqId 且已经落后于最新请求，则丢弃
  if (reqId && reqId < lastRequestId.value) {
    // console.log(`[WMS] Discarding outdated request #${reqId}`);
    return;
  }

  const year = targetYear || selectedYear.value;
  
  // 变化模式使用不同的缓存键
  const cacheKey = isChangeMode.value 
    ? `change_${changeYearFrom.value}_${changeYearTo.value}_${spatialUnit.value}_${selectedAttribute.value}`
    : `${year}_${spatialUnit.value}_${selectedAttribute.value}`;

  // 1. 如果缓存中存在，验证其是否被外部强制销毁以防崩溃
  if (wmsLayerCache.has(cacheKey)) {
    const cachedLayer = wmsLayerCache.get(cacheKey);
    console.log('[WMS] Cache HIT:', cacheKey);
    if (cachedLayer && typeof cachedLayer.isDestroyed === 'function' && cachedLayer.isDestroyed()) {
      console.warn('[WMS] Cached layer was destroyed, removing from cache.');
      wmsLayerCache.delete(cacheKey);
    } else {
      if (visible) {
          // 哪怕命中缓存，如果是当前主年份，也要刷新一下图例标签
          const cachedBreaks = breaksCache.get(cacheKey);
          if (cachedBreaks && year === selectedYear.value) {
              console.log('[WMS] Updating legend from cached breaks');
              updateLegendLabelsFromBreaks(cachedBreaks.breaks);
          }
          console.log('[WMS] Updating visibility for cached layer');
          updateLayerVisibility(cacheKey);
      }
      return;
    }
  }

  console.log('[WMS] Cache MISS, fetching breaks for:', cacheKey);

  // 1b. 检查 Breaks 缓存，如果命中则跳过 API 请求
  let breaksData = breaksCache.get(cacheKey);
  
  const layerNameMap = {
    county: 'WebGIS:spatial_county_yunnan_stats',
    grid: 'WebGIS:spatial_grid_yunnan_stats'
  };
  
  const layerName = layerNameMap[spatialUnit.value];
  if (!layerName) return;

  try {
    if (!breaksData) {
        const method = 'jenks';
        const numClasses = 10;
        const token = localStorage.getItem('auth_token');
        
        let url;
        if (isChangeMode.value) {
          url = `/api/clcd/breaks?attr=${selectedAttribute.value}&yearFrom=${changeYearFrom.value}&yearTo=${changeYearTo.value}&method=${method}&classes=${numClasses}&unit=${spatialUnit.value}`;
        } else {
          url = `/api/clcd/breaks?attr=${selectedAttribute.value}&year=${year}&method=${method}&classes=${numClasses}&unit=${spatialUnit.value}`;
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        breaksData = await response.json();
        console.log('[WMS] Breaks fetched:', breaksData.breaks);
        breaksCache.set(cacheKey, breaksData);
    }
    
    const dynamicAttr = breaksData.field;
    console.log('[WMS] Dynamic attribute:', dynamicAttr);
    currentStatsField.value = dynamicAttr;
    let breaks = breaksData.breaks;
    const numClasses = 10;

    // 更新图例 (仅针对主显示年份)
    if (year === selectedYear.value) {
        updateLegendLabelsFromBreaks(breaks);
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
    /*
    console.log('[Workbench] WMS Debug Info:', {
        isChangeMode: isChangeMode.value,
        yearFrom: changeYearFrom.value,
        yearTo: changeYearTo.value,
        attr: selectedAttribute.value,
        breaksField: dynamicAttr,
        envParams: envParams,
        styleName: styleName
    });
    */
  
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

    // console.log('[Workbench] Adding WMS Provider:', { layerName, wmsParameters });

    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_CONFIG.wmsUrl,
      layers: layerName,
      enablePickFeatures: true,
      parameters: wmsParameters
    });

    const newLayer = new Cesium.ImageryLayer(wmsProvider);
    // 关键改变：预加载时就加入地图（alpha=0），如果是立即显示则设为 1
    newLayer.alpha = visible ? 1 : 0; 
    newLayer.show = true;
    newLayer.isAnalysisLayer = true; // 打上分析图层标记，防止被误删

    if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.imageryLayers.add(newLayer);
    }

    // 缓存依然保留，但实际加载到地图时会触发互斥
    addToCache(cacheKey, newLayer);

    if (visible) {
        // console.log('[WMS] Setting layer visible initially:', cacheKey);
        updateLayerVisibility(cacheKey, reqId);
    }
    
  } catch (err) {
    console.error('[Workbench] Failed to load WMS:', err);
  }
}


/**
 * 通用图层可见性切换函数 (支持 WMS 统计图层与 CLCD 影像图层)
 * 采用 Alpha 通道交叉渐变算法实现丝滑播放
 */
function updateLayerVisibility(targetKey, reqId = null, isClcd = false) {
    if (reqId && reqId < lastRequestId.value) return;
    
    const cache = isClcd ? clcdLayerCache : wmsLayerCache;
    const targetLayer = cache.get(targetKey);
    if (!targetLayer || !viewer.value) return;

    // 1. 甄别模式对应的“当前图层”引用
    const previousLayer = isClcd ? clcdLayer.value : spatialLayer.value;
    const isSameLayer = previousLayer === targetLayer;

    // 2. 确保目标图层在地图上并置顶
    if (!viewer.value.imageryLayers.contains(targetLayer)) {
        targetLayer.isAnalysisLayer = true;
        viewer.value.imageryLayers.add(targetLayer);
    }
    
    // 强制置顶 (如果正在执行统计分析，确保统计层始终在影像层之上)
    viewer.value.imageryLayers.raiseToTop(targetLayer);
    
    // 3. 执行交叉渐变 (Cross-fade)
    if (!isSameLayer && previousLayer && previousLayer.show) {
        targetLayer.show = true;
        targetLayer.alpha = 0;
        
        let start = null;
        const duration = 350; // 优化后更紧凑的渐变时长 (350ms)
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            if (progress < 1) {
                // 如果用户已经中途切换至更新的年份，则停止当前动画
                const currentActiveKey = isClcd ? `yunnan_${selectedYear.value}` : activeWmsKey.value;
                if (activeWmsKey.value === targetKey || (isClcd && Number(targetKey.split('_').pop()) === selectedYear.value)) {
                    targetLayer.alpha = progress;
                    previousLayer.alpha = 1 - progress;
                    requestAnimationFrame(animate);
                }
            } else {
                targetLayer.alpha = 1;
                previousLayer.alpha = 0;
                previousLayer.show = false;
            }
        };
        requestAnimationFrame(animate);
    } else {
        targetLayer.show = true;
        targetLayer.alpha = 1;
    }

    // 4. 同步更新视图引用
    if (isClcd) {
        clcdLayer.value = targetLayer;
    } else {
        spatialLayer.value = targetLayer; 
        activeWmsKey.value = targetKey;
    }
    
    // 清理非相邻年份的缓存
    cleanupOfflineLayers(targetKey, isClcd);
}

/**
 * 清理远程缓存，防止 WebGL 资源堆积
 */
function cleanupOfflineLayers(activeKey, isClcd = false) {
    const cache = isClcd ? clcdLayerCache : wmsLayerCache;
    const activeYearStr = isClcd ? activeKey.split('_').pop() : activeKey.split('_')[0];
    const activeYear = parseInt(activeYearStr);
    
    if (isNaN(activeYear)) return;

    cache.forEach((layer, key) => {
        const layerYearStr = isClcd ? key.split('_').pop() : key.split('_')[0];
        const layerYear = parseInt(layerYearStr);
        if (Math.abs(layerYear - activeYear) > 7 && key !== activeKey) {
            layer.show = false;
            layer.alpha = 0;
        }
    });

    // 额外的分析层级维护（如果是 WMS 统计模式）
    if (!isClcd) {
       cleanupCLCDLayer(); // 统计模式下清理非缓存的静态 CLCD 层
    }
}

// 提取图例标签更新函数
function updateLegendLabelsFromBreaks(breaks) {
    const numClasses = 10;
    const formatKm2 = (num) => {
      if (num === 0) return '0';
      if (Number.isInteger(num)) return num.toString();
      const abs = Math.abs(num);
      if (abs >= 100) return Math.round(num).toString();
      if (abs >= 1) return num.toFixed(1);
      if (abs >= 0.01) return num.toFixed(3);
      if (abs >= 0.001) return num.toFixed(4);
      return num.toFixed(5);
    };

    let processedBreaks = [...breaks];
    if (processedBreaks.length > 1 && processedBreaks.length < numClasses + 1) {
      const lastVal = processedBreaks[processedBreaks.length - 1];
      const firstVal = processedBreaks[0];
      const step = (lastVal - firstVal) / numClasses;
      processedBreaks = [];
      for (let i = 0; i <= numClasses; i++) {
        processedBreaks.push(firstVal + i * step);
      }
    } else {
      while (processedBreaks.length < numClasses + 1) processedBreaks.push(processedBreaks[processedBreaks.length - 1]);
    }

    const labels = [];
    for (let i = 0; i < numClasses; i++) {
      if (i > 0 && processedBreaks[i] === processedBreaks[processedBreaks.length - 1]) break;
      labels.push(`${formatKm2(processedBreaks[i])}-${formatKm2(processedBreaks[i + 1])}`);
    }
    currentLegendLabels.value = labels;
}

// 预取所有年份的 Breaks 数据，消除播放时的 API 等待
async function preFetchAllBreaks() {
    if (spatialUnit.value === 'clcd' || spatialUnit.value === 'transfer') return;
    
    const attr = selectedAttribute.value;
    const unit = spatialUnit.value;
    const allYears = playerYears.value;
    
    // console.log('[Pre-fetch] Background loading breaks for all years...');
    
    // 并行请求所有年份断点
    const promises = allYears.map(year => {
        const cacheKey = `${year}_${unit}_${attr}`;
        if (breaksCache.has(cacheKey)) return Promise.resolve();
        
        const method = 'jenks';
        const numClasses = 10;
        const url = `/api/clcd/breaks?attr=${attr}&year=${year}&method=${method}&classes=${numClasses}&unit=${unit}`;
        
        return fetch(url, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}`, 'Content-Type': 'application/json' }
        }).then(res => res.json())
          .then(data => breaksCache.set(cacheKey, data))
          .catch(() => {});
    });
    
    await Promise.all(promises);
    // console.log('[Pre-fetch] Breaks data cached.');
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
  
  // 同时清理 CLCD 缓存
  clcdLayerCache.forEach((layer) => {
    try {
      if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.imageryLayers.remove(layer, true);
      }
    } catch (e) {}
  });
  clcdLayerCache.clear();

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
        // Skip base map, CLCD, and thematic layers
        if (layer === baseMapLayer.value || layer === clcdLayer.value || layer === transferWmsLayer || layer === rateWmsLayer || layer === blankBoundaryWmsLayer) continue;

        const provider = layer.imageryProvider;
        if (provider instanceof Cesium.WebMapServiceImageryProvider) {
             // Access internal 'layers' property if possible, or usually it's passed in constructor options
             // Cesium providers store options in `_layers` (private) or we can infer.
             // But actually, we can just remove EVERYTHING that isn't white-listed.
             
             // Safer check if possible:
             // If this layer is NOT in our new cache, and NOT clcd/base, nuke it.
             
             // For now, let's rely on the fact that if we called clearWMSCache, 
             // we expect NO spatial layers to remain.
             
             // console.log('[Workbench] Cleanup: Checking layer', i);
             // Verify if it's one of ours by checking if we still track it? No we cleared cache.
             
             // Assuming explicit removal is safer.
             // If we are unsure, we can try to identify if it is a "stats" layer.
             // But simple logic: If I called clearWMSCache, I want NO analysis layers.
             // Any layer that is NOT clcdLayer and NOT baseMapLayer is suspect.
             
             layers.remove(layer, true);
             // console.log('[Workbench] Force removed lingering layer at index', i);
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
  // console.log('[Workbench] Switching to Regional Analysis Mode');
  enterRegionalAnalysis();
}

onUnmounted(() => {
  // console.log('[Workbench] Component unmounting, starting cleanup...');
  
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
  
  if (viewer.value) {
    viewer.value.scene.postRender.removeEventListener(updatePopupPosition);
  }

  // console.log('[Workbench] Cleanup complete');
});

/**
 * 核心逻辑：实时计算提示框的屏幕位置与缩放比例
 * 实现“依比例符号”视觉效果，且锚定在地理坐标上
 */
function updatePopupPosition() {
    if (!selectedEntity.value || !lastPickPosition || !viewer.value) return;

    const scene = viewer.value.scene;
    const camera = viewer.value.camera;

    // 1. 地理坐标转屏幕坐标
    const canvasPosition = Cesium.SceneTransforms.worldToWindowCoordinates(scene, lastPickPosition);
    
    if (Cesium.defined(canvasPosition)) {
        // 2. 检查是否在视口内（处理背面隐藏）
        const occluder = new Cesium.EllipsoidalOccluder(scene.globe.ellipsoid, camera.position);
        const isVisible = occluder.isPointVisible(lastPickPosition);

        if (!isVisible) {
            popupStyle.value.display = 'none';
            return;
        }

        // 3. 计算缩放比例 (基于相机距离)
        // 设定一个基准距离 (比如 100km)，在该距离下比例为 1.0
        const distance = Cesium.Cartesian3.distance(camera.position, lastPickPosition);
        const refDist = 100000; // 100km
        
        // 缩放算法：使用对数或线性衰减，并限制最小/最大值
        // 兼顾“看不清”和“太大遮挡”
        let scale = Math.sqrt(refDist / distance);
        scale = Math.min(Math.max(scale, 0.4), 1.2); // 限制在 0.4x 到 1.2x 之间

        popupStyle.value = {
            left: Math.round(canvasPosition.x) + 'px',
            top: Math.round(canvasPosition.y - 20 * scale) + 'px',
            transform: `translate(-50%, -100%) scale(${scale.toFixed(3)})`,
            transformOrigin: 'bottom center',
            display: 'flex',
            opacity: 0.95
        };
    } else {
        popupStyle.value.display = 'none';
    }
}

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




.background-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 100;
  pointer-events: none;
  background-image: url('@/assets/images/backgrounds/workbench-bg.png');
  background-size: 106% 103%;
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
  z-index: 2100; /* 大幅提升层级，确保在所有层之上 */
  pointer-events: auto; /* 确保容器内是可点的 */
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
  top: 100px; /* Moved from bottom to top to avoid overlapping with the legend */
  right: 30px;
  z-index: 2000;
}

.dashboard-toggle-btn {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  border: 1px solid rgba(0, 245, 255, 0.4);
  background: rgba(4, 21, 51, 0.7);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 15px rgba(0, 245, 255, 0.2), inset 0 0 10px rgba(0, 245, 255, 0.1);
}

.dashboard-toggle-btn:hover {
  background: rgba(0, 245, 255, 0.2);
  border-color: #00f5ff;
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 0 20px rgba(0, 245, 255, 0.5), inset 0 0 15px rgba(0, 245, 255, 0.3);
}

.toggle-icon-img {
  width: 32px;
  height: 32px;
  opacity: 1;
  filter: drop-shadow(0 0 5px #00f5ff);
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



/* 统一图例浮动位置 */
.floating-legend {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}


/* 悬浮提示框 - Glassmorphism Pro Max */
.info-tooltip {
  position: fixed;
  background: rgba(13, 25, 48, 0.45);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  z-index: 2000;
  pointer-events: none;
  min-width: 220px;
  padding: 16px;
  /* transform 与 left/top 现在由 JS 驱动实现由地理锚定的依比例缩放 */
  will-change: transform, left, top;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #ffffff;
}

.tooltip-title {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
  text-align: left;
  letter-spacing: 1px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
  padding: 2px 0;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.65);
  font-size: 15px;
  font-weight: 500;
}

.tooltip-value {
  color: #60a5fa;
  font-weight: 700;
  font-size: 20px;
  text-align: right;
  font-family: 'Dosis', 'Orbitron', 'Consolas', sans-serif;
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3));
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
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
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

.global-analysis-legend {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  transition: all 0.3s ease;
}

/* 工具栏左向锚定过渡动画 (从右向左抽拉) */
.expand-fade-left-enter-active,
.expand-fade-left-leave-active {
  transition: all 0.45s cubic-bezier(0.23, 1, 0.32, 1);
  overflow: hidden;
  white-space: nowrap;
  transform-origin: right center; /* 锚定右侧图层选择器 */
}

.expand-fade-left-enter-from,
.expand-fade-left-leave-to {
  max-width: 0;
  opacity: 0;
  margin-right: -8px; /* 抵消 gap，确保右侧按钮静止 */
  transform: scaleX(0.8) translateX(15px);
}

.expand-fade-left-enter-to,
.expand-fade-left-leave-from {
  max-width: 200px;
  opacity: 1;
  margin-right: 0;
  transform: scaleX(1) translateX(0);
}

/* 全面分析按钮样式 */
.analysis-mode-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 16px;
  background: rgba(13, 25, 48, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #a5ccff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
  white-space: nowrap;
}

.analysis-mode-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.analysis-mode-btn.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.4) 0%, rgba(37, 99, 235, 0.6) 100%);
  border-color: #3b82f6;
  color: #ffffff;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.3);
}

.analysis-mode-btn .btn-icon {
  width: 20px;
  height: 20px;
  opacity: 0.9;
  filter: drop-shadow(0 0 4px rgba(0, 245, 255, 0.4));
}
.analysis-wing {
  position: fixed;
  top: 90px; 
  bottom: auto;
  width: 500px; /* 进一步扩宽至 500px，确保内部 480px 组件及阴影完全不受限 */
  z-index: 2000;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: visible; /* 强制父容器不截断子项阴影 */
}

.analysis-wing.left {
  left: 80px;
}

.analysis-wing.right {
  right: 80px;
}

.close-analysis-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(13, 40, 90, 0.6);
  border: 1px solid rgba(0, 245, 255, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  cursor: pointer;
  transition: all 0.3s;
  z-index: 2001;
}

.close-analysis-btn:hover {
  background: rgba(0, 245, 255, 0.2);
  border-color: #00f5ff;
  color: #00f5ff;
}

/* Wing Fade Transitions */
.wing-fade-left-enter-active,
.wing-fade-left-leave-active,
.wing-fade-right-enter-active,
.wing-fade-right-leave-active {
  /* 只执行 transform 的过渡，不执行 opacity。因为父元素的 opacity 过渡会导致所有的子元素的 backdrop-filter 毛玻璃特效在过渡期间直接失效并黑屏/无效果 (Chromium 内核的一个老问题)。 */
  transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
}

.wing-fade-left-enter-from,
.wing-fade-left-leave-to {
  /* 直接将其平移出屏幕外，从而避免使用 opacity */
  transform: translateX(calc(-100% - 80px));
}

.wing-fade-right-enter-from,
.wing-fade-right-leave-to {
  /* 直接将其平移出屏幕外，从而避免使用 opacity */
  transform: translateX(calc(100% + 20px));
}
</style>
