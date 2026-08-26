<!-- Workbench: 主工作台视图，承载核心的三维地球展示及各种空间分析控制面板 -->
<!--
  @component Workbench
  @description 主工作台视图，承载核心的三维地球展示及各种空间分析控制面板
  @props 无直接传入的 props，主要依赖路由参数或全局状态
  @emits 视图级组件，主要进行事件监听和向下传递
  @dependencies globalStore, authStore, vue-router 以及各类子组件
-->
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
    <transition name="region-switch-tip-fade">
      <div v-if="autoSwitchTipVisible" class="region-switch-tip">
        已退出专题并切换到 CLCD，可继续行政区划选择
      </div>
    </transition>

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
      v-if="spatialUnit === 'clcd' && !globalStore.legendData" 
      class="map-floating-legend"
      title="土地利用分类 (CLCD)"
      :items="clcdLegendItems"
      side="right"
      y-anchor="bottom"
      :right="28"
      :bottom="52"
      :width="560"
    />

    <AnalysisLegend 
      v-if="spatialUnit !== 'clcd' && !globalStore.legendData" 
      class="map-floating-legend"
      :title="selectedYear + ' - ' + currentAttributeLabel + ' (km2)'"
      :items="areaLegendItems"
      side="right"
      y-anchor="bottom"
      :right="28"
      :bottom="52"
      :width="560"
    />

    <AnalysisLegend 
      v-if="globalStore.legendData" 
      class="map-floating-legend"
      side="right"
      y-anchor="bottom"
      :right="28"
      :bottom="52"
      :width="560"
    />




    <transition name="wing-fade-left">
      <div v-if="showAnalysisPanels" class="analysis-wing left">
        <TransferLeftPanel v-if="globalStore.activeTheme === 'transfer'" v-model:year="selectedYear" />
        <RateLeftPanel v-else-if="globalStore.activeTheme === 'rate'" v-model:year="selectedYear" />
        <SpatialStatsLeftPanel v-else-if="globalStore.activeTheme === 'spatial_stats'" v-model:year="selectedYear" />
        <DashboardLeftPanel v-else v-model:year="selectedYear" />
      </div>
    </transition>

    <transition name="wing-fade-right">
      <div v-if="showAnalysisPanels" class="analysis-wing right">
        <TransferRightPanel v-if="globalStore.activeTheme === 'transfer'" v-model:year="selectedYear" />
        <RateRightPanel v-else-if="globalStore.activeTheme === 'rate'" v-model:year="selectedYear" />
        <SpatialStatsRightPanel v-else-if="globalStore.activeTheme === 'spatial_stats'" v-model:year="selectedYear" />
        <DashboardRightPanel v-else v-model:year="selectedYear" />
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

/**
 * @logic 集成 Cesium 3D 地图引擎，协调 CLCD 土地利用数据加载、空间单元切换（县级/格网）及多维分析面板联动。
 */
<script setup>
// --- 核心业务逻辑状态与依赖注入 ---
import { onMounted, onUnmounted, ref, shallowRef, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import DropdownSelector from '../components/cards/DropdownSelector.vue';
import DashboardLeftPanel from '../components/dashboards/DashboardLeftPanel.vue';
import DashboardRightPanel from '../components/dashboards/DashboardRightPanel.vue';
import RegionSelector from '../components/ui/RegionSelector.vue';
import BottomNav from '../components/ui/BottomNav.vue';
import AnalysisLegend from '../components/ui/AnalysisLegend.vue';

import { useMapStore } from '../stores/map.ts';
import { useGlobalStore } from '../stores/index.ts'; 
import { clcdApi, authApi, analysisApi } from '../api/index.js';
import { addExclusiveAnalysisLayer, clearAllAnalysisLayers, applyThickPolygonOutline, applyThickPolygonOutlineForEntity } from '../utils/cesiumUtils.js';
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
const selectedYear = computed({
  get: () => globalStore.currentYear,
  set: (val) => globalStore.setYear(val)
});
const currentYearData = ref({});
const showAnalysisPanels = ref(true);
const isDashboardMode = showAnalysisPanels; // Keep for compatibility if needed elsewhere

// 专题面板：按 activeTheme 切换展示（CLCD 为默认）
// 说明：专题面板与 CLCD 风险面板拆分，避免在单个组件里堆大量 v-if 逻辑。
import TransferLeftPanel from '../components/dashboards/TransferLeftPanel.vue';
import TransferRightPanel from '../components/dashboards/TransferRightPanel.vue';
import RateLeftPanel from '../components/dashboards/RateLeftPanel.vue';
import RateRightPanel from '../components/dashboards/RateRightPanel.vue';
import SpatialStatsLeftPanel from '../components/dashboards/SpatialStatsLeftPanel.vue';
import SpatialStatsRightPanel from '../components/dashboards/SpatialStatsRightPanel.vue';

// State for Regional Analysis Mode
const isRegionalAnalysisMode = ref(false); // Can be removed or ignored
const isLoading = ref(false); 
const currentStatsField = ref(''); 
const spatialUnit = computed({
  get: () => globalStore.activeLayer,
  set: (val) => globalStore.setActiveLayer(val)
});
const selectedAttribute = ref('cropland');
const autoSwitchTipVisible = ref(false);
let autoSwitchTipTimer = null;
const wmsLayerCache = new Map(); // Map<cacheKey, Cesium.ImageryLayer>
const clcdLayerCache = new Map(); // 用于 Standard (CLCD) 模式的平滑切换缓存
const breaksCache = new Map(); // 缓存 API 返回的分级断点，消除请求延迟
const activeWmsKey = ref(null); // 记录当前意图加载的活跃图层键名，用于防止竞态冲突
const lastRequestId = ref(0);   // 用于追踪最新的加载请求，过时的请求将被丢弃
let scopeRequestId = 0;         // 新增：追踪行政区划切换请求，防止异步时序导致的图层残留
const currentClipWKT = ref(null); // 当前用于裁剪的 WKT 字符串

// 专题分析最近一次查询参数缓存（用于行政区划切换后自动重查）
const lastTransferParams = ref(null);
const lastRateParams = ref(null);
const lastSpatialStatsParams = ref(null);
const YUNNAN_VIEW_RECT = {
  west: 97.5,
  south: 21.1,
  east: 106.2,
  north: 29.3
};
const YUNNAN_RESET_CAMERA = {
  lon: 101.8,
  lat: 25.2,
  height: 1900000
};
const SPATIAL_STATS_LINE_HEIGHT = 260;

function getYunnanRectangle() {
  return Cesium.Rectangle.fromDegrees(
    YUNNAN_VIEW_RECT.west,
    YUNNAN_VIEW_RECT.south,
    YUNNAN_VIEW_RECT.east,
    YUNNAN_VIEW_RECT.north
  );
}

function getYunnanCameraOptions() {
  return {
    destination: Cesium.Cartesian3.fromDegrees(
      YUNNAN_RESET_CAMERA.lon,
      YUNNAN_RESET_CAMERA.lat,
      YUNNAN_RESET_CAMERA.height
    ),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0
    }
  };
}

function setYunnanFullView() {
  if (!viewer.value || viewer.value.isDestroyed()) return;
  viewer.value.camera.setView(getYunnanCameraOptions());
}

function flyToYunnanFullView(duration = 1.5) {
  if (!viewer.value || viewer.value.isDestroyed()) return;
  viewer.value.camera.flyTo({
    ...getYunnanCameraOptions(),
    duration
  });
}

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
const highlightedEntity = shallowRef(null);
const transferDataSource = shallowRef(null);


// Bottom Nav Ref
const bottomNavRef = ref(null);

// 全局回车防护：防止非输入框的回车触发意外行为（如浏览器模拟点击按钮）
function handleGlobalEnter(e) {
  if (e.key === 'Enter') {
    const tagName = e.target.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea' || e.target.isContentEditable;
    
    // [Harden] 无论是死否为输入框，都要阻止事件继续冒泡到 window 以外的潜在监听器（如 Portal.vue 的残留）
    // 仅在非输入框时 preventDefault，阻止浏览器默认的回车逻辑，后续 keyup 仍然会执行
    if (!isInput) {
        e.preventDefault();
    }
    
    // 强制阻止冒泡，切断该事件向上传递的路径
    e.stopPropagation();
    
    if (!isInput) {
        console.warn('[Workbench] Blocked illegal Enter key on:', tagName);
    }
  }
}

// ======================== 行政区划联动逻辑 ========================
const regionBoundarySource = shallowRef(null);
const cachedGeoJSON = {
  province: null,
  cities: null,
  all: null,
  pinyinMap: null
};

function showAutoSwitchTip() {
  if (autoSwitchTipTimer) {
    window.clearTimeout(autoSwitchTipTimer);
    autoSwitchTipTimer = null;
  }
  autoSwitchTipVisible.value = true;
  autoSwitchTipTimer = window.setTimeout(() => {
    autoSwitchTipVisible.value = false;
    autoSwitchTipTimer = null;
  }, 1500);
}

// 辅助：GeoJSON 转 WKT (支持 Polygon 和 MultiPolygon 并合并)
// 增加坐标精度控制和简单抽稀，防止 URL 过长导致 HTTP 431
function geojsonToWKT(features) {
    if (!features || features.length === 0) return null;
    
    // 1. 统计总点数以确定全局采样步长，防止 WKT 过长导致 WMS 请求 414
    let totalPoints = 0;
    features.forEach(f => {
        const geom = f.geometry;
        if (geom.type === 'Polygon') {
            geom.coordinates.forEach(ring => totalPoints += ring.length);
        } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach(poly => poly.forEach(ring => totalPoints += ring.length));
        }
    });

    // 目标总点数控制在 150 以内，单点约 20 字节，总长度约 3KB，确保安全
    const step = Math.max(1, Math.ceil(totalPoints / 150));
    // console.log(`[WKT] Sampling step: ${step} (Total: ${totalPoints})`);

    const allPolygons = [];
    features.forEach(f => {
        const geom = f.geometry;
        if (geom.type === 'Polygon') {
            allPolygons.push(geom.coordinates);
        } else if (geom.type === 'MultiPolygon') {
            allPolygons.push(...geom.coordinates);
        }
    });

    if (allPolygons.length === 0) return null;

    // 2. 构建 MULTIPOLYGON WKT，限制精度为 5 位小数并应用步长采样
    const parts = allPolygons.map(poly => {
        const rings = poly.map(ring => {
            let sampledPoints = ring.filter((_, index) => index % step === 0);
            
            // 关键：WMS 裁剪要求 WKT 环必须闭合
            const last = ring[ring.length - 1];
            const sampledLast = sampledPoints[sampledPoints.length - 1];
            if (sampledLast[0] !== last[0] || sampledLast[1] !== last[1]) {
                sampledPoints.push(last);
            }
            
            const coordsStr = sampledPoints.map(c => 
                `${parseFloat(c[0].toFixed(5))} ${parseFloat(c[1].toFixed(5))}`
            ).join(', ');
            return `(${coordsStr})`;
        }).join(', ');
        return `(${rings})`;
    }).join(', ');

    const wkt = `MULTIPOLYGON(${parts})`;
    // console.log('[Workbench] Generated WKT Length:', wkt.length);
    return wkt;
}

