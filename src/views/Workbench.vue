<template>
  <div id="cesiumContainerWrapper">
    <!-- 背景遮罩层与地图掩膜层：Dashboard模式下隐藏，增加过渡动画 -->
    <transition name="layer-fade">
      <div v-if="!isDashboardMode" class="background-layer"></div>
    </transition>
    
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
    <div v-if="isRegionalAnalysisMode" class="floating-legend glass-panel">
      <div class="legend-header">
        <div class="legend-title">{{ currentAttributeLabel }}</div>
        <div class="legend-subtitle">{{ selectedYear }}年分布状况</div>
      </div>
      <div class="legend-items">
        <div class="legend-gradient-bar" v-if="currentColorScale">
          <div 
            v-for="(color, index) in currentColorScale" 
            :key="index"
            class="gradient-stop"
            :style="{ backgroundColor: color }"
          ></div>
        </div>
        <div class="legend-labels">
          <span>低</span>
          <span>高</span>
        </div>
      </div>
    </div>
    <!-- 顶部统一工具栏 Container -->
    <div v-if="!isDashboardMode" class="main-toolbar">
      
      <!-- 年份选择器 -->
      <YearRangeSelector v-model:selectedYear="selectedYear" :width="200" />

      <!-- 图层类型选择器 -->
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

    </div>

    <!-- 底图选择器（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="basemap-selector-container">
      <BaseMapSelector @change="handleBaseMapChange" />
    </div>

    <!-- 底部控制按钮组（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="bottom-controls-container">
      <ViewResetControl />
      <DistanceMeasureButton />
      <AreaMeasureButton />
      <EChartsPrefecturePie :year="selectedYear" />
      <EChartsCountyPie :year="selectedYear" />
      <LandUseTrendControl :seriesData="cachedClcdData" />
      <RegionalTrendControl />
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
import SpatialLayerSelector from '../components/controls/SpatialLayerSelector.vue';
import DashboardOverlay from './DashboardOverlay.vue';
import TimePlayer from '../components/controls/TimePlayer.vue'; // New Import
import { useMapStore } from '../stores/map.ts';
import { useGlobalStore } from '../stores/index.ts'; // New Import
import { clcdApi, authApi } from '../api/index.js';
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
const wmsLayerCache = new Map(); // Map<year, Cesium.ImageryLayer>
const years = ref([]); // will be populated
const currentLegendLabels = ref([]); // Dynamic labels for WMS layer