// 监听区域范围变化或 Viewer 初始化，确保边界数据同步
watch([() => globalStore.scope, () => mapStore.viewer], async ([newScope, newViewer], [oldScope, oldViewer]) => {
  if (!newViewer || !newScope) return;

  // 行政区划选择优先：当处于专题模式且用户选择了非省级区域时，
  // 自动退出专题并切回 CLCD，再继续执行区域切换，避免“必须先手动重置”的问题。
  if (globalStore.activeTheme && newScope.level !== 'province') {
    cleanupThemeLayers('all');
    clearSpatialStatsEntities();
    transferWmsLayer = null;
    rateWmsLayer = null;
    lastTransferParams.value = null;
    lastRateParams.value = null;
    lastSpatialStatsParams.value = null;
    globalStore.setActiveTheme(null);
    globalStore.clearThemeContext('all');
    globalStore.clearLegend();
    globalStore.setActivePanel(null);
    globalStore.setActiveLayer('clcd');
    selectedAttribute.value = 'cropland';
    showAutoSwitchTip();
  }

  const viewer = newViewer;

  const currentRid = ++scopeRequestId;

  // 1. 清理旧边界
  if (regionBoundarySource.value) {
    viewer.dataSources.remove(regionBoundarySource.value);
    regionBoundarySource.value = null;
  }

  try {
    let features = [];
    const targetName = newScope.name;
    const clean = (s) => (s || '').replace(/(省|市|州|区|县|镇)$/, '');
    const targetClean = clean(targetName);

    // A. 维护当前拼音列表 (用于图层动态加载)
    let pinyins = [];
    if (!cachedGeoJSON.pinyinMap) {
        const resp = await fetch('/data/region_pinyin_map.json');
        if (currentRid !== scopeRequestId) return;
        cachedGeoJSON.pinyinMap = await resp.json();
    }

    // 2. 根据级别加载并过滤 GeoJSON
    if (newScope.level === 'province') {
        // 省级：重新加载全省边界
        currentClipWKT.value = null;
        if (!cachedGeoJSON.province) {
            const resp = await fetch('/data/yunnan_boundary.geo.json');
            if (currentRid !== scopeRequestId) return;
            cachedGeoJSON.province = await resp.json();
        }
        features = cachedGeoJSON.province.features;
        pinyins = []; // 为空则 loadStandardLayer 会加载全省
    } else if (newScope.level === 'prefecture') {
        // 地级市：使用专用地市边界文件以消除内部县级线
        if (!cachedGeoJSON.cities) {
            const resp = await fetch('/data/yunnan_cities_boundary.geo.json');
            if (currentRid !== scopeRequestId) return;
            cachedGeoJSON.cities = await resp.json();
        }

        // 匹配 name ?fullname (优先精确匹配，其次去后缀匹配)
        features = cachedGeoJSON.cities.features.filter(f => {
            const p = f.properties;
            const name = p.name || p.fullname || '';
            return name === targetName || (name && clean(name) === targetClean);
        });
        currentClipWKT.value = geojsonToWKT(features);

        // 获取该市下属所有县的拼音
        if (!cachedGeoJSON.all) {
            const resp = await fetch('/data/yunnan_all_counties.geojson');
            if (currentRid !== scopeRequestId) return;
            cachedGeoJSON.all = await resp.json();
        }
        const childCounties = cachedGeoJSON.all.features.filter(f => {
            const parentName = f.properties.parent?.name || '';
            return parentName === targetName || (parentName && clean(parentName) === targetClean);
        });
        pinyins = childCounties.map(c => cachedGeoJSON.pinyinMap[c.properties.name]).filter(Boolean);
    } else if (newScope.level === 'county') {
        // 县级：加载包含所有区县的数据集
        if (!cachedGeoJSON.all) {
            const resp = await fetch('/data/yunnan_all_counties.geojson');
            if (currentRid !== scopeRequestId) return;
            cachedGeoJSON.all = await resp.json();
        }
        features = cachedGeoJSON.all.features.filter(f => {
            const p = f.properties;
            const name = p.name || p.NAME || p.fullname || p.COUNTY || '';
            return name === targetName || (name && clean(name) === targetClean);
        });
        currentClipWKT.value = geojsonToWKT(features);
        
        // 单个县的拼音
        const py = cachedGeoJSON.pinyinMap[targetName];
        if (py) pinyins = [py];
    }

    // 基础县域底图：普通模式不显示文字；专题白底模式再统一开启，避免重复叠字。
    updateCountyBackdrop(false, false);

    // 最终防御：如果此时已经有新的请求，则彻底放弃当前请求的结果，防止旧图层在清理后残留
    if (currentRid !== scopeRequestId) return;

    // 更新全局拼音状态，供 loadStandardLayer 使用
    globalStore.setCurrentPinyins(pinyins);

    if (features.length === 0) return;

    // 3. 渲染边界高亮 (移除多边形的 clampToGround 贴地计算，极大提升加载度，仅由下游线为加粗边线执贴地)
    const highlightGeoJSON = { type: "FeatureCollection", features: features };
    const ds = await Cesium.GeoJsonDataSource.load(highlightGeoJSON);
    
    // 再请求 ID
    if (currentRid !== scopeRequestId) return;

    // 根据级别选择颜色
    let boundaryColor = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.highlightColor); // 默认高亮
    if (newScope.level === 'province') {
        boundaryColor = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.provinceColor);
    } else if (newScope.level === 'prefecture') {
        boundaryColor = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.cityColor);
    } else if (newScope.level === 'county') {
        boundaryColor = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.countyColor);
    }

    const entities = ds.entities.values;
    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.polygon) {
            entity.polygon.fill = false;
            const boundaryWidth = newScope.level === 'province'
              ? UI_CONFIG.BOUNDARY_STYLE.provinceWidth
              : UI_CONFIG.BOUNDARY_STYLE.highlightWidth;
            applyThickPolygonOutlineForEntity(entity, boundaryColor, boundaryWidth, Cesium);
        }
    }
    
    viewer.dataSources.add(ds);
    regionBoundarySource.value = ds;

    // 4. 视角调整：通过计算带边距的包围盒，确保区域完全显示在面板之间的安全区域
    const shouldFly = newScope.level !== 'province' || (oldScope && oldScope.level !== 'province');
    if (shouldFly && features.length > 0) {
        // 计算要素的接外矩形
        let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
        features.forEach(f => {
            const processRing = (ring) => {
                ring.forEach(coord => {
                    if (coord[0] < minLon) minLon = coord[0];
                    if (coord[0] > maxLon) maxLon = coord[0];
                    if (coord[1] < minLat) minLat = coord[1];
                    if (coord[1] > maxLat) maxLat = coord[1];
                });
            };
            const geom = f.geometry;
            if (geom.type === 'Polygon') {
                geom.coordinates.forEach(processRing);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach(poly => poly.forEach(processRing));
            }
        });

        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;
        const width = maxLon - minLon;
        const height = maxLat - minLat;
        
        // 缩放系数微调：宽度由 0.9，高度由 0.6，减少余留边距
        const paddedRect = Cesium.Rectangle.fromDegrees(
            centerLon - (width * 0.9),
            centerLat - (height * 0.6),
            centerLon + (width * 0.9),
            centerLat + (height * 0.6)
        );

        viewer.camera.flyTo({
          destination: paddedRect,
          duration: 1.5,
          orientation: {
            pitch: Cesium.Math.toRadians(-90),
            roll: 0
          }
        });
    }

    // 5. 彻底清理有旧的业务图层（影像图层），防全省图层残留
    clearAllAnalysisLayers(viewer);
    
    // 6. 同步清理缓存状态
    clcdLayerCache.clear();
    wmsLayerCache.clear();
    clcdLayer.value = null;
    spatialLayer.value = null;
    
    // 根据当前活跃专题重载对应图层（区域切换后需要刷新）
    const theme = globalStore.activeTheme;
    const curUnit = spatialUnit.value;

    if (theme === 'transfer' && lastTransferParams.value) {
      handleTransferQuery(lastTransferParams.value);
    } else if (theme === 'rate' && lastRateParams.value) {
      handleRateQuery(lastRateParams.value);
    } else if (theme === 'spatial_stats' && lastSpatialStatsParams.value) {
      handleSpatialStatsQuery(lastSpatialStatsParams.value);
    } else if (curUnit === 'clcd') {
      loadStandardLayer(selectedYear.value, true, currentRid);
    } else if (curUnit === 'county' || curUnit === 'grid') {
      refreshMapLayer(true);
    }
  } catch (e) {
    console.error('[Workbench] Region navigation failed:', e);
  }
}, { deep: true, immediate: true });

watch(() => globalStore.activeTheme, (newTheme, oldTheme) => {
  // 主题被清空时，兜底清理专题残留与 loading，避免出现“正在计算/处理”卡住。
  if (!newTheme && oldTheme) {
    cleanupThemeLayers(oldTheme);
    isLoading.value = false;
    if (bottomNavRef.value?.transferControl?.setLoading) bottomNavRef.value.transferControl.setLoading(false);
    if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(false);
    setSpatialStatsLoading(false);
  }
}, { flush: 'post' });


// ================================================================
const isPreloading = ref(false);
const PRELOAD_RANGE = 3; // 提升预加载深度，提前拉取前后 3 年的瓦片与断点数据
const BUFFER_DELAY = 800; // 全局缓冲延迟 (ms)

// Hover Tooltip State
const selectedEntity = ref(null);
const popupStyle = ref({ left: '0px', top: '0px' });
let clickHandler = null;
let hoverDebounceTimer = null;
let lastPickPosition = null;
let isPopupPostRenderBound = false;
let countyLabelMoveEndHandler = null;

const handleClearCountyHighlight = () => {
  selectedEntity.value = null;
  lastPickPosition = null;
  popupStyle.value.display = 'none';
  syncPopupPostRenderListener();
  clearHighlight();
};

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
  if (selectedAttribute.value === 'transfer') return '土地流转';
  if (selectedAttribute.value === 'reclamation') return '垦殖率';
  if (selectedAttribute.value === 'conversion') return '转换率';
  const attr = attributes.value.find(a => a.value === selectedAttribute.value);
  return attr ? attr.label : selectedAttribute.value;
});

const allAttributes = [
  { label: '耕地', value: 'cropland' },
  { label: '林地', value: 'forest' },
  { label: '建设用地', value: 'impervious' },
  { label: '灌木', value: 'shrub' },
  { label: '草地', value: 'grassland' },
  { label: '水域', value: 'water' },
  { label: '冰雪', value: 'snow_ice' },
  { label: '裸地', value: 'barren' },
  { label: '湿地', value: 'wetland' }
];

const attributes = computed(() => {
  if (spatialUnit.value === 'grid') {
    return allAttributes.filter(attr => attr.value !== 'shrub');
  }
  return allAttributes;
});

// 变化分析模式状?
const isChangeMode = ref(false);
const changeYearFrom = ref(1985);
const changeYearTo = ref(2023);

// 响应变化模式参数变化已集成到下方的统一 watch

// 时间轴选年范围 - 强制使用处理后的可用年份
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

// CLCD 专用图例?
const clcdLegendItems = computed(() => {
  return Object.keys(clcdColors).map(name => ({
    color: clcdColors[name],
    label: legendNames[name]
  }));
});



// 统一地图刷新逻辑 (核心入口)
async function refreshMapLayer(forceClearCache = false) {
  const requestId = ++lastRequestId.value;
  const currentId = requestId; // 锁定当前 ID
  const year = selectedYear.value;
  const unit = spatialUnit.value;
  const attr = selectedAttribute.value;
  
  // 流转模式由 handleTransferQuery 独立管理图层生命周期，此处不干预
  if (unit === 'land_transfer') return;
  // 专题分析模式由各自的 handler 独立管理图层生命周期与 loading 状态
  if (globalStore.activeTheme === 'rate' || globalStore.activeTheme === 'transfer' || globalStore.activeTheme === 'spatial_stats') {
    return;
  }

  if (forceClearCache) {
    clearWMSCache();
    breaksCache.clear();
  }

  // 1. 同步加载侧边栏数据
  loadYearData(year);

  // 2. 根据模式执特定加载逻辑
  if (unit === 'clcd') {
    loadStandardLayer(year, true, scopeRequestId);
  } else {
    // 处理 Shrub 兼容性 (格网无灌木)
    if (unit === 'grid' && attr === 'shrub') {
      selectedAttribute.value = 'grassland';
      return; // 会触发下一次 watch，交给下一周期处理
    }

    // 3. 执行核心图层加载 (非流转非率分析模式)
    const thematicModes = ['transfer', 'reclamation', 'conversion'];
    if (!thematicModes.includes(attr)) {
      // 执行平滑过渡
      await switchToYearWithTransition(year);
      
      // 预加载附近年份 (仅针对 WMS)
      preloadNearbyYears(year);
    }
  }
}

// 响应各个参数的变化，统一驱动地图刷新 (Global Watcher)
// 注意: currentClipWKT 不在此监听，已由 scope watcher 独立处理
watch(
  [selectedYear, spatialUnit, selectedAttribute, isChangeMode, changeYearFrom, changeYearTo], 
  ([newYear, newUnit, newAttr, newIsChange, newYFrom, newYTo], [oldYear, oldUnit, oldAttr, oldIsChange, oldYFrom, oldYTo]) => {
    if (!viewer.value) return;

    // 如果切换了空间分辨率/属性或进入/提出变化模式，清理 WMS 状态
    const needsCleanup = newUnit !== oldUnit || newAttr !== oldAttr || newIsChange !== oldIsChange;
    
    refreshMapLayer(needsCleanup);
  }, 
  { deep: false }
);

watch(
  [spatialUnit, () => globalStore.activeTheme, selectedAttribute, yunnanDataSource],
  () => {
    // 非“空白行政边界”模式下，县级/格网默认显示县域边界
    syncCountyBoundaryOverlay();
  },
  { deep: false, flush: 'post' }
);

// 年份变化处理入口 (保留?UI 事件)
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
  
  // 收集要加载的年份（前后各PRELOAD_RANGE年）
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
  
  // 异步预加载（静默模式，不切换显示）
  const preloadPromises = yearsToPreload.map(async (year) => {
    if (spatialUnit.value === 'clcd') {
      return loadStandardLayer(year, false, scopeRequestId); 
    }
    // 关键：加载 WMS 的同时，提前拉取 breaks 统计数据并存入缓存
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

// 清理距当前年份过远的缓存
function cleanupDistantCache(centerYear) {
  const allYears = playerYears.value;
  const centerIndex = allYears.indexOf(centerYear);
  const maxDistance = PRELOAD_RANGE + 2; // 保留稍微多一点的缓存
  
  const keysToRemove = [];
  
  wmsLayerCache.forEach((layer, key) => {
    // 解析缓存 key 获取年份
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

// 响应区域分析参数变化已集成到上方的统一 watch
// 垦殖率/转换率 WMS 渲染
// 率分析
const reclamationColors = LEGEND_CONFIGS.reclamation.colors;
const conversionColors  = LEGEND_CONFIGS.conversion.colors;
let rateWmsLayer = null;
let currentRateColors = []; // 用于共享给图例更?

async function handleRateQuery(params) {
  // [Decoupling] 专题层强制全省视角：如果当前不是省级，则重置为省级并退出（由重置引发的 watcher 再进入）
  if (globalStore.scope.level !== 'province') {
    // Cache params first so the scope watcher can automatically re-run after scope resets.
    lastRateParams.value = params;
    globalStore.setActiveTheme('rate');
    globalStore.setScope('province', '530000', '云南省');
    return;
  }

  // console.log('[Rate] Query params:', params);
  // 自动清理前一专题图层
  lastRateParams.value = params; // 缓存参数供区域切换后自动重查
  cleanupThemeLayers(globalStore.activeTheme);
  globalStore.setActiveTheme('rate');

  // [Critical Fix] 同步设置 attribute 与空间单元，避免全局 watcher 刷新常规 WMS 图层
  // 干扰专题图层（垦殖率/转换率）显示。
  if (params?.attribute === 'reclamation' || params?.attribute === 'conversion') {
    selectedAttribute.value = params.attribute;
  }
  globalStore.setActiveLayer('county');
  // 率专题会与县域矢量边界叠加产生“亮青色误操作线”，这里强制同步一次边界叠加状态。
  syncCountyBoundaryOverlay();

  isLoading.value = true;
  if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(true);

  try {
    const token = localStorage.getItem('auth_token');
    const { year, year_start, year_end, from_class, to_class, attribute, unit, legendTitle } = params;

    // 1. 获取分级断点（按模式动态拼参，避免 year=undefined 触发后端校验失败）
    const query = new URLSearchParams({
      mode: 'rate',
      attr: String(attribute || ''),
      unit: String(unit || 'county'),
      classes: '10',
      method: 'jenks'
    });
    if (attribute === 'reclamation') {
      query.set('year', String(year));
    } else if (attribute === 'conversion') {
      query.set('year_start', String(year_start));
      query.set('year_end', String(year_end));
      if (from_class !== '' && from_class !== null && from_class !== undefined) {
        query.set('from_class', String(from_class));
      }
      if (to_class !== '' && to_class !== null && to_class !== undefined) {
        query.set('to_class', String(to_class));
      }
    }
    const breaksUrl = `/api/clcd/breaks?${query.toString()}`;

    const bResp = await fetch(breaksUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!bResp.ok) {
      const errData = await bResp.json().catch(() => ({}));
      throw new Error(errData.error || `Breaks API error: ${bResp.status}`);
    }
    const breaksData = await bResp.json();
    // console.log('[Rate] Breaks data:', breaksData);

    if (!breaksData.breaks || breaksData.breaks.length === 0) {
      throw new Error('该参数下无有效计算数据，请检查年份或流转方向');
    }

    // 1. 记录专题上下文：用于左右面板“专题监测”适配
    globalStore.setThemeContext('rate', {
      params,
      stats: breaksData.stats || {},
      breaks: breaksData.breaks || [],
      field: breaksData.field,
      histogram: breaksData.histogram || [],
      unit_label: breaksData.unit_label || '%',
      top_units: breaksData.top_units || []
    });

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
      tileWidth: 512,
      tileHeight: 512,
      enablePickFeatures: true,
      parameters: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        transparent: 'true',
        format: 'image/png',
        interpolations: 'nearest neighbor',
        // GeoServer WMS does not reliably resolve namespaced styles via STYLES=ws:style.
        // Use plain style name and rely on the virtual service (/geoserver/WebGIS/wms) workspace context.
        styles: activeStyle,
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
    if (bottomNavRef.value?.rateControl?.setError) {
      bottomNavRef.value.rateControl.setError(err.message || '查询失败，请检查服务器连接');
    }
  } finally {
    isLoading.value = false;
    if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(false);
  }
}

// ===== 时空演变与标准差椭圆渲染 =====
let blankBoundaryWmsLayer = null;
const sdeColors = SDE_COLORS;
const spatialStatsVisibility = ref({ trajectory: true, sde: true });
const countyBackdropState = ref({ show: false, labels: false });

const spatialStatsDataSource = ref(null);

function handleSpatialStatsVisibility(visibility) {
  spatialStatsVisibility.value = {
    trajectory: visibility?.trajectory !== false,
    sde: visibility?.sde !== false
  };
  if (!viewer.value || viewer.value.isDestroyed()) return;

  const entities = viewer.value.entities.values.filter(ent => ent._isSpatialStats);
  const allowCenter = spatialStatsVisibility.value.sde;
  entities.forEach(ent => {
    const type = ent._spatialType || '';
    if (type === 'trajectory') {
      ent.show = spatialStatsVisibility.value.trajectory;
    } else if (type === 'sde') {
      ent.show = spatialStatsVisibility.value.sde;
    } else if (type === 'center') {
      // 高性能模式：仅在椭圆开启时显示重心点，减少实体绘制压力。
      ent.show = allowCenter;
    }
  });
  if (viewer.value) {
    viewer.value.scene.canvas.style.cursor = 'default';
  }
  requestSceneRender();
}

function clearSpatialStatsEntities() {
  if (!viewer.value || viewer.value.isDestroyed()) return;
  const toRemove = viewer.value.entities.values.filter((e) => e?._isSpatialStats === true);
  toRemove.forEach((e) => viewer.value.entities.remove(e));
  requestSceneRender();
}

function setSpatialStatsLoading(loading) {
  const target = bottomNavRef.value?.spatialStatsControl
    || bottomNavRef.value?.trajectoryControl
    || bottomNavRef.value?.sdeControl;
  if (target?.setLoading) {
    target.setLoading(loading);
  }
}

function requestSceneRender() {
  try {
    if (viewer.value?.scene?.requestRender) {
      viewer.value.scene.requestRender();
    }
  } catch (_e) {}
}

function getEntityPropText(entity, keys = []) {
  const props = entity?.properties;
  for (const key of keys) {
    const raw = props?.[key];
    let value = raw;
    if (raw && typeof raw.getValue === 'function') {
      try {
        value = raw.getValue(Cesium.JulianDate.now());
      } catch (_e) {
        value = null;
      }
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  if (typeof entity?.name === 'string' && entity.name.trim()) {
    return entity.name.trim();
  }
  return '';
}

function getEntityPolygonAnchor(entity) {
  if (!entity?.polygon?.hierarchy) return null;
  let hierarchy = null;
  try {
    hierarchy = typeof entity.polygon.hierarchy.getValue === 'function'
      ? entity.polygon.hierarchy.getValue(Cesium.JulianDate.now())
      : entity.polygon.hierarchy;
  } catch (_e) {
    hierarchy = null;
  }
  const positions = Array.isArray(hierarchy?.positions) ? hierarchy.positions : [];
  if (positions.length < 3) return null;

  const sphere = Cesium.BoundingSphere.fromPoints(positions);
  if (!sphere?.center) return null;
  const cartographic = Cesium.Cartographic.fromCartesian(sphere.center);
  if (!cartographic) return null;

  const lon = Cesium.Math.toDegrees(cartographic.longitude);
  const lat = Cesium.Math.toDegrees(cartographic.latitude);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return Cesium.Cartesian3.fromDegrees(lon, lat, 0);
}

function getEntityPolygonRingLonLat(entity) {
  if (!entity?.polygon?.hierarchy) return [];
  let hierarchy = null;
  try {
    hierarchy = typeof entity.polygon.hierarchy.getValue === 'function'
      ? entity.polygon.hierarchy.getValue(Cesium.JulianDate.now())
      : entity.polygon.hierarchy;
  } catch (_e) {
    hierarchy = null;
  }
  const positions = Array.isArray(hierarchy?.positions) ? hierarchy.positions : [];
  if (positions.length < 3) return [];
  const ring = positions
    .map((p) => {
      const c = Cesium.Cartographic.fromCartesian(p);
      if (!c) return null;
      const lon = Cesium.Math.toDegrees(c.longitude);
      const lat = Cesium.Math.toDegrees(c.latitude);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      return [lon, lat];
    })
    .filter(Boolean);
  return ensureClosedRing(ring);
}

function applyCountyLabelLayout() {
  if (!viewer.value || viewer.value.isDestroyed() || !yunnanDataSource.value) return;

  const showLabels = countyBackdropState.value.show && countyBackdropState.value.labels;
  const entities = yunnanDataSource.value.entities.values || [];
  if (!showLabels) {
    entities.forEach((entity) => {
      if (entity?.label) entity.label.show = false;
    });
    return;
  }

  const scene = viewer.value.scene;
  const canvas = scene?.canvas;
  if (!scene || !canvas) return;

  const camHeight = Number(viewer.value.camera?.positionCartographic?.height || 0);
  const maxLabels = camHeight > 1800000 ? 26 : camHeight > 1300000 ? 40 : camHeight > 900000 ? 62 : 90;
  const minAreaKm2 = camHeight > 1800000 ? 5200 : camHeight > 1300000 ? 2400 : camHeight > 900000 ? 1200 : 350;

  const candidates = [];
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity?.label || !entity?.position) continue;

    const area = Number(entity._countyAreaKm2 || 0);
    if (!Number.isFinite(area) || area < minAreaKm2) {
      entity.label.show = false;
      continue;
    }

    const world = typeof entity.position.getValue === 'function'
      ? entity.position.getValue(Cesium.JulianDate.now())
      : entity.position;
    if (!world) {
      entity.label.show = false;
      continue;
    }

    const screen = Cesium.SceneTransforms.worldToWindowCoordinates(scene, world);
    if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
      entity.label.show = false;
      continue;
    }

    const text = getEntityPropText(entity, ['name', 'NAME', '地名', 'county', 'region']) || '';
    const width = Math.max(40, Math.min(148, text.length * 12));
    const height = 20;
    const x = screen.x - width / 2;
    const y = screen.y - height / 2;

    candidates.push({ entity, area, rect: { x, y, width, height } });
  }

  candidates.sort((a, b) => b.area - a.area);

  const selectedRects = [];
  let shown = 0;
  const pad = 6;
  const maxX = canvas.clientWidth - 8;
  const maxY = canvas.clientHeight - 8;
  const minX = 8;
  const minY = 8;

  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    const r = { ...c.rect };

    if (r.x < minX) r.x = minX;
    if (r.y < minY) r.y = minY;
    if (r.x + r.width > maxX) r.x = Math.max(minX, maxX - r.width);
    if (r.y + r.height > maxY) r.y = Math.max(minY, maxY - r.height);

    let collide = false;
    for (let j = 0; j < selectedRects.length; j += 1) {
      const s = selectedRects[j];
      const hit = !(
        r.x + r.width + pad < s.x ||
        s.x + s.width + pad < r.x ||
        r.y + r.height + pad < s.y ||
        s.y + s.height + pad < r.y
      );
      if (hit) {
        collide = true;
        break;
      }
    }

    if (!collide && shown < maxLabels) {
      c.entity.label.show = true;
      c.entity.label.pixelOffset = new Cesium.Cartesian2(
        Math.round(r.x + r.width / 2 - (c.rect.x + c.rect.width / 2)),
        Math.round(r.y + r.height / 2 - (c.rect.y + c.rect.height / 2))
      );
      selectedRects.push(r);
      shown += 1;
    } else {
      c.entity.label.show = false;
    }
  }
}

function elevateEntityPolyline(entity, height = 80) {
  if (!entity?.polyline?.positions) return;
  let positions = null;
  try {
    positions = typeof entity.polyline.positions.getValue === 'function'
      ? entity.polyline.positions.getValue(Cesium.JulianDate.now())
      : entity.polyline.positions;
  } catch (_e) {
    positions = null;
  }
  if (!Array.isArray(positions) || positions.length === 0) return;

  const lifted = positions.map((p) => {
    const c = Cesium.Cartographic.fromCartesian(p);
    if (!c) return p;
    const h = Number.isFinite(c.height) ? Math.max(c.height, height) : height;
    return Cesium.Cartesian3.fromRadians(c.longitude, c.latitude, h);
  });
  entity.polyline.positions = lifted;
}

function updateCountyBackdrop(showBackdrop = false, showLabels = false) {
  if (!yunnanDataSource.value) return;
  const entities = yunnanDataSource.value.entities.values || [];
  yunnanDataSource.value.show = true;
  countyBackdropState.value = {
    show: !!showBackdrop,
    labels: !!showLabels
  };

  const fillColor = showBackdrop
    ? Cesium.Color.WHITE
    : Cesium.Color.WHITE.withAlpha(0.01);
  const lineColor = showBackdrop
    ? Cesium.Color.fromCssColorString('#2f2f2f').withAlpha(0.9)
    : Cesium.Color.TRANSPARENT;
  const lineWidth = showBackdrop ? 1.15 : 0.1;

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (entity.polygon) {
      entity.polygon.fill = true;
      entity.polygon.material = fillColor;
      entity.polygon.outline = false;
      applyThickPolygonOutlineForEntity(entity, lineColor, lineWidth, Cesium);
      if (entity.polyline) {
        elevateEntityPolyline(entity, 80);
        entity.polyline.clampToGround = false;
        entity.polyline.arcType = Cesium.ArcType.NONE;
        entity.polyline.show = showBackdrop;
      }
    }

    if (!entity._countyLabelInit) {
      const labelText = getEntityPropText(entity, ['name', 'NAME', '地名', 'county', 'region']);
      const anchor = getEntityPolygonAnchor(entity);
      if (labelText && anchor) {
        const ring = getEntityPolygonRingLonLat(entity);
        const areaKm2 = calcPolygonAreaKm2(ring);
        entity._countyAreaKm2 = Number.isFinite(areaKm2) ? areaKm2 : 0;
        entity.position = anchor;
        entity.label = new Cesium.LabelGraphics({
          text: labelText,
          font: '600 12px "Microsoft YaHei", "PingFang SC", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#505050'),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.95),
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: false,
          pixelOffset: new Cesium.Cartesian2(0, 0),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(150000, 1.05, 2500000, 0.82),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2200000)
        });
      }
      entity._countyLabelInit = true;
    }
    if (entity.label) {
      entity.label.show = showBackdrop && showLabels;
    }
  }

  applyCountyLabelLayout();
  requestSceneRender();
}