// Constant definitions
const clcdColors = {
  cropland: '#FFFF64',
  forest: '#006400',
  shrub: '#00FF00',
  grassland: '#78FF05',
  water: '#0046C8',
  snow_ice: '#FF46C8', // Corrected from Regional (usually white/pink in CLCD)
  barren: '#A0A0A0',
  impervious: '#DC143C',
  wetland: '#64FFFF'
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

// Sync years with global store
const availableYears = computed(() => {
  const start = globalStore.timeRange.start;
  const end = globalStore.timeRange.end;
  const yearsArr = [];
  for (let y = start; y <= end; y++) {
    yearsArr.push(y);
  }
  return yearsArr;
});

// ... (Colors and Attribute definitions remain same)

// 响应年份变化，自动更新图层
watch(selectedYear, (newYear, oldYear) => {
  if (viewer.value && newYear !== oldYear) {
    loadYearData(newYear); // Always update global stats/charts
    
    if (spatialUnit.value === 'clcd') {
      loadStandardLayer(newYear);
    } else {
      loadWMSLayer(newYear);
    }
  }
});

// 响应区域分析参数变化 (图层切换 & 属性切换)
watch([spatialUnit, selectedAttribute], ([newUnit, newAttr], [oldUnit, oldAttr]) => {
  clearWMSCache(); // Always clear cache on mode switch

  if (newUnit === 'clcd') {
    // Switch to Standard
    loadStandardLayer(selectedYear.value);
    loadYearData(selectedYear.value);
  } else {
    console.log('[Workbench] Switching to analysis mode, removing CLCD layer...');
    // Switch to Regional
    if (clcdLayer.value) {
      console.log('[Workbench] Removing CLCD Layer:', clcdLayer.value);
      viewer.value.imageryLayers.remove(clcdLayer.value, true);
      clcdLayer.value = null;
    } else {
        console.warn('[Workbench] CLCD Layer ref is null, cannot remove.');
    }
    loadWMSLayer(selectedYear.value);
  }
});

// ... (other refs)

// ...

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

    // ... (Yunnan Boundary Loading)
    Cesium.GeoJsonDataSource.load('/data/yunnan_boundary.geo.json', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF'),
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 10,
      markerSize: 0,
      clampToGround: true
    }).then(function (dataSource) {
       viewer.value.dataSources.add(dataSource);
       // ... (entity styling loop)
       const entities = dataSource.entities.values;
      for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        const name = entity.properties.name ? entity.properties.name.getValue() : '';
        const code = entity.properties.code ? entity.properties.code.getValue() : '';

        if (name.includes('云南') || code == '530000') {
           if (entity.polyline) {
             entity.polyline.width = 10;
             entity.polyline.material = new Cesium.PolylineOutlineMaterialProperty({
                color: Cesium.Color.fromCssColorString('#00E5FF'),
                outlineColor: Cesium.Color.fromCssColorString('#00838F'),
                outlineWidth: 6
             });
             entity.polyline.clampToGround = true;
           }
           if (entity.polygon) {
             entity.polygon.fill = false;
             entity.polygon.outline = true;
             entity.polygon.outlineColor = Cesium.Color.fromCssColorString('#00E5FF');
             entity.polygon.outlineWidth = 6;
           }
        } else {
             dataSource.entities.remove(entity);
        }
      } 
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

// 响应图层类型变化
watch(spatialUnit, (newUnit, oldUnit) => {
  if (viewer.value && newUnit !== oldUnit) {
    console.log('[Workbench] Layer type changed:', newUnit);
    clearWMSCache(); // Clear any WMS cache from previous mode
    
    if (newUnit === 'clcd') {
      loadStandardLayer(selectedYear.value);
    } else {
      // Remove CLCD layer when switching to analysis mode
      if (clcdLayer.value) {
        viewer.value.imageryLayers.remove(clcdLayer.value, true);
        clcdLayer.value = null;
      }
      
      // Auto-switch away from 'shrub' in grid mode since it's hidden/merged
      if (newUnit === 'grid' && selectedAttribute.value === 'shrub') {
          console.log('[Workbench] Auto-switching attribute from Shrub to Grassland for Grid mode');
          selectedAttribute.value = 'grassland';
          // This will trigger the selectedAttribute watcher, so we don't need to call loadWMSLayer here
          // BUT, to be safe and avoid race conditions or double loading, we can let the watcher handle it.
          // However, we are inside a watcher callback. Changing state here triggers another watcher? Yes.
          // But loadWMSLayer is formatted to be synchronous-ish in setup.
          // If we change selectedAttribute, the selectedAttribute watcher fires.
          return; 
      }
      
      loadWMSLayer(selectedYear.value);
    }
  }
});

// 响应属性变化
watch(selectedAttribute, (newAttr, oldAttr) => {
  if (viewer.value && spatialUnit.value !== 'clcd' && newAttr !== oldAttr) {
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

// 区域分析模式图层加载 (Regional Analysis WMS)
async function loadWMSLayer(targetYear = null, visible = true) {
  if (!viewer.value) {
    return;
  }

  const year = targetYear || selectedYear.value;
  
  // Cache key must include year, spatialUnit, and attribute to avoid stale hits
  const cacheKey = `${year}_${spatialUnit.value}_${selectedAttribute.value}`;

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
    const method = spatialUnit.value === 'grid' ? 'quantile' : 'jenks';
    const numClasses = 10;
    
    const token = localStorage.getItem('auth_token');
    const url = `/api/clcd/breaks?attr=${selectedAttribute.value}&year=${year}&method=${method}&classes=${numClasses}&unit=${spatialUnit.value}`;
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        console.error('[Workbench] Breaks API failed:', response.status, response.statusText);
        throw new Error(`API error: ${response.status}`);
    }

    const breaksData = await response.json();
    console.log('[Workbench] Breaks Data:', breaksData);
    
    let breaks = breaksData.breaks;
    const dynamicAttr = breaksData.field;

    while (breaks.length < numClasses + 1) breaks.push(breaks[breaks.length - 1]);
    
    // Update labels only for current main year
    if (year === selectedYear.value) {
       const labels = [];
       for (let i = 0; i < numClasses; i++) {
          const formatNum = (num) => num < 10 ? num.toFixed(2) : Math.round(num);
          const minValStr = formatNum(breaks[i]);
          const maxValStr = formatNum(breaks[i+1]);
          if (i > 0 && breaks[i] === breaks[breaks.length-1]) break;
          labels.push(`${minValStr}-${maxValStr}`);
       }
       currentLegendLabels.value = labels;
    }
    
    let envParams = `attr:${dynamicAttr}`;
    for (let i = 1; i < numClasses; i++) {
        const val = i < breaks.length - 1 ? breaks[i] : breaks[breaks.length - 1];
        const valSqM = Math.round(val * 1000000); 
        envParams += `;th${i}:${valSqM}`;
    }
    
    const styleName = `${selectedAttribute.value}_dynamic`;
    
    // CRITICAL DEBUG LOG
    console.log('[Workbench] WMS Debug Info:', {
        year,
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

    wmsLayerCache.set(cacheKey, newLayer);

    if (visible) {
        console.log('[Workbench] Setting layer visible:', cacheKey);
        updateLayerVisibility(cacheKey);
    }
    
  } catch (err) {
    console.error('[Workbench] Failed to load WMS:', err);
  }
}

function updateLayerVisibility(targetKey) {
    console.log('[Workbench] updateLayerVisibility called for:', targetKey);
    console.log('[Workbench] Cache has keys:', [...wmsLayerCache.keys()]);
    
    // Ensure CLCD layer is gone (Brute Force Check)
    cleanupCLCDLayer();

    const targetLayer = wmsLayerCache.get(targetKey);
    if (targetLayer) {
        console.log('[Workbench] Found layer in cache, setting alpha to 1 and raising to top');
        targetLayer.alpha = 1;
        targetLayer.show = true;
        if (viewer.value && !viewer.value.isDestroyed()) {
             viewer.value.imageryLayers.raiseToTop(targetLayer);
        }
        spatialLayer.value = targetLayer; 
    } else {
        console.warn('[Workbench] Layer NOT found in cache for key:', targetKey);
    }

    // Hide all other layers
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

/* Main Toolbar Container (Flexbox) */
.main-toolbar {
  position: fixed;
  top: 40px;
  left: 20px;
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 20px; /* Consistent spacing between all controls */
}

.basemap-selector-container {
  position: fixed;
  top: 40px;
  right: 80px; /* Move to right side to avoid conflicts */
  left: auto;
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
  bottom: 0px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
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
  top: 100px;
  right: 20px;
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
  bottom: 120px; /* Adjusted to sit above TimePlayer which is at 10px */
  right: 24px;
  background: rgba(15, 23, 42, 0.6); 
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 16px;
  z-index: 900;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  min-width: 140px;
}

.floating-legend .legend-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  border: none;
  padding: 0;
}

.floating-legend .legend-subtitle {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 12px;
}

.floating-legend .legend-items {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.floating-legend .legend-gradient-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  flex: 1;
  border: 1px solid rgba(255,255,255,0.1);
}

.floating-legend .gradient-stop {
  flex: 1;
  height: 100%;
}

.floating-legend .legend-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  margin-left: 8px;
}

</style>