function syncCountyBoundaryOverlay() {
  if (!yunnanDataSource.value) return;
  if (countyBackdropState.value.show) return;

  const shouldShowOutline = spatialUnit.value === 'county' || spatialUnit.value === 'grid';
  // 垦殖率/转换率专题图层本身已经是县域分片渲染，叠加亮青色县域矢量边界会造成“误操作感”。
  // 因此在 rate 主题下禁用县域边界叠加，不影响其它专题。
  const isRateTheme = globalStore.activeTheme === 'rate'
    && (selectedAttribute.value === 'reclamation' || selectedAttribute.value === 'conversion');
  const effectiveShowOutline = shouldShowOutline && !isRateTheme;
  const entities = yunnanDataSource.value.entities.values || [];
  const lineColor = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.countyColor).withAlpha(0.75);
  const lineWidth = UI_CONFIG.BOUNDARY_STYLE.countyWidth;

  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (!entity.polygon) continue;

    entity.polygon.fill = true;
    entity.polygon.material = Cesium.Color.WHITE.withAlpha(0.01);
    entity.polygon.outline = false;

    if (!effectiveShowOutline) {
      // 不创建新的边界线，也隐藏已有的边界线
      if (entity.polyline) entity.polyline.show = false;
      if (entity.label) entity.label.show = false;
      continue;
    }

    if (!entity.polyline) {
      applyThickPolygonOutlineForEntity(entity, lineColor, lineWidth, Cesium);
    }
    if (entity.polyline) {
      elevateEntityPolyline(entity, 80);
      entity.polyline.width = lineWidth;
      entity.polyline.material = lineColor;
      entity.polyline.clampToGround = false;
      entity.polyline.arcType = Cesium.ArcType.NONE;
      entity.polyline.show = effectiveShowOutline;
    }

    if (entity.label) {
      entity.label.show = false;
    }
  }
  requestSceneRender();
}

function forceProvinceBoundaryRed() {
  if (!regionBoundarySource.value) return;
  regionBoundarySource.value.show = true;
  const color = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.provinceColor);
  const width = UI_CONFIG.BOUNDARY_STYLE.provinceWidth;
  const entities = regionBoundarySource.value.entities.values || [];
  for (let i = 0; i < entities.length; i += 1) {
    const entity = entities[i];
    if (entity.polygon) {
      entity.polygon.fill = false;
      applyThickPolygonOutlineForEntity(entity, color, width, Cesium);
    }
    if (entity.polyline) {
      entity.polyline.show = true;
      entity.polyline.clampToGround = true;
      entity.polyline.arcType = Cesium.ArcType.GEODESIC;
    }
  }
  requestSceneRender();
}

function syncPopupPostRenderListener() {
  if (!viewer.value?.scene?.postRender) return;
  const shouldBind = !!selectedEntity.value && !!lastPickPosition;
  if (shouldBind && !isPopupPostRenderBound) {
    viewer.value.scene.postRender.addEventListener(updatePopupPosition);
    isPopupPostRenderBound = true;
  } else if (!shouldBind && isPopupPostRenderBound) {
    viewer.value.scene.postRender.removeEventListener(updatePopupPosition);
    isPopupPostRenderBound = false;
  }
}

// ======================== 可视化美化辅助函数  ========================
// =========================================================================

function getPeriodOrder(props = {}) {
  const yearStart = Number(props.yearStart);
  if (Number.isFinite(yearStart)) return yearStart;

  const match = String(props.period || '').match(/\d{4}/);
  if (match) return Number(match[0]);

  return Number.MAX_SAFE_INTEGER;
}

function getPeriodKey(props = {}) {
  if (props.period !== undefined && props.period !== null) return String(props.period);

  const yearStart = Number(props.yearStart);
  const yearEnd = Number(props.yearEnd);
  if (Number.isFinite(yearStart) && Number.isFinite(yearEnd)) return `${yearStart}-${yearEnd}`;
  if (Number.isFinite(yearStart)) return String(yearStart);
  if (Number.isFinite(yearEnd)) return String(yearEnd);
  return 'unknown';
}

function getPeriodLabel(props = {}) {
  const yearStart = Number(props.yearStart);
  const yearEnd = Number(props.yearEnd);
  if (Number.isFinite(yearStart) && Number.isFinite(yearEnd)) return `${yearStart}-${yearEnd}`;
  if (Number.isFinite(yearEnd)) return String(yearEnd);
  if (props.period !== undefined && props.period !== null) return String(props.period);
  return '';
}

function ensureClosedRing(ring = []) {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!Array.isArray(first) || !Array.isArray(last)) return [];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function ringToDegreesArray(ring = []) {
  return ring
    .filter(coord => Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1])))
    .flatMap(coord => [Number(coord[0]), Number(coord[1])]);
}

function calcDistanceKm(lon1, lat1, lon2, lat2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function calcPolygonAreaKm2(ring = []) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;
  const lat0 = ring.reduce((sum, c) => sum + Number(c?.[1] || 0), 0) / ring.length;
  const lon0 = ring.reduce((sum, c) => sum + Number(c?.[0] || 0), 0) / ring.length;
  if (!Number.isFinite(lat0) || !Number.isFinite(lon0)) return 0;

  const lat0Rad = Cesium.Math.toRadians(lat0);
  const scaleX = 111.32 * Math.cos(lat0Rad);
  const scaleY = 110.574;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return 0;

  const pts = ring
    .map((c) => {
      const lon = Number(c?.[0]);
      const lat = Number(c?.[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      return {
        x: (lon - lon0) * scaleX,
        y: (lat - lat0) * scaleY
      };
    })
    .filter(Boolean);

  if (pts.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    sum += pts[i].x * pts[i + 1].y - pts[i + 1].x * pts[i].y;
  }
  return Math.abs(sum) * 0.5;
}

function calcSdeShapeMetrics(ring = []) {
  if (!Array.isArray(ring) || ring.length < 8) {
    return {
      semiMajorKm: 0,
      semiMinorKm: 0,
      angleDeg: 0,
      areaKm2: 0
    };
  }

  const unique = ring.slice(0, -1).filter((c) => Array.isArray(c) && c.length >= 2);
  if (unique.length < 4) {
    return {
      semiMajorKm: 0,
      semiMinorKm: 0,
      angleDeg: 0,
      areaKm2: 0
    };
  }

  const cx = unique.reduce((sum, c) => sum + Number(c[0] || 0), 0) / unique.length;
  const cy = unique.reduce((sum, c) => sum + Number(c[1] || 0), 0) / unique.length;
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) {
    return {
      semiMajorKm: 0,
      semiMinorKm: 0,
      angleDeg: 0,
      areaKm2: 0
    };
  }

  const cyRad = Cesium.Math.toRadians(cy);
  const scaleX = 111.32 * Math.cos(cyRad);
  const scaleY = 110.574;
  const xy = unique
    .map((c) => {
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
      return {
        x: (lon - cx) * scaleX,
        y: (lat - cy) * scaleY
      };
    })
    .filter(Boolean);

  if (xy.length < 4) {
    return {
      semiMajorKm: 0,
      semiMinorKm: 0,
      angleDeg: 0,
      areaKm2: calcPolygonAreaKm2(ring)
    };
  }

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of xy) {
    sxx += p.x * p.x;
    syy += p.y * p.y;
    sxy += p.x * p.y;
  }
  sxx /= xy.length;
  syy /= xy.length;
  sxy /= xy.length;

  const diff = sxx - syy;
  const root = Math.sqrt(Math.max(diff * diff + 4 * sxy * sxy, 0));
  const lambda1 = Math.max((sxx + syy + root) / 2, 0);
  const lambda2 = Math.max((sxx + syy - root) / 2, 0);
  const semiMajorKm = Math.sqrt(lambda1);
  const semiMinorKm = Math.sqrt(lambda2);

  const theta = 0.5 * Math.atan2(2 * sxy, diff);
  let angleDeg = (90 - Cesium.Math.toDegrees(theta)) % 180;
  if (angleDeg < 0) angleDeg += 180;

  return {
    semiMajorKm,
    semiMinorKm,
    angleDeg,
    areaKm2: calcPolygonAreaKm2(ring)
  };
}

function buildSpatialStatsMetrics(features = [], params = {}) {
  const centers = features
    .filter((f) => f?.properties?.type === 'center' && f?.geometry?.type === 'Point')
    .map((f, idx) => {
      const props = f?.properties || {};
      const coords = f?.geometry?.coordinates || [];
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);
      return {
        id: `${getPeriodKey(props)}-${idx}`,
        period: getPeriodLabel(props) || getPeriodKey(props),
        periodKey: getPeriodKey(props),
        yearStart: Number(props?.yearStart),
        yearEnd: Number(props?.yearEnd),
        lon,
        lat
      };
    })
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
    .sort((a, b) => getPeriodOrder(a) - getPeriodOrder(b));

  const sdeRows = [];
  for (const feat of features) {
    if (feat?.properties?.type !== 'sde') continue;
    const props = feat?.properties || {};
    const periodKey = getPeriodKey(props);
    const periodLabel = getPeriodLabel(props) || periodKey;

    if (feat?.geometry?.type === 'Polygon' && Array.isArray(feat?.geometry?.coordinates?.[0])) {
      const ring = ensureClosedRing(feat.geometry.coordinates[0]);
      if (ring.length < 6) continue;
      const shape = calcSdeShapeMetrics(ring);
      const ratio = shape.semiMinorKm > 0 ? shape.semiMajorKm / shape.semiMinorKm : 0;
      sdeRows.push({
        period: periodLabel,
        periodKey,
        yearStart: Number(props?.yearStart),
        yearEnd: Number(props?.yearEnd),
        areaKm2: shape.areaKm2,
        semiMajorKm: shape.semiMajorKm,
        semiMinorKm: shape.semiMinorKm,
        angleDeg: shape.angleDeg,
        axisRatio: ratio,
        coverageRate: null
      });
      continue;
    }

    const sde = props?.standardDeviationalEllipse;
    if (!sde) continue;
    const semiMajorRaw = Number(sde?.semiMajorAxis);
    const semiMinorRaw = Number(sde?.semiMinorAxis);
    const lat = Number(sde?.meanCenterCoordinates?.[1]);
    const unitScale = semiMajorRaw > 100 ? 1 / 1000 : 111.32;
    const semiMajorKm = Number.isFinite(semiMajorRaw) ? semiMajorRaw * unitScale : 0;
    const semiMinorKm = Number.isFinite(semiMinorRaw) ? Math.max(0, semiMinorRaw) * unitScale * Math.max(Math.cos(Cesium.Math.toRadians(lat || 0)), 0.001) : 0;
    const areaKm2 = Math.PI * semiMajorKm * semiMinorKm;
    const angleDegRaw = Number(sde?.angle || 0);
    const angleDeg = ((angleDegRaw % 180) + 180) % 180;
    const axisRatio = semiMinorKm > 0 ? semiMajorKm / semiMinorKm : 0;
    sdeRows.push({
      period: periodLabel,
      periodKey,
      yearStart: Number(props?.yearStart),
      yearEnd: Number(props?.yearEnd),
      centerLon: Number(sde?.meanCenterCoordinates?.[0]),
      centerLat: Number(sde?.meanCenterCoordinates?.[1]),
      areaKm2,
      semiMajorKm,
      semiMinorKm,
      angleDeg,
      axisRatio,
      coverageRate: null
    });
  }

  const sdeByKey = new Map();
  sdeRows
    .slice()
    .sort((a, b) => getPeriodOrder(a) - getPeriodOrder(b))
    .forEach((row) => {
      sdeByKey.set(row.periodKey, row);
    });

  const centerMetrics = {
    first: centers[0] || null,
    last: centers[centers.length - 1] || null,
    totalDistanceKm: 0,
    avgStepKm: 0,
    maxStepKm: 0,
    stepCount: 0,
    moveAzimuthDeg: null
  };

  const stepDistances = [];
  for (let i = 0; i < centers.length - 1; i += 1) {
    const from = centers[i];
    const to = centers[i + 1];
    const d = calcDistanceKm(from.lon, from.lat, to.lon, to.lat);
    if (Number.isFinite(d) && d > 0) stepDistances.push(d);
  }
  if (stepDistances.length > 0) {
    centerMetrics.totalDistanceKm = stepDistances.reduce((s, v) => s + v, 0);
    centerMetrics.avgStepKm = centerMetrics.totalDistanceKm / stepDistances.length;
    centerMetrics.maxStepKm = Math.max(...stepDistances);
    centerMetrics.stepCount = stepDistances.length;
  }

  if (centerMetrics.first && centerMetrics.last) {
    const dLon = centerMetrics.last.lon - centerMetrics.first.lon;
    const dLat = centerMetrics.last.lat - centerMetrics.first.lat;
    if (Math.abs(dLon) > 1e-9 || Math.abs(dLat) > 1e-9) {
      let az = Cesium.Math.toDegrees(Math.atan2(dLon, dLat));
      if (az < 0) az += 360;
      centerMetrics.moveAzimuthDeg = az;
    }
  }

  const sdePeriods = centers
    .map((c) => c.periodKey)
    .filter((k) => sdeByKey.has(k))
    .map((k) => sdeByKey.get(k));

  const angleDeltas = [];
  const areaChanges = [];
  for (let i = 0; i < sdePeriods.length - 1; i += 1) {
    const a = sdePeriods[i];
    const b = sdePeriods[i + 1];
    const angleA = Number(a?.angleDeg);
    const angleB = Number(b?.angleDeg);
    if (Number.isFinite(angleA) && Number.isFinite(angleB)) {
      let delta = Math.abs(angleB - angleA) % 180;
      if (delta > 90) delta = 180 - delta;
      angleDeltas.push(delta);
    }
    const areaA = Number(a?.areaKm2);
    const areaB = Number(b?.areaKm2);
    if (Number.isFinite(areaA) && Number.isFinite(areaB) && areaA > 0) {
      areaChanges.push((areaB - areaA) / areaA);
    }
  }

  const primary = sdePeriods[sdePeriods.length - 1] || sdeRows[sdeRows.length - 1] || null;
  const firstSde = sdePeriods[0] || sdeRows[0] || null;

  const axisRatio = Number(primary?.axisRatio || 0);
  const majorMinorGapKm = Math.max(Number(primary?.semiMajorKm || 0) - Number(primary?.semiMinorKm || 0), 0);
  const areaTrend = (() => {
    if (!firstSde || !primary) return 0;
    const a0 = Number(firstSde.areaKm2);
    const a1 = Number(primary.areaKm2);
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || a0 <= 0) return 0;
    return (a1 - a0) / a0;
  })();

  const rotationTrend = angleDeltas.length > 0
    ? angleDeltas.reduce((s, v) => s + v, 0) / angleDeltas.length
    : 0;

  const areaVolatility = areaChanges.length > 0
    ? Math.sqrt(areaChanges.reduce((s, v) => s + v * v, 0) / areaChanges.length)
    : 0;

  const periodCount = Array.isArray(params?.periods) ? params.periods.length : undefined;
  const centerCoverage = Number.isFinite(Number(periodCount)) && Number(periodCount) > 0
    ? Math.min(1, centers.length / Number(periodCount))
    : 0;
  const sdeCoverage = Number.isFinite(Number(periodCount)) && Number(periodCount) > 0
    ? Math.min(1, sdeRows.length / Number(periodCount))
    : 0;

  return {
    centers,
    center_metrics: centerMetrics,
    sde_period_metrics: sdeRows,
    sde_summary: {
      period: primary?.period || '',
      area_km2: Number(primary?.areaKm2 || 0),
      semi_major_km: Number(primary?.semiMajorKm || 0),
      semi_minor_km: Number(primary?.semiMinorKm || 0),
      angle_deg: Number(primary?.angleDeg || 0),
      axis_ratio: axisRatio,
      major_minor_gap_km: majorMinorGapKm,
      coverage_rate: primary?.coverageRate ?? null
    },
    derived_metrics: {
      center_coverage: centerCoverage,
      sde_coverage: sdeCoverage,
      center_total_migration_km: centerMetrics.totalDistanceKm,
      center_avg_step_km: centerMetrics.avgStepKm,
      center_max_step_km: centerMetrics.maxStepKm,
      center_move_azimuth_deg: centerMetrics.moveAzimuthDeg,
      rotation_avg_delta_deg: rotationTrend,
      area_change_rate: areaTrend,
      area_volatility: areaVolatility
    }
  };
}
async function handleSpatialStatsQuery(params) {
  // [Decoupling] 专题层强制全省视角
  if (globalStore.scope.level !== 'province') {
    lastSpatialStatsParams.value = params;
    globalStore.setActiveTheme('spatial_stats');
    globalStore.setScope('province', '530000', '云南省');
    return;
  }

  lastSpatialStatsParams.value = params;
  globalStore.setActiveTheme('spatial_stats');
  globalStore.setThemeContext('spatial_stats', { params, stats: {} });
  const runTrajectory = params?.showTrajectory !== false;
  const runSDE = params?.showSDE !== false;
  const shouldRunSpatialStats = runTrajectory || runSDE;

  try {
    // 1. 清理旧图层与旧实体
    if (blankBoundaryWmsLayer) {
      viewer.value.imageryLayers.remove(blankBoundaryWmsLayer);
      blankBoundaryWmsLayer = null;
    }
    // 强制清理旧的分析实体
    clearSpatialStatsEntities();
    
    cleanupThemeLayers('all');

    isLoading.value = true;
    setSpatialStatsLoading(shouldRunSpatialStats);

    // 2. 发起查询
    const response = await analysisApi.getSpatialStatsSeries(params);

    // 记录专题上下文：用于左右面板展示（专题监测适配）
    try {
      const features = Array.isArray(response.features) ? response.features : [];
      const meta = response.meta || {};
      const centerCount = features.filter(f => f?.properties?.type === 'center').length;
      const sdeCount = features.filter(f => f?.properties?.type === 'sde').length;
      const hasTrajFeature = features.some(f => f?.properties?.type === 'trajectory');
      const periodCount = Array.isArray(meta.periods) ? meta.periods.length : 0;
      const hasData = features.length > 0 || centerCount > 0 || sdeCount > 0 || hasTrajFeature;
      const metricsPayload = buildSpatialStatsMetrics(features, { periods: meta.periods || [] });
      const centerPoints = Array.isArray(metricsPayload?.centers) ? metricsPayload.centers : [];
      const trajectorySegments = Math.max(centerPoints.length - 1, 0);
      const hasTraj = trajectorySegments > 0 || hasTrajFeature;

      let emptyReason = '';
      if (!hasData) {
        emptyReason = String(meta?.message || '当前参数下未生成空间统计结果').trim();
      } else if (centerCount > 0 && sdeCount === 0) {
        emptyReason = '部分时段样本点不足3个，无法形成标准差椭圆';
      }

      globalStore.setThemeContext('spatial_stats', {
        params,
        stats: {
          period_count: periodCount,
          center_count: centerCount,
          sde_count: sdeCount,
          trajectory_segments: trajectorySegments,
          has_trajectory: hasTraj,
          has_data: hasData,
          empty_reason: emptyReason
        },
        trajectory_points: centerPoints,
        center_metrics: metricsPayload.center_metrics,
        sde_summary: metricsPayload.sde_summary,
        derived_metrics: metricsPayload.derived_metrics,
        sde_period_metrics: metricsPayload.sde_period_metrics
      });
    } catch (_e) {
      // ignore: 面板只需要轻量摘要，失败不应阻断主流程
    }

    // 3. 彻底隐藏背景业务图层，为白底图腾出空间
    if (params.showBlankBoundary) {
      if (clcdLayer.value) clcdLayer.value.show = false;
      wmsLayerCache.forEach(layer => { layer.show = false; layer.alpha = 0; });
      if (rateWmsLayer) rateWmsLayer.show = false;
      if (transferWmsLayer) transferWmsLayer.show = false;
      // 使用单一矢量县域边界，避免 WMS 分片重复地名与模糊
      updateCountyBackdrop(true, true);
      // 标准差椭圆白底模式：省界必须保持红色
      forceProvinceBoundaryRed();
    }

    // 4. Academic-style spatial rendering on ground surface.
    const features = Array.isArray(response.features) ? response.features : [];
    spatialStatsVisibility.value = {
      trajectory: params.showTrajectory !== false,
      sde: params.showSDE !== false
    };

    const centerFeatures = features
      .filter(f => f?.properties?.type === 'center' && f?.geometry?.type === 'Point')
      .map((feat, idx) => ({ feat, idx }))
      .sort((a, b) => {
        const aProps = a.feat?.properties || {};
        const bProps = b.feat?.properties || {};
        const startDiff = getPeriodOrder(aProps) - getPeriodOrder(bProps);
        if (startDiff !== 0) return startDiff;
        const endDiff = Number(aProps.yearEnd || 0) - Number(bProps.yearEnd || 0);
        if (Number.isFinite(endDiff) && endDiff !== 0) return endDiff;
        return a.idx - b.idx;
      })
      .map((item) => item.feat);

    const periodKeys = [];
    const periodLabelMap = new Map();
    centerFeatures.forEach(feat => {
      const key = getPeriodKey(feat.properties);
      if (!periodLabelMap.has(key)) {
        periodKeys.push(key);
        periodLabelMap.set(key, getPeriodLabel(feat.properties));
      }
    });

    const colorMap = new Map(periodKeys.map((key, idx) => [key, sdeColors[idx % sdeColors.length]]));
    const getColorByProps = (props = {}) => {
      const key = getPeriodKey(props);
      const fallbackColor = sdeColors[0] || '#e41a1c';
      return Cesium.Color.fromCssColorString(colorMap.get(key) || fallbackColor);
    };
    const parseLonLatPair = (coord = []) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const a = Number(coord[0]);
      const b = Number(coord[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

      const aLooksLon = a >= -180 && a <= 180;
      const bLooksLat = b >= -90 && b <= 90;
      if (aLooksLon && bLooksLat) return [a, b];

      const bLooksLon = b >= -180 && b <= 180;
      const aLooksLat = a >= -90 && a <= 90;
      if (bLooksLon && aLooksLat) return [b, a];

      return null;
    };
    const centerCoords = [];
    for (let idx = 0; idx < centerFeatures.length; idx += 1) {
      const feat = centerFeatures[idx];
      const lonLat = parseLonLatPair(feat?.geometry?.coordinates || []);
      if (!lonLat) continue;
      const [lon, lat] = lonLat;

      const props = feat.properties || {};
      const periodLabel = getPeriodLabel(props);
      const baseColor = getColorByProps(props);

      centerCoords.push([lon, lat, props]);

      const showCenterLabel = centerFeatures.length <= 4;
      const centerEntity = viewer.value.entities.add({
        show: spatialStatsVisibility.value.trajectory || spatialStatsVisibility.value.sde,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: 9,
          color: Cesium.Color.WHITE,
          outlineColor: baseColor.withAlpha(0.98),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: showCenterLabel
          ? {
              text: periodLabel ? `${periodLabel}` : '',
              font: '10px "Microsoft YaHei", sans-serif',
              fillColor: Cesium.Color.BLACK,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              showBackground: true,
              backgroundColor: Cesium.Color.WHITE.withAlpha(0.66),
              pixelOffset: new Cesium.Cartesian2(0, -15),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 160000)
            }
          : undefined
      });
      centerEntity._isSpatialStats = true;
      centerEntity._spatialType = 'center';
    }

    const addTrajectoryPolyline = (degreesArray, colorCss = '#e41a1c') => {
      if (!Array.isArray(degreesArray) || degreesArray.length < 4) return false;
      const elevatedDegrees = [];
      for (let i = 0; i < degreesArray.length; i += 2) {
        elevatedDegrees.push(degreesArray[i], degreesArray[i + 1], SPATIAL_STATS_LINE_HEIGHT);
      }
      const trajectoryEntity = viewer.value.entities.add({
        show: spatialStatsVisibility.value.trajectory,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(elevatedDegrees),
          clampToGround: false,
          arcType: Cesium.ArcType.GEODESIC,
          width: 2.2,
          material: Cesium.Color.fromCssColorString(colorCss).withAlpha(0.88)
        }
      });
      trajectoryEntity._isSpatialStats = true;
      trajectoryEntity._spatialType = 'trajectory';
      return true;
    };

    const addTrajectoryArrowSegment = (fromLon, fromLat, toLon, toLat, colorCss = '#e41a1c') => {
      const samePoint = Math.abs(fromLon - toLon) < 1e-7 && Math.abs(fromLat - toLat) < 1e-7;
      if (samePoint) return false;

      const color = Cesium.Color.fromCssColorString(colorCss).withAlpha(0.98);
      const trajectoryArrowEntity = viewer.value.entities.add({
        show: spatialStatsVisibility.value.trajectory,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            fromLon, fromLat, SPATIAL_STATS_LINE_HEIGHT,
            toLon, toLat, SPATIAL_STATS_LINE_HEIGHT
          ]),
          clampToGround: false,
          arcType: Cesium.ArcType.GEODESIC,
          width: 2.8,
          material: new Cesium.PolylineArrowMaterialProperty(color)
        }
      });
      trajectoryArrowEntity._isSpatialStats = true;
      trajectoryArrowEntity._spatialType = 'trajectory';
      return true;
    };

    const centerPath = [];
    centerCoords.forEach(([lon, lat, props]) => {
      const prev = centerPath[centerPath.length - 1];
      if (!prev) {
        centerPath.push({ lon, lat, props });
        return;
      }
      const samePoint = Math.abs(prev.lon - lon) < 1e-7 && Math.abs(prev.lat - lat) < 1e-7;
      if (!samePoint) {
        centerPath.push({ lon, lat, props });
      }
    });

    let drewTrajectory = false;

    // 优先使用 center 序列构建轨迹，按年份顺序逐段绘制箭头。
    if (centerPath.length >= 2) {
      const trajectoryDegrees = centerPath.flatMap((p) => [p.lon, p.lat]);
      const firstColor = getColorByProps(centerPath[0]?.props || {}).toCssColorString();
      addTrajectoryPolyline(trajectoryDegrees, firstColor);

      let arrowCount = 0;
      for (let i = 0; i < centerPath.length - 1; i += 1) {
        const from = centerPath[i];
        const to = centerPath[i + 1];
        const segColor = getColorByProps(from?.props || {}).toCssColorString();
        if (addTrajectoryArrowSegment(from.lon, from.lat, to.lon, to.lat, segColor)) {
          arrowCount += 1;
        }
      }
      drewTrajectory = arrowCount > 0;
    }

    // 兜底：center 序列不可用时，使用后端 trajectory 几何并按顺序补箭头。
    if (!drewTrajectory) {
      const trajectoryFeatures = features.filter((f) => f?.properties?.type === 'trajectory');
      for (const trajFeat of trajectoryFeatures) {
        if (trajFeat?.geometry?.type !== 'LineString') continue;
        const rawCoords = Array.isArray(trajFeat?.geometry?.coordinates) ? trajFeat.geometry.coordinates : [];
        const pathPoints = rawCoords
          .map((coord) => parseLonLatPair(coord))
          .filter((coord) => {
            if (!coord) return false;
            const [lon, lat] = coord;
            return lon >= YUNNAN_VIEW_RECT.west - 5
              && lon <= YUNNAN_VIEW_RECT.east + 5
              && lat >= YUNNAN_VIEW_RECT.south - 5
              && lat <= YUNNAN_VIEW_RECT.north + 5;
          });
        if (pathPoints.length < 2) continue;

        const trajectoryDegrees = pathPoints.flatMap(([lon, lat]) => [lon, lat]);
        addTrajectoryPolyline(trajectoryDegrees, '#e41a1c');

        let arrowCount = 0;
        for (let i = 0; i < pathPoints.length - 1; i += 1) {
          const [fromLon, fromLat] = pathPoints[i];
          const [toLon, toLat] = pathPoints[i + 1];
          if (addTrajectoryArrowSegment(fromLon, fromLat, toLon, toLat, '#e41a1c')) {
            arrowCount += 1;
          }
        }

        if (arrowCount > 0) {
          drewTrajectory = true;
          break;
        }
      }
    }

    // SDE from backend is GeoJSON Polygon; render ring only (no fill).
    for (const feat of features) {
      if (feat?.properties?.type !== 'sde') continue;
      const props = feat.properties || {};
      const baseColor = getColorByProps(props);
      const geom = feat.geometry || {};

      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
        const ring = ensureClosedRing(geom.coordinates[0]);
        const ringDegrees = ringToDegreesArray(ring);
        if (ringDegrees.length < 6) continue;

        const ringDegreesWithHeight = [];
        for (let i = 0; i < ringDegrees.length; i += 2) {
          ringDegreesWithHeight.push(ringDegrees[i], ringDegrees[i + 1], SPATIAL_STATS_LINE_HEIGHT);
        }
        const ringPositions = Cesium.Cartesian3.fromDegreesArrayHeights(ringDegreesWithHeight);
        const sdeRingEntity = viewer.value.entities.add({
          show: spatialStatsVisibility.value.sde,
          polyline: {
            positions: ringPositions,
            clampToGround: false,
            arcType: Cesium.ArcType.GEODESIC,
            width: 1.8,
            material: baseColor.withAlpha(0.92)
          }
        });
        sdeRingEntity._isSpatialStats = true;
        sdeRingEntity._spatialType = 'sde';
      } else if (props.standardDeviationalEllipse) {
        // Backward-compatible fallback.
        const sde = props.standardDeviationalEllipse;
        const lat = Number(sde?.meanCenterCoordinates?.[1]);
        const lon = Number(sde?.meanCenterCoordinates?.[0]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const unitFactor = Number(sde.semiMajorAxis) > 100 ? 1 : 111320;

        const sdeLegacyEntity = viewer.value.entities.add({
          show: spatialStatsVisibility.value.sde,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          ellipse: {
            semiMajorAxis: Number(sde.semiMajorAxis) * unitFactor,
            semiMinorAxis: Number(sde.semiMinorAxis) * unitFactor * Math.cos(Cesium.Math.toRadians(lat)),
            rotation: Cesium.Math.toRadians(90 - Number(sde.angle || 0)),
            outline: true,
            outlineColor: baseColor,
            outlineWidth: 1.2,
            material: Cesium.Color.TRANSPARENT,
            height: SPATIAL_STATS_LINE_HEIGHT
          }
        });
        sdeLegacyEntity._isSpatialStats = true;
        sdeLegacyEntity._spatialType = 'sde';
      }
    }

    // 固定保持云南省外接范围，不再飞到重心/椭圆中心。
    flyToYunnanFullView(1.5);

    // 5. 更新图例
    // 图例拥挤优化：仅显示关键节点（最多6个）+ 总期数摘要。
    const totalPeriods = periodKeys.length;
    const pickSparseIndex = (size, count = 6) => {
      if (size <= count) return Array.from({ length: size }, (_, i) => i);
      const result = new Set([0, size - 1]);
      const step = (size - 1) / (count - 1);
      for (let i = 1; i < count - 1; i += 1) result.add(Math.round(i * step));
      return Array.from(result).sort((a, b) => a - b);
    };
    const sparseIndices = pickSparseIndex(totalPeriods, 6);
    const sparseItems = sparseIndices.map((idx) => {
      const key = periodKeys[idx];
      return {
        label: periodLabelMap.get(key) || key,
        color: sdeColors[idx % sdeColors.length]
      };
    });
    if (totalPeriods > sparseItems.length) {
      sparseItems.push({
        label: `共${totalPeriods}期`,
        color: 'rgba(148,163,184,0.85)'
      });
    }
    globalStore.updateLegend({
      title: params.legendTitle || '时空演变分析',
      type: 'categorical',
      items: sparseItems
    });

  } catch (err) {
    console.error('[SpatialStats] Error:', err);
    globalStore.setThemeContext('spatial_stats', {
      params,
      stats: {
        period_count: 0,
        center_count: 0,
        sde_count: 0,
        has_trajectory: false,
        has_data: false,
        empty_reason: err?.message || '空间统计查询失败'
      },
      trajectory_points: [],
      center_metrics: null,
      sde_summary: null,
      derived_metrics: null,
      sde_period_metrics: []
    });
    alert(err.message || '分析查询失败');
  } finally {
    isLoading.value = false;
    setSpatialStatsLoading(false);
  }
}

// ===== 土地流转 WMS 渲染 =====
let transferWmsLayer = null; // 当前的流转 WMS 图层引用

/**
 * 按专题类型精准清理图层
 * @param {string|null} themeToClean - 要清理的专题：'transfer' | 'rate' | 'spatial_stats' | 'all'
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
    if (bottomNavRef.value?.transferControl?.setLoading) bottomNavRef.value.transferControl.setLoading(false);
  }

  if (themeToClean === 'rate' || themeToClean === 'all') {
    if (rateWmsLayer) {
      viewer.value.imageryLayers.remove(rateWmsLayer, true);
      rateWmsLayer = null;
    }
    if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(false);
  }

  if (themeToClean === 'spatial_stats' || themeToClean === 'all') {
    clearSpatialStatsEntities();
    if (spatialStatsDataSource.value) {
      viewer.value.dataSources.remove(spatialStatsDataSource.value, true);
      spatialStatsDataSource.value = null;
    }
    if (blankBoundaryWmsLayer) {
      viewer.value.imageryLayers.remove(blankBoundaryWmsLayer, true);
      blankBoundaryWmsLayer = null;
    }
    updateCountyBackdrop(false, false);
    setSpatialStatsLoading(false);
    // 恢复行政边界原样式（针对“空白背景”模式）
    if (yunnanDataSource.value) {
      yunnanDataSource.value.show = true;
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
  // console.log('[Workbench] handleResetMap called, resetting map view to default');
  
  // 1. 强制回归默认图层状态
  globalStore.setActiveLayer('clcd');
  selectedAttribute.value = 'cropland';
  
  // 重置行政范围到全省，这会触发 scope 监听器并重新加载全省 WMS
  globalStore.setScope('province', '530000', '云南省');
  currentClipWKT.value = null; // 清除裁剪 WKT
  
  // 2. 清理流转图层和其他专属 UI
  clearAllAnalysisLayers(viewer.value);
  clearSpatialStatsEntities();
  transferWmsLayer = null;
  rateWmsLayer = null;
  if (bottomNavRef.value?.transferControl?.setLoading) bottomNavRef.value.transferControl.setLoading(false);
  if (bottomNavRef.value?.rateControl?.setLoading) bottomNavRef.value.rateControl.setLoading(false);
  setSpatialStatsLoading(false);

  // 清除专题参数缓存，防止 scope watcher 触发残留重查
  lastTransferParams.value = null;
  lastRateParams.value = null;
  lastSpatialStatsParams.value = null;
  globalStore.setActiveTheme(null);
  globalStore.clearThemeContext('all');
  globalStore.setActivePanel(null);

  if (transferDataSource.value && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.dataSources.remove(transferDataSource.value, true);
    transferDataSource.value = null;
  }

  if (spatialStatsDataSource.value && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.dataSources.remove(spatialStatsDataSource.value, true);
    spatialStatsDataSource.value = null;
  }
  if (blankBoundaryWmsLayer && viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.imageryLayers.remove(blankBoundaryWmsLayer, true);
    blankBoundaryWmsLayer = null;
  }
  updateCountyBackdrop(false, false);

  globalStore.clearLegend();
  
  // 3. 将行政边界状态标记为收起
  if (yunnanDataSource.value) {
    yunnanDataSource.value.show = true;
  }

  // 4. 视角复位到云南全境
  if (viewer.value) {
    flyToYunnanFullView(1.5);
  }

  // 5. 触发刷新
  refreshMapLayer(true);
}

// transfer_dynamic.sld 的 10 级红蓝色带（与 SLD 一致）
const transferColors = [
  '#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0',
  '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'
];

/**
 * 处理来自 LandTransferControl 的流转查询事件
 * 使用 WMS 服务渲染（通过 GeoServer SQL View + viewparams + transfer_dynamic SLD）
 */
async function handleTransferQuery(params) {
  // [Decoupling] 专题层强制全省视角
  if (globalStore.scope.level !== 'province') {
    lastTransferParams.value = params;
    globalStore.setActiveTheme('transfer');
    globalStore.setScope('province', '530000', '云南省');
    return;
  }

  // console.log('[Transfer] Query params:', params);
  // 强制清理上一专题的图层
  lastTransferParams.value = params; // 缓存参数供区域切换后自动重查
  cleanupThemeLayers(globalStore.activeTheme);
  globalStore.setActiveTheme('transfer');

  // [Critical Fix] 必须在 await 之前同步设置，确保 Vue 的 spatialUnit 与
  // selectedAttribute 的变化合并到同一个 watcher tick，避免 watcher 二次触发
  // clearAllAnalysisLayers 清除刚创建的流转图层（竞态 Bug）
  selectedAttribute.value = 'transfer';

  isLoading.value = true;

  if (bottomNavRef.value?.transferControl?.setLoading) {
    bottomNavRef.value.transferControl.setLoading(true);
  }

  try {
    const { yearStart, yearEnd, fromClass, toClass, unit, legendTitle } = params;
    const normalizedFromClass = fromClass === '' || fromClass === null || fromClass === undefined
      ? ''
      : Number(fromClass);
    const normalizedToClass = toClass === '' || toClass === null || toClass === undefined
      ? ''
      : Number(toClass);
    const fromClassParam = normalizedFromClass === '' ? '' : String(normalizedFromClass);
    const toClassParam = normalizedToClass === '' ? '' : String(normalizedToClass);

    // 1. 记录旧图层引用用于平滑过渡 (Double Buffering)
    const oldLayer = transferWmsLayer;

    // 1b. 隐藏现有的面积 WMS 图层和 CLCD 图层，避免遮挡
    wmsLayerCache.forEach((layer) => { layer.show = false; layer.alpha = 0; });
    if (clcdLayer.value) clcdLayer.value.show = false;

    // 2. 调用 breaks API（transfer 模式）获取 sumExpr + breaks
    const token = localStorage.getItem('auth_token');
    // 注意：transfer 模式后端会校验 from_class/to_class 参数键是否存在。
    // 即便前端选择“全部”，也需要显式传空值，避免被判定为 missing params。
    const breaksUrl = `/api/clcd/breaks?mode=transfer&year_start=${yearStart}&year_end=${yearEnd}&from_class=${encodeURIComponent(fromClassParam)}&to_class=${encodeURIComponent(toClassParam)}&unit=${unit}&classes=10&method=jenks`;

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

    // 2. 记录专题上下文：用于左右面板“专题监测”适配
    globalStore.setThemeContext('transfer', {
      params,
      stats: breaksData.stats || {},
      breaks: breaksData.breaks || [],
      field: breaksData.field,
      unit_label: breaksData.unit_label || 'km²',
      top_units: breaksData.top_units || []
    });

    // 3. 构建 env 参数（分级阈值传递给 SLD）
    //    _transfer_sum 列单位为 km²（后端已除以 1,000,000）
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

    // _transfer_sum 列为 km²（后端已除以 1,000,000），SLD 阈值直接用 km² 匹配
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
      tileWidth: 512,
      tileHeight: 512,
      enablePickFeatures: true,
      parameters: {
        service: 'WMS',
        version: '1.1.0',
        request: 'GetMap',
        transparent: true,
        format: 'image/png',
        interpolations: 'nearest neighbor',
        styles: 'transfer_dynamic',
        env: envParams,
        info_format: 'application/json',
        ...(currentClipWKT.value ? { clip: currentClipWKT.value } : {})
      }
    });

    // 调试: 输出拼接在浏览器测试的 WMS GetMap URL
    const testUrl = `/geoserver/WebGIS/wms?service=WMS&version=1.1.1&request=GetMap&layers=${layerName}&styles=transfer_dynamic&format=image/png&transparent=true&width=256&height=256&srs=EPSG:4326&bbox=97.5,21.1,106.2,29.3&env=${encodeURIComponent(envParams)}`;
    // console.log('[Transfer]  WMS Test URL:', testUrl);

    // 错误日志: 瓦片加载失败时输出详情（首屏输出完整信息，后续静默）
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
    newLayer.isAnalysisLayer = true; // 必须标记为分析图层，否则 addExclusiveAnalysisLayer 的清理逻辑会出错
    
    // 使用互斥策略添加
    addExclusiveAnalysisLayer(viewer.value, newLayer, BUFFER_DELAY);
    
    // 更新当前引用
    transferWmsLayer = newLayer;

    // 延迟销毁逻辑在互斥模式下已由 addExclusiveAnalysisLayer 自动处理（即刻清理旧图层）
    // 如果由于性能原因仍需保留 oldLayer 做平滑过渡，可手动调 addExclusiveAnalysisLayer 跳过清理或维持当前双缓冲逻辑
    // 但根据“全单例”要求，此处回归标准互斥调用。

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
    
    // 拦截县域和格网模式下的点击（CLCD模式暂时屏蔽）
    if (spatialUnit.value === 'clcd') {
        selectedEntity.value = null;
        clearHighlight();
        return;
    }

    const ray = viewer.value.camera.getPickRay(position);
    if (!ray) return;
    
    // 在 ImageryLayers 下拾取 WMS 特征
    const featurePromise = viewer.value.scene.imageryLayers.pickImageryLayerFeatures(ray, viewer.value.scene);
    
    if (Cesium.defined(featurePromise)) {
        featurePromise.then(features => {
            if (features && features.length > 0) {
                const feature = features[0];
                const props = feature.properties || feature.data?.properties || {};
                
                // 更加宽泛的地名提取逻辑
                const regionName = props['地名'] || props['name'] || props['NAME'] || props['county'] || props['region'] || props['REGION_NAME'] || props['地级'] || props['省级'] || '未知区域';
                const displayProps = {};
                
                // 提取数据属性
                if (spatialUnit.value === 'land_transfer' || selectedAttribute.value === 'transfer') {
                    // 流转模式专用逻辑：获取流转数值数据
                    const transferVal = props['_transfer_sum'] || props['_sum'] || props['transfer_sum'] || props['sum'];
                    if (transferVal !== undefined) {
                        const valKm2 = Number(transferVal).toFixed(2);
                        // 使用当前属性标签或通用标签
                        const label = currentAttributeLabel.value || '流转面积';
                        displayProps[label] = `${valKm2} km²`;
                    }
                } else if (currentStatsField.value && props[currentStatsField.value] !== undefined) {
                    const rawVal = Number(props[currentStatsField.value]);
                    // 假单位为平方米，转为平方公?
                    const valKm2 = (rawVal / 1000000).toFixed(2);
                    displayProps[currentAttributeLabel.value] = `${valKm2} km²`;
                }
                
                // 即使没有数据属性，也显示地名并高亮
                selectedEntity.value = {
                    name: regionName,
                    properties: displayProps
                };
                
                // 执行高亮
                highlightRegion(regionName);

                // 记录地理位置用于实时投影（实现“依比例”锚定）
                // 优先使用面中心或拾取点
                const cartesian = viewer.value.camera.pickEllipsoid(position);
                if (cartesian) {
                    lastPickPosition = cartesian;
                    syncPopupPostRenderListener();
                    requestSceneRender();
                }
            } else {
                selectedEntity.value = null;
                lastPickPosition = null;
                clearHighlight();
            }
        }).catch(() => {
            selectedEntity.value = null;
            lastPickPosition = null;
            clearHighlight();
        });
    } else {
        selectedEntity.value = null;
        lastPickPosition = null;
        clearHighlight();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 2. 鼠标移动：切换手型指针（节流，避免每帧 pick 导致主线程抖动）
  let lastCursorPickTs = 0;
  clickHandler.setInputAction((movement) => {
    if (mapStore.activeMeasurementTool) return;
    const now = Date.now();
    if (now - lastCursorPickTs < 120) return;
    lastCursorPickTs = now;
    
    const ray = viewer.value.camera.getPickRay(movement.endPosition);
    if (!ray) {
        viewer.value.scene.canvas.style.cursor = 'default';
        return;
    }
    
    // 这里简单判定：如果开启县域或格网模式，且鼠标在要素上方，则变为手型
    // 注意：pickImageryLayerFeatures 是异步的，这里不宜频繁调用 API
    // 我们需结合 scene.pick 快速判定背景场景
    const pickedObject = viewer.value.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id && (spatialUnit.value === 'county' || spatialUnit.value === 'grid')) {
        viewer.value.scene.canvas.style.cursor = 'pointer';
    } else {
        viewer.value.scene.canvas.style.cursor = 'default';
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // 右键清除高亮和标签
  clickHandler.setInputAction(() => {
    selectedEntity.value = null;
    lastPickPosition = null;
    popupStyle.value.display = 'none';
    syncPopupPostRenderListener();
    clearHighlight();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

// 高亮区域逻辑
function highlightRegion(name) {
    if (!yunnanDataSource.value) return;

    // 清除上一个高亮
    clearHighlight();

    const entities = yunnanDataSource.value.entities.values;
    // 模糊匹配，尝试匹配名称（去掉常见的行政区划后缀，增加匹配度）
    const cleanSearchName = name.replace(/(省|市|州|区|县|镇)$/, '');
    
    const target = entities.find(e => {
        const eName = e.properties.name ? e.properties.name.getValue() : '';
        const eNameClean = eName.replace(/(省|市|州|区|县|镇)$/, '');
        return eName === name || eName.includes(name) || name.includes(eName) || (cleanSearchName && eNameClean === cleanSearchName);
    });

    if (target) {
        if (target.polygon) {
            target.polygon.fill = false; // 保证内部完全透明
        }
        if (target.polyline) {
            target.polyline.width = UI_CONFIG.BOUNDARY_STYLE.highlightWidth;
            target.polyline.material = Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.highlightColor);
            target.polyline.show = true;
        } else {
            // Fallback immediately generated
            applyThickPolygonOutlineForEntity(target, Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.highlightColor), UI_CONFIG.BOUNDARY_STYLE.highlightWidth, Cesium);
        }
        highlightedEntity.value = target;
        requestSceneRender();
    } else {
        console.warn('[Workbench] No matching vector entity found for region:', name);
    }
}

function clearHighlight() {
    if (highlightedEntity.value) {
        const shouldShowBackdrop = countyBackdropState.value.show === true;
        const shouldShowCountyOutline = spatialUnit.value === 'county' || spatialUnit.value === 'grid';
        const restoreLineColor = shouldShowBackdrop
          ? Cesium.Color.fromCssColorString('#2f2f2f').withAlpha(0.9)
          : Cesium.Color.fromCssColorString(UI_CONFIG.BOUNDARY_STYLE.countyColor).withAlpha(0.75);
        const restoreLineWidth = shouldShowBackdrop ? 1.15 : UI_CONFIG.BOUNDARY_STYLE.countyWidth;

        if (highlightedEntity.value.polygon) {
            highlightedEntity.value.polygon.fill = true;
            highlightedEntity.value.polygon.material = shouldShowBackdrop
              ? Cesium.Color.WHITE
              : Cesium.Color.WHITE.withAlpha(0.01);
        }

        // Restore original thickness using current county backdrop mode
        if (highlightedEntity.value.polyline) {
            highlightedEntity.value.polyline.width = restoreLineWidth;
            highlightedEntity.value.polyline.material = restoreLineColor;
            highlightedEntity.value.polyline.show = shouldShowBackdrop || shouldShowCountyOutline;
        }
        highlightedEntity.value = null;
        requestSceneRender();
    }
}

// 监听测量工具激活事件，静默清除县域标注（解决文字堆叠问题）
window.addEventListener('clearCountyHighlight', handleClearCountyHighlight);

onMounted(async () => {
  
  try {
    // Render profile switch (optional):
    // - default: hq (native device pixels)
    // - ?cesium_profile=balanced : CSS-pixel rendering (helps slow Chrome/GPU drivers)
    let cesiumProfile = 'hq';
    try {
      const params = new URLSearchParams(window.location.search);
      const p = (params.get('cesium_profile') || '').toLowerCase();
      if (p === 'balanced' || p === 'perf' || p === 'low') cesiumProfile = 'balanced';
    } catch (e) {}

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
      // Render at native device resolution for maximum clarity (HiDPI).
      // Note: this is heavier in Chrome on some GPUs; if needed we can add a runtime toggle.
      useBrowserRecommendedResolution: cesiumProfile !== 'hq',
      skyAtmosphere: false, // 彻底移除大气层
      shouldAnimate: false,
      contextOptions: {
        webgl: {
          alpha: true,
          depth: true,
          stencil: true,
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false
        },
        allowTextureFilterAnisotropic: true
      }
    });
    viewer.value = viewerInstance;

    viewer.value.scene.postProcessStages.fxaa.enabled = true;
    viewer.value.scene.highDynamicRange = true;
    // With useBrowserRecommendedResolution=false, resolutionScale=1 means native device pixels.
    // With useBrowserRecommendedResolution=true (balanced), resolutionScale=1 means CSS pixels.
    viewer.value.resolutionScale = 1.0;
    
    // 渲染精度优化与环境清理
    // Higher quality terrain/imagery LOD for crisp WMS/CLCD rendering (especially on HiDPI).
    // Keep a softer profile for problematic Chrome/GPU setups via ?cesium_profile=balanced.
    viewer.value.scene.globe.maximumScreenSpaceError = cesiumProfile === 'hq' ? 2.0 : 3.5;
    viewer.value.scene.globe.tileCacheSize = cesiumProfile === 'hq' ? 50 : 30;
    viewer.value.scene.globe.showGroundAtmosphere = false; // 彻底禁用地面大气效果
    viewer.value.scene.fog.enabled = false; // 禁用雾效 (彻底净化)
    viewer.value.scene.skyBox = undefined;
    if (viewer.value.scene.skyAtmosphere) viewer.value.scene.skyAtmosphere.show = false;
    if (viewer.value.scene.sun) viewer.value.scene.sun.show = false;
    if (viewer.value.scene.moon) viewer.value.scene.moon.show = false;
    viewer.value.scene.globe.enableLighting = false;
    viewer.value.targetFrameRate = 60;
    
    // 强制锁定垂直视角：禁用倾斜交互
    viewer.value.scene.screenSpaceCameraController.enableTilt = false; 
    
    viewer.value.cesiumWidget.creditContainer.style.display = "none";
    
    // 禁用双击缩放
    viewer.value.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    
    // 锁定相机：禁用倾斜和查看模式，确保视角始终垂直向下
    viewer.value.scene.screenSpaceCameraController.enableTilt = false;
    viewer.value.scene.screenSpaceCameraController.enableLook = false;


    loadBaseMap('imagery');

    // 1. 加载全省县级 GeoJSON (仅用于后台属性查询与点击高亮，默认不显示背景线条)
    Cesium.GeoJsonDataSource.load('/data/yunnan_all_counties.geojson', {
      fill: Cesium.Color.TRANSPARENT,
      stroke: Cesium.Color.TRANSPARENT, // 禁用默认 1px 黑色边框生成
      strokeWidth: 0, //彻底关闭底层几何边线构建，加速 GeoJson 解析时的庞大 CPU 开销
      markerSize: 0
    }).then(function (dataSource) {
      yunnanDataSource.value = dataSource;
      viewer.value.dataSources.add(dataSource);
      
       const entities = dataSource.entities.values;
       for (let i = 0; i < entities.length; i++) {
         const entity = entities[i];
         if (entity.polygon) {
             // 保持填充以支持拾取，但设为近乎透明
             entity.polygon.fill = true; 
             entity.polygon.material = Cesium.Color.WHITE.withAlpha(0.01);
             entity.polygon.outline = false; 
         }
         // 彻底隐藏初始化时的默认线条
         if (entity.polyline) entity.polyline.show = false;
       }
       // 默认隐藏数据源，仅在 highlightRegion 时通过 entity.show 控制
       dataSource.show = true; 
    }).catch(e => {
        console.error('Failed to load county vector data:', e);
    });

    
    
    setYunnanFullView();

    window.cesiumViewer = viewer.value;
    mapStore.setViewer(viewer.value);

    countyLabelMoveEndHandler = () => {
      applyCountyLabelLayout();
      requestSceneRender();
    };
    viewer.value.camera.moveEnd.addEventListener(countyLabelMoveEndHandler);

    // 初始化视图锁定逻辑
    setupViewLock();
    // 设置鼠标事件
    setupClickHandler();
    
    // 微调默认视角拉伸系数，避免 UI 边缘黑边 (Cesium 默认 3.0, 加大给 flyTo 留出周围边距)
    Cesium.Camera.DEFAULT_VIEW_FACTOR = 4.5;

    if (spatialUnit.value === 'clcd') {
        loadStandardLayer(selectedYear.value, true, scopeRequestId);
        loadYearData(selectedYear.value);
    } else {
        loadWMSLayer(selectedYear.value);
    }

    // 挂载全局按键拦截
    window.addEventListener('keydown', handleGlobalEnter, true);
  } catch (e) {
    console.error('Cesium initialization error:', e);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalEnter, true);
  window.removeEventListener('clearCountyHighlight', handleClearCountyHighlight);
  if (viewer.value?.camera && countyLabelMoveEndHandler) {
    viewer.value.camera.moveEnd.removeEventListener(countyLabelMoveEndHandler);
    countyLabelMoveEndHandler = null;
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
        // 点在相机背面，不一定是完全不可见，但对于判定滑移出来说，这里的点查询可能失败
        // 我们通过检查相机锥体是否包含云南矩形来辅助判断
        continue;
      }
    }

    // 如果关键边界点都消失在同一侧，或锥体完全不相交
    const viewRect = viewer.value.camera.computeViewRectangle();
    const isIntersecting = viewRect ? Cesium.Rectangle.intersection(viewRect, Cesium.Rectangle.fromDegrees(YUNNAN_RECT.west, YUNNAN_RECT.south, YUNNAN_RECT.east, YUNNAN_RECT.north)) : true;

    // 新增：高度限制判定，防止缩放过小
    // 默认高度约 1.9M，超过 5M (5000km) 则判定为缩放过小
    const currentHeight = viewer.value.camera.positionCartographic.height;
    const MAX_ALTITUDE = 5000000; 
    const isTooFar = currentHeight > MAX_ALTITUDE;

    const isOutOfControl = (!anyPointVisible && (allLeft || allRight || allTop || allBottom || !isIntersecting)) || isTooFar;

    if (isOutOfControl) {
      if (isTooFar) {
         console.warn('[ViewLock] 缩放跨度过大，即将自动复位...');
      } else {
         console.warn('[ViewLock] 云南已移出视野，即将自动复位...');
      }
      
      if (!outOfBoundsTimer) {
        outOfBoundsTimer = setTimeout(() => {
          // console.log('[ViewLock] 执行视角复位');
          flyToYunnanFullView(1.5);
          outOfBoundsTimer = null;
        }, isTooFar ? 500 : BUFFER_TIME); // 如果缩得过大，缩短等待时间
      }
    } else {
      if (outOfBoundsTimer) {
        clearTimeout(outOfBoundsTimer);
        outOfBoundsTimer = null;
      }
    }
  });
}

// (土地使用?loadYearData 已在下方实现)



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
      // 使用天地图矢量底图作为分析模式底图
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
function loadStandardLayer(year, visible = true, rid = null) {
  if (!viewer.value) return;

  // 如果提供了 RID 且已经过时，则不执行加载
  if (rid !== null && rid < scopeRequestId) {
    console.log(`[Workbench] Discarding outdated scope request: ${rid} (current: ${scopeRequestId})`);
    return;
  }
  
  // 校验年份有效?
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

  // 动态确定图层名称列表
  const pinyins = globalStore.currentPinyins;
  // 如果有特定区域拼音列表（如县级），加载对应拼图层；否则回到全省 ImageMosaic 图层
  const layers = (pinyins && pinyins.length > 0)
    ? pinyins.map(py => `WebGIS:county_${py}`).join(',')
    : GEOSERVER_CONFIG.layers.yunnanTime;


  // 包含裁剪信息的缓存键
  const scopeKey = globalStore.scope.level === 'province' ? 'all' : globalStore.scope.name;
  const clipSuffix = currentClipWKT.value ? `_clip_${currentClipWKT.value.length}` : '';
  const cacheKey = `clcd_${year}_${scopeKey}${clipSuffix}`;
  
  // 查缓?
  if (clcdLayerCache.has(cacheKey)) {
    const cachedLayer = clcdLayerCache.get(cacheKey);
    if (visible) {
      updateLayerVisibility(cacheKey, lastRequestId.value, true);
      clcdLayer.value = cachedLayer;
    }
    return;
  }

  try {
    const interpolationParam = layers
      .split(',')
      .map(() => 'nearest neighbor')
      .join(',');
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_CONFIG.wmsUrl,
      layers: layers,
      tileWidth: 512,
      tileHeight: 512,
      parameters: {
        service: 'WMS',
        version: '1.1.1',
        request: 'GetMap',
        format: 'image/png',
        transparent: true,
        interpolations: interpolationParam,
        time: `${year}-01-01`,
        // 仅全省图层需要 clip 裁剪，县市级图层数据集已是区域范围，不需要 clip
        ...(currentClipWKT.value && globalStore.scope.level === 'province' ? { clip: currentClipWKT.value } : {})
      }
    });

    const newLayer = new Cesium.ImageryLayer(provider);
    newLayer.isAnalysisLayer = true;
    newLayer.alpha = 0; // 预加载默认透明
    newLayer.show = true;

    // 【二次防御】在真正加入地图前再次检查 RID，防止异步 Provider 初始化期间 Scope 发生变化
    if (rid !== null && rid < scopeRequestId) {
        console.log(`[Workbench] Discarding late layer addition for request: ${rid}`);
        return;
    }
    
    // 加入缓存
    clcdLayerCache.set(cacheKey, newLayer);
    
    // 如果要显示，执渐变切换
    if (visible) {
      updateLayerVisibility(cacheKey, lastRequestId.value, true);
      clcdLayer.value = newLayer;
    } else {
      // 仅加入场景但不切换显示
      if (!viewer.value.imageryLayers.contains(newLayer)) {
        viewer.value.imageryLayers.add(newLayer);
      }
    }
    
  } catch (e) {
    console.error(`加载 ${year} 的 CLCD 动态图层 [${layers}] 失败:`, e);
  }
}

// (土地流转 handleTransferQuery / handleResetMap 已在上方?28行新版实?


// 区域分析模式图层加载 (Regional Analysis WMS)
async function loadWMSLayer(targetYear = null, visible = true, reqId = null) {
  // 专题分析模式（流转率分析）不使用 WMS 缓存逻辑，避免调用 breaks API 产生 400 错误
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
  
  // 包含裁剪信息的缓存键
  const clipSuffix = currentClipWKT.value ? `_clip_${currentClipWKT.value.length}` : '';
  const cacheKey = isChangeMode.value 
    ? `change_${changeYearFrom.value}_${changeYearTo.value}_${spatialUnit.value}_${selectedAttribute.value}${clipSuffix}`
    : `${year}_${spatialUnit.value}_${selectedAttribute.value}${clipSuffix}`;

  // 1. 如果缓存中存在，验证其是否被外部强制销毁以防崩溃
  if (wmsLayerCache.has(cacheKey)) {
    const cachedLayer = wmsLayerCache.get(cacheKey);
    console.log('[WMS] Cache HIT:', cacheKey);
    if (cachedLayer && typeof cachedLayer.isDestroyed === 'function' && cachedLayer.isDestroyed()) {
      console.warn('[WMS] Cached layer was destroyed, removing from cache.');
      wmsLayerCache.delete(cacheKey);
    } else {
      if (visible) {
          // 命中缓存，如果是当前主年份，也要刷新一下图例标签
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

    // 生成 SLD 变量参数
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
          interpolations: 'nearest neighbor',
          styles: styleName,
          env: envParams,
          info_format: 'application/json',
          ...(currentClipWKT.value ? { clip: currentClipWKT.value } : {})
    };

    // console.log('[Workbench] Adding WMS Provider:', { layerName, wmsParameters });

    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: GEOSERVER_CONFIG.wmsUrl,
      layers: layerName,
      tileWidth: 512,
      tileHeight: 512,
      enablePickFeatures: true,
      parameters: wmsParameters
    });

    const newLayer = new Cesium.ImageryLayer(wmsProvider);
    // 关键改变：加载时就加入地图（alpha=0），如果需要立即显示则设为 1
    newLayer.alpha = visible ? 1 : 0; 
    newLayer.show = true;
    newLayer.isAnalysisLayer = true; // 打上分析图层标记，防止析构

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
 * 采用 Alpha 通道交叉渐变算法实现丝滑切换
 */
function updateLayerVisibility(targetKey, reqId = null, isClcd = false) {
    if (reqId && reqId < lastRequestId.value) return;
    
    const cache = isClcd ? clcdLayerCache : wmsLayerCache;
    const targetLayer = cache.get(targetKey);
    if (!targetLayer || !viewer.value) return;

    // 1. 甄别模式对应的当前图层引用
    const previousLayer = isClcd ? clcdLayer.value : spatialLayer.value;
    const isSameLayer = previousLayer === targetLayer;

    // 清理其他非目标非当前动画层的状态
    cache.forEach((layer, key) => {
        if (layer !== targetLayer && layer !== previousLayer) {
            layer.show = false;
            layer.alpha = 0;
            if (viewer.value.imageryLayers.contains(layer)) {
                // If the user wants strictly memory clean, we could remove it. 
                // But hiding is enough for fast switching.
            }
        }
    });

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
        const duration = 350; // 优化后更紧凑的渐变时间 (350ms)
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;
            
            if (progress < 1) {
                // 如果用户已经快速切换至更新的年份，则停止当前动画
                const currentActiveKey = isClcd ? `clcd_${selectedYear.value}` : activeWmsKey.value;
                if (
                    activeWmsKey.value === targetKey ||
                    (isClcd && (function() {
                        // 兼容新旧两种 cacheKey 格式
                        // 旧: yunnan_1985  新: clcd_1985_xxx
                        const parts = targetKey.split('_');
                        const yr = parts[0] === 'clcd' ? Number(parts[1]) : Number(parts[parts.length - 1]);
                        return yr === selectedYear.value;
                    })())
                ) {
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

    // 4. 同更新视图引用
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
    
    // 正确解析年份 (支持 clcd_YYYY_scope 格式)
    const getYearFromKey = (key) => {
        const parts = key.split('_');
        return isClcd ? (parts[0] === 'clcd' ? parseInt(parts[1]) : parseInt(parts[parts.length - 1])) : parseInt(parts[0]);
    };
    
    const activeYear = getYearFromKey(activeKey);
    if (isNaN(activeYear)) return;

    cache.forEach((layer, key) => {
        const layerYear = getYearFromKey(key);
        // 如果是 CLCD 模式，除了非相近年份要清理，还要清理同一时间内的不同范围切片
        // （比如从“曲靖”切换到“昭通”，旧范围应该回收/隐藏，避免内存积压）
        const isDistantYear = Math.abs(layerYear - activeYear) > 7;
        const isDifferentScopeInClcd = isClcd && key !== activeKey && layerYear === activeYear;

        if ((isDistantYear || isDifferentScopeInClcd) && key !== activeKey) {
            if (layer.show) {
                layer.show = false;
                layer.alpha = 0;
            }
            // 考虑直接移除影像图层来释放显存
            if (viewer.value && viewer.value.imageryLayers.contains(layer) && cache === clcdLayerCache) {
                 viewer.value.imageryLayers.remove(layer, true); // 移除图层节约 WebGL 资源
                 cache.delete(key);
            }
        }
    });

    // 额外的分析层级维护（如果是 WMS 统计模式）
    if (!isClcd) {
       cleanupCLCDLayer(); // 统计模式下清理非缓存的静态 CLCD 层
    }
}

// 提取图例标更新函数
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
    
    // 并发请求所有年份断点
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
  if (!viewer.value) return;
  
  // 1. 采用暴力清理逻辑，直接拔除所有标记为业务分析层的 ImageryLayers
  clearAllAnalysisLayers(viewer.value);

  // 2. 同时清理内存业务 Map 缓存，防止 key 冲突
  wmsLayerCache.clear();
  clcdLayerCache.clear();
  
  // 3. 重置所有顶级引用
  spatialLayer.value = null;
  clcdLayer.value = null;
  activeWmsKey.value = null;
}

// 暴力清理残留的spatial_”开头的图层
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

// 切换：退出区域分析 (返回工作区)
function exitRegionalAnalysis() {
  isRegionalAnalysisMode.value = false;
  
  // 清理 Regional Layers
  clearWMSCache();
  
  // 恢复 Standard CLCD
  loadStandardLayer(selectedYear.value, true, scopeRequestId);
}

// 跳转到区域推测分析页面 (Deprecated: Now acts as Switcher)
function goToRegionalAnalysis() {
  // router.push('/regional-analysis'); // Old
  // console.log('[Workbench] Switching to Regional Analysis Mode');
  enterRegionalAnalysis();
}

onUnmounted(() => {
  if (autoSwitchTipTimer) {
    window.clearTimeout(autoSwitchTipTimer);
    autoSwitchTipTimer = null;
  }
  if (isPopupPostRenderBound && viewer.value?.scene?.postRender) {
    viewer.value.scene.postRender.removeEventListener(updatePopupPosition);
    isPopupPostRenderBound = false;
  }
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
  
  // 5. 清除 mapStore 业 viewer 引用
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

  // console.log('[Workbench] Cleanup complete');
});

/**
 * 核心逻辑：实时计算提示的屏幕位置与缩放比例
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
        // 设定标准距离 (比如 100km)，在该距离下比例为 1.0
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

watch(
  () => selectedEntity.value,
  (entity) => {
    if (!entity) {
      lastPickPosition = null;
      popupStyle.value.display = 'none';
    }
    syncPopupPostRenderListener();
    requestSceneRender();
  },
  { deep: true }
);

// 空间图层逻辑已平移
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
  pointer-events: auto; /* 确保容器内是可操作的 */
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



/* 统一地图浮动图例位置 - 绝对精准的固定悬浮 */
.map-floating-legend {
  z-index: 1000;
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
  /* 定位现在由 AnalysisLegend 组件内部的拖拽状态 (posX/posY) 驱动 */
}

.region-switch-tip {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3200;
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(26, 64, 132, 0.88);
  color: #eef5ff;
  font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.2px;
  box-shadow: 0 8px 20px rgba(7, 26, 61, 0.36);
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.region-switch-tip-fade-enter-active,
.region-switch-tip-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.region-switch-tip-fade-enter-from,
.region-switch-tip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px);
}

/* 信息提示框 - Glassmorphism Pro Max */
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
  margin-right: -8px; /* 抵消 gap，确保右侧按钮对齐 */
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
  --panel-font-base: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
  --panel-font-title: 'YouSheBiaoTiHei', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --panel-font-number: 'YouSheBiaoTiHei', 'Dosis', 'Orbitron', 'Consolas', sans-serif;
  position: fixed;
  top: 90px; 
  bottom: auto;
  width: 500px; /* 进一步扩宽至 500px，确保内容 480px 组件及阴影完全不受限 */
  z-index: 2000;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: visible; /* 强制父容器不裁剪子项阴影 */
  font-family: var(--panel-font-base);
}

/* 全局面板字体统一：正文 */
.analysis-wing .panel-shell,
.analysis-wing .panel-shell * {
  font-family: var(--panel-font-base) !important;
}

/* 标题字体 */
.analysis-wing .panel-shell .head-title,
.analysis-wing .panel-shell .step-title,
.analysis-wing .panel-shell .route-title,
.analysis-wing .panel-shell .list-title {
  font-family: var(--panel-font-title) !important;
  letter-spacing: 0.5px;
}

/* 数值字体（右图风格） */
.analysis-wing .panel-shell .kpi strong,
.analysis-wing .panel-shell .s-dist,
.analysis-wing .panel-shell .p-val,
.analysis-wing .panel-shell .metric-big-num,
.analysis-wing .panel-shell .score-val {
  font-family: var(--panel-font-number) !important;
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
  /* 采用 transform 的过渡，不执行 opacity。因为父元素的 opacity 过渡会导致所有子元素的 backdrop-filter 毛玻璃特效在过渡期间直接失效并变黑 (Chromium 内核的一个问题) */
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
