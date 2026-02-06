<template>
  <div class="regional-analysis-page">
    <div id="cesiumContainer" class="map-container"></div>
    <!-- 顶部悬浮控制面板 -->
    <div class="analysis-header floating-glass">
      <div class="header-left">
        <button class="back-btn-circle" @click="goBack" title="返回工作台">
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

        <!-- 年份 -->
        <div class="glass-select-wrapper">
          <svg class="select-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <select v-model="selectedYear">
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
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
          <select v-model="currentBaseMap" @change="loadBaseMap(currentBaseMap)">
             <option v-for="opt in baseMapOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

      </div>
    </div>

    <!-- 图例 -->
    <div class="legend-container">
      <div class="legend-title">{{ currentAttributeLabel }} ({{ selectedYear }}年)</div>
      <div class="legend-items">
        <div v-for="(color, index) in currentColorScale" :key="index" class="legend-item">
          <span class="legend-color" :style="{ background: color }"></span>
          <span class="legend-label">{{ currentLegendLabels[index] }}</span>
        </div>
      </div>
      <div class="legend-unit">单位: km²</div>
    </div>

    <!-- 时间轴控制器 -->
    <div class="time-player-container" v-if="years.length > 0">
      <!-- 极简模式播放器 -->
      <TimePlayer 
        :years="years"
        v-model="selectedYear"
        :interval="500"
      />
    </div>

    <!-- 区域信息悬浮提示 -->
    <div v-if="selectedEntity" class="info-tooltip" :style="popupStyle">
      <div class="tooltip-title">{{ selectedEntity.name }}</div>
      <div v-for="(value, key) in selectedEntity.properties" :key="key" class="tooltip-row">
        <span class="tooltip-label">{{ key }}:</span>
        <span class="tooltip-value">{{ value }}</span>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <span>正在加载空间数据...</span>
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as Cesium from 'cesium';
import { clcdApi } from '../api/index.js';
import TimePlayer from '../components/controls/TimePlayer.vue';
import { useGlobalStore } from '../stores/index.ts';
import 'cesium/Build/Cesium/Widgets/widgets.css';

const router = useRouter();
const store = useGlobalStore();

const viewer = shallowRef(null);
const baseMapLayer = shallowRef(null);
const spatialLayer = shallowRef(null);
const dataSource = shallowRef(null);

// 声明 clickHandler 用于事件处理器清理
let clickHandler = null;

const isLoading = ref(false);
const currentStatsField = ref(null);
const spatialUnit = ref('county');
const selectedAttribute = ref('cropland');
// sync selectedYear with store
const selectedYear = computed({
  get: () => store.currentYear,
  set: (val) => store.setYear(val)
});

// Cache for WMS layers to support smooth playback
const wmsLayerCache = new Map(); // Map<year, Cesium.ImageryLayer>
const years = ref([]);

// 监听年份变化，重新加载图层
watch(selectedYear, (newVal) => {
    loadWMSLayer();
});

// ... rest of imports ...

// 底图切换
const currentBaseMap = ref('imagery');
const baseMapExpanded = ref(false);
const baseMapOptions = [
  { value: 'imagery', label: '天地图影像' },
  { value: 'vector', label: '天地图矢量' },
  { value: 'terrain', label: '天地图地形' }
];

const legendBreaks = ref([]);
const selectedEntity = ref(null);
const popupStyle = ref({ left: '0px', top: '0px' });

// 各地类的图例配置（颜色 + 分级范围）
// 10级颜色方案配置 (与 GeoServer SLD 同步)
const legendConfigs = {
  cropland: {
    colors: ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506', '#401200'], 
    labels: []
  },
  forest: {
    colors: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b', '#00220e'], 
    labels: []
  },
  shrub: {
    colors: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529', '#002818'], 
    labels: []
  },
  grassland: {
    colors: ['#ffffcc', '#e4f4ac', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#042040'],
    labels: []
  },
  water: {
    colors: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b', '#041836'], 
    labels: []
  },
  wetland: {
    colors: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081', '#042040'], 
    labels: []
  },
  impervious: {
    colors: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d', '#400008'], 
    labels: []
  },
  barren: {
    colors: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#111111', '#000000'],
    labels: []
  },
  snow_ice: {
    colors: ['#f7fcfd', '#e0ecf4', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#810f7c', '#4d004b', '#270026'],
    labels: []
  }
};

// 获取当前属性的颜色列表
const currentColorScale = computed(() => {
  return legendConfigs[selectedAttribute.value]?.colors || legendConfigs.cropland.colors;
});

// 获取当前属性的图例标签
// 获取当前属性的图例标签 (Ref, 动态更新)
const currentLegendLabels = ref([]);

const attributes = [
  { value: 'cropland', label: '耕地面积' },
  { value: 'forest', label: '林地面积' },
  { value: 'shrub', label: '灌木面积' },
  { value: 'grassland', label: '草地面积' },
  { value: 'water', label: '水域面积' },
  { value: 'wetland', label: '湿地面积' },
  { value: 'impervious', label: '建设用地面积' },
  { value: 'barren', label: '裸地面积' },
  { value: 'snow_ice', label: '冰雪面积' }
];

const currentAttributeLabel = computed(() => {
  const attr = attributes.find(a => a.value === selectedAttribute.value);
  return attr ? attr.label : '';
});

function goBack() {
  cleanupData();
  router.push('/workbench');
}

function cleanupData() {
  // 更彻底地清理 DataSource，包括其中的 entities
  if (viewer.value && dataSource.value) {
    try {
      // 先清空 entities 再移除 dataSource
      if (dataSource.value.entities) {
        dataSource.value.entities.removeAll();
      }
      viewer.value.dataSources.remove(dataSource.value, true); // true 表示同时销毁
    } catch (e) {
      console.warn('[RegionalAnalysis] DataSource cleanup warning:', e);
    }
    dataSource.value = null;
  }
  // 同时移除空间 WMS 图层
  if (viewer.value && spatialLayer.value) {
    try {
      viewer.value.imageryLayers.remove(spatialLayer.value, true); // true 表示同时销毁
    } catch (e) {
      console.warn('[RegionalAnalysis] SpatialLayer cleanup warning:', e);
    }
    spatialLayer.value = null;
  }
  legendBreaks.value = [];
  selectedEntity.value = null;
}

// 空间单元变化监听
// 空间单元变化监听
watch(spatialUnit, (newUnit, oldUnit) => {
  if (newUnit !== oldUnit) {
    console.log(`[RegionalAnalysis] Spatial unit changed to ${newUnit}`);
    clearWMSCache(); // Clear cache to prevent showing wrong layers
    loadWMSLayer();
  }
});

// 监听年份变化，自动刷新 WMS 图层
watch(selectedYear, () => {
  console.log('[RegionalAnalysis] Year changed, updating WMS...');
  loadWMSLayer(false); // Silent update for smooth playback
});

// 监听分析指标变化，更新 WMS 样式
// 监听分析指标变化，更新 WMS 样式
watch(selectedAttribute, () => {
  console.log('[RegionalAnalysis] Attribute changed, updating WMS style...');
  clearWMSCache(); // Clear cache to prevent showing wrong layers
  loadWMSLayer();
});

async function fetchYears() {
  try {
    const data = await clcdApi.getAvailableYears();
    years.value = data || [];
    
    // Sync with global store for TimeController
    store.setYearsAll(years.value);
    
    if (years.value.length > 0) {
       // If current store year is invalid, set to valid year
       if (!years.value.includes(store.currentYear)) {
          store.setYear(years.value[years.value.length - 1]);
       }
    }
  } catch (err) {
    console.error('[RegionalAnalysis] Failed to fetch years:', err);
    // 回退默认值
    years.value = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2022];
    store.setYearsAll(years.value);
  }
}

onMounted(async () => {
  console.log('[RegionalAnalysis] Page mounted, checking token...');
  const token = localStorage.getItem('auth_token');
  if (!token) {
    console.warn('[RegionalAnalysis] No token found during mount, redirecting to login');
    router.push('/login');
    return;
  }

  // 优先获取年份列表
  await fetchYears();

  // 延迟初始化以确保 DOM 渲染
  setTimeout(async () => {
    await initCesium();
    // 自动触发第一次加载
    if (viewer.value) {
      console.log('[RegionalAnalysis] Auto-triggering initial WMS load...');
      // 使用纯 WMS 渲染模式，最省内存
      loadWMSLayer();
    }
  }, 300);
});

async function initCesium() {
  console.log('[RegionalAnalysis] Initializing Cesium...');
  try {
    const cesiumContainer = document.getElementById('cesiumContainer');
    if (!cesiumContainer) {
      console.error('[RegionalAnalysis] #cesiumContainer not found!');
      return;
    }

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
    
    // 基础设置
    viewer.value.scene.postProcessStages.fxaa.enabled = true;
    viewer.value.scene.highDynamicRange = true;
    viewer.value.resolutionScale = window.devicePixelRatio || 1.0;
    viewer.value.cesiumWidget.creditContainer.style.display = "none";
    viewer.value.scene.screenSpaceCameraController.enableTilt = false;
    
    // 加载底图
    loadBaseMap('imagery');
    
    // 加载云南省边界
    loadYunnanBoundary();

    // 飞到初始视角 (保持与 Workbench 云南范围一致)
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
      orientation: {
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });

  // 设置悬浮事件（鼠标移动时显示信息）
    let hoverDebounceTimer = null;
    let lastPickPosition = null;
    
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);
    clickHandler.setInputAction((movement) => {
      const position = movement.endPosition;
      
      // 1. 立即更新弹窗位置，实现丝滑跟随
      // 注意：这里使用的是当前鼠标位置，独立于数据请求
      // 居中显示：横向居中，纵向位于鼠标上方
      popupStyle.value = {
        left: position.x + 'px',
        top: position.y - 20 + 'px' // 上移 20px
      };
      
      // 防抖：避免过于频繁的请求
      if (hoverDebounceTimer) clearTimeout(hoverDebounceTimer);
      
      hoverDebounceTimer = setTimeout(() => {
        // 检查位置是否有显著变化（避免静止时重复查询）
        if (lastPickPosition && 
            Math.abs(position.x - lastPickPosition.x) < 5 && 
            Math.abs(position.y - lastPickPosition.y) < 5) {
          return;
        }
        lastPickPosition = { x: position.x, y: position.y };
        
        // 异步查询 WMS 特征
        const ray = viewer.value.camera.getPickRay(position);
        if (!ray) return;
        
        const featurePromise = viewer.value.scene.imageryLayers.pickImageryLayerFeatures(ray, viewer.value.scene);
        
        if (Cesium.defined(featurePromise)) {
            featurePromise.then(features => {
                if (features && features.length > 0) {
                    const feature = features[0];
                    const props = feature.properties || feature.data?.properties || {};
                    
                    // 获取区域名称
                    const regionName = props['地名'] || props['地级'] || props['省级'] || '未知区域';
                    const displayProps = {};
                    
                    // 提取动态属性
                    if (currentStatsField.value && props[currentStatsField.value] !== undefined) {
                        const rawVal = Number(props[currentStatsField.value]);
                        const valKm2 = (rawVal / 1000000).toFixed(2);
                        const attrLabel = currentAttributeLabel.value;
                        displayProps[attrLabel] = `${valKm2} km²`;
                    }
                    
                    selectedEntity.value = {
                        name: regionName,
                        properties: displayProps
                    };
                    
                    // 注意：不再此处更新位置，防止位置跳变回请求发起时的位置
                } else {
                    // 鼠标移出数据区域，隐藏弹窗
                    selectedEntity.value = null;
                }
            }).catch(() => {
                selectedEntity.value = null;
            });
        } else {
            selectedEntity.value = null;
        }
      }, 50); // 稍微降低防抖时间，提高响应速度
      
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    
    console.log('[RegionalAnalysis] Cesium initialized successfully');

  } catch (e) {
    console.error('[RegionalAnalysis] Cesium init error:', e);
  }
}

function loadBaseMap(mapType) {
  if (!viewer.value) return;
  
  if (baseMapLayer.value) {
    viewer.value.imageryLayers.remove(baseMapLayer.value);
    baseMapLayer.value = null;
  }

  const token = 'ab70e90828db5b27aa040f2cb879c7f1';
  
  // 底图配置
  const baseMapConfigs = {
    imagery: { layer: 'img', labelLayer: 'cia', name: '天地图影像' },
    vector: { layer: 'vec', labelLayer: 'cva', name: '天地图矢量' },
    terrain: { layer: 'ter', labelLayer: 'cta', name: '天地图地形' }
  };
  
  const config = baseMapConfigs[mapType] || baseMapConfigs.imagery;

  try {
    // 加载底图图层
    const baseUrl = `http://t0.tianditu.gov.cn/${config.layer}_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${config.layer}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
    
    const imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
      url: baseUrl,
      layer: config.layer,
      style: 'default',
      format: 'image/jpeg',
      tileMatrixSetID: 'w',
      maximumLevel: 18
    });
    baseMapLayer.value = viewer.value.imageryLayers.addImageryProvider(imageryProvider, 0);
    
    // 更新当前底图类型
    currentBaseMap.value = mapType;
    console.log(`[RegionalAnalysis] Base map changed to: ${config.name}`);
  } catch (e) {
    console.error('Failed to load base map:', e);
  }
}

async function loadYunnanBoundary() {
  if (!viewer.value) return;
  try {
    const dataSource = await Cesium.GeoJsonDataSource.load('/data/yunnan_boundary.geo.json', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF'),
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 10,
      markerSize: 0,
      clampToGround: true
    });
    viewer.value.dataSources.add(dataSource);
    
    // 样式调整
    const entities = dataSource.entities.values;
    entities.forEach(entity => {
      const name = entity.properties.name ? entity.properties.name.getValue() : '';
      if (!name.includes('云南')) {
         dataSource.entities.remove(entity);
      } else {
        if (entity.polygon) {
           entity.polygon.fill = false;
           entity.polygon.outline = true;
           entity.polygon.outlineColor = Cesium.Color.fromCssColorString('#00E5FF');
           entity.polygon.outlineWidth = 6;
        }
      }
    });
  } catch (e) {
    console.error('Failed to load boundary:', e);
  }
}

// ==================== GeoJSON 矢量渲染已移除 ====================
// 现在使用纯 WMS 渲染模式，由 GeoServer 处理样式
// 这大幅减少了前端内存使用，避免 OOM

function formatLegendLabel(index) {
  if (legendBreaks.value.length < 2) return '';
  const min = legendBreaks.value[index];
  const max = legendBreaks.value[index + 1];
  return `${formatValue(min)} - ${formatValue(max)}`;
}

function formatValue(value) {
  if (value === undefined || value === null) return '0';
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

// ==================== WMS 图层加载（纯 WMS 渲染模式）====================
// 根据选择的空间单元、年份和属性加载 WMS 图层
// ==================== WMS 图层加载（滚动缓冲区策略）====================
// targetYear: 要加载/显示的年份 (默认 selectedYear)
// visible: 是否立即可见 (预加载设为 false)
async function loadWMSLayer(targetYear = null, visible = true) {
  if (!viewer.value) {
    console.warn('[RegionalAnalysis] Viewer not ready');
    return;
  }

  const year = targetYear || selectedYear.value;

  // 1. 如果需要显示，且已在缓存中存在，直接切换可见性
  if (wmsLayerCache.has(year)) {
    if (visible) {
      updateLayerVisibility(year);
    }
    return;
  }

  // 2. 如果是当前年份且需要显示，且当前无图层（首次加载），开启加载动画
  // 如果已有图层，则静默加载新图层，保持当前图层直到新图层就绪 (电影模式)
  if (visible && year === selectedYear.value && !spatialLayer.value) {
    isLoading.value = true;
  }
  
   // 构建图层名称
  const layerNameMap = {
    county: 'WebGIS:spatial_county_yunnan_stats',
    grid: 'WebGIS:spatial_grid_yunnan_stats'
  };
  
  const layerName = layerNameMap[spatialUnit.value];
  if (!layerName) {
    isLoading.value = false;
    return;
  }
  
  // 属性名到数据库字段前缀的映射
  const attrPrefixMap = {
    cropland: 'cro', forest: 'for', shrub: 'shr', grassland: 'gra',
    water: 'wat', wetland: 'wet', impervious: 'imp', barren: 'bar', snow_ice: 'ice'
  };
  
  // 获取动态分级断点及其对应的正确字段名
  try {
    // 针对不同尺度选择最佳分级方法
    const method = spatialUnit.value === 'grid' ? 'quantile' : 'jenks';
    const numClasses = 10;
    
    console.log(`[RegionalAnalysis] Requesting breaks: unit=${spatialUnit.value}, method=${method}, classes=${numClasses}`);
    
    // 直接使用 fetch 避免 api/index.js 可能存在的参数传递问题
    const token = localStorage.getItem('auth_token');
    const url = `/api/clcd/breaks?attr=${selectedAttribute.value}&year=${year}&method=${method}&classes=${numClasses}&unit=${spatialUnit.value}`;
    
    // 获取断点 (Legend) 数据
    // 注意：即使是预加载，我们也需要获取已计算好的 Breaks 以生成正确的样式
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const breaksData = await response.json();
    let breaks = breaksData.breaks; // [min, th1, ..., th(k), max]
    const dynamicAttr = breaksData.field;
    currentStatsField.value = dynamicAttr;
    
    console.log('[RegionalAnalysis] Breaks Response:', breaksData);
    
    // 异常检测：如果格网模式下出现巨大数值，显示警告
    if (spatialUnit.value === 'grid' && breaks[breaks.length-1] > 200) {
        console.error('[RegionalAnalysis] DATA ANOMALY: Grid breaks are unexpectedly large (>200 km²). Likely received County data.');
    }

    // Jenks 可能返回少于请求的分级数
    while (breaks.length < numClasses + 1) {
        breaks.push(breaks[breaks.length - 1]);
    }
    
    console.log(`[RegionalAnalysis] Loaded breaks for field: ${dynamicAttr}, classes: ${numClasses}`);
    
    // 更新图例标签
    const labels = [];
    for (let i = 0; i < numClasses; i++) {
        const formatNum = (num) => num < 10 ? num.toFixed(2) : Math.round(num);
        const minValStr = formatNum(breaks[i]);
        const maxValStr = formatNum(breaks[i+1]);
        
        if (i > 0 && breaks[i] === breaks[breaks.length-1]) {
             break;
        }
        labels.push(`${minValStr}-${maxValStr}`);
    }
    
    currentLegendLabels.value = labels;
    
    // 构建 GeoServer env 参数
    let envParams = `attr:${dynamicAttr}`;
    for (let i = 1; i < numClasses; i++) {
        const val = i < breaks.length - 1 ? breaks[i] : breaks[breaks.length - 1];
        // 还原为平方米 (数据库单位)
        const valSqM = Math.round(val * 1000000); 
        envParams += `;th${i}:${valSqM}`;
    }
    
    const styleName = `${selectedAttribute.value}_dynamic`;
    console.log(`[RegionalAnalysis] Loading WMS: ${layerName}, style=${styleName}, env=${envParams}`);
  
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

    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: 'http://localhost:8080/geoserver/WebGIS/wms',
      layers: layerName,
      enablePickFeatures: true,
      parameters: wmsParameters
    });

    // 创建图层，初始透明度 0 (除非是当前唯一且无缓存，但策略是先隐后显)
    const newLayer = viewer.value.imageryLayers.addImageryProvider(wmsProvider);
    newLayer.alpha = 0; 
    newLayer.show = true; // 保持 show=true 但 alpha=0 以便预加载纹理

    // 存入缓存
    wmsLayerCache.set(year, newLayer);

    // 如果需要显示，执行切换逻辑
    if (visible) {
       updateLayerVisibility(year);
       isLoading.value = false;
    }
    
  } catch (err) {
    console.error('[RegionalAnalysis] Failed to load breaks/WMS:', err);
    isLoading.value = false;
  }
}

// 清理所有 WMS 缓存 (在切换指标或空间单元时调用)
function clearWMSCache() {
  wmsLayerCache.forEach((layer) => {
    try {
      if (viewer.value && !viewer.value.isDestroyed()) {
        viewer.value.imageryLayers.remove(layer, true);
      }
    } catch (e) {
      console.warn('Cache cleanup failed', e);
    }
  });
  wmsLayerCache.clear();
  spatialLayer.value = null;
}

// 核心切换逻辑：只显示目标年份，隐藏其他，清理过期
function updateLayerVisibility(targetYear) {
    // 1. 设置当前层可见
    const targetLayer = wmsLayerCache.get(targetYear);
    if (targetLayer) {
        targetLayer.alpha = 1;
        spatialLayer.value = targetLayer; 
    }

    // 2. 隐藏其他层
    wmsLayerCache.forEach((layer, yr) => {
        if (yr !== targetYear) {
            layer.alpha = 0;
        }
    });

    // 3. 预加载未来 2 年
    const allYears = years.value;
    const currentIndex = allYears.indexOf(targetYear);
    if (currentIndex !== -1) {
        if (currentIndex + 1 < allYears.length) loadWMSLayer(allYears[currentIndex + 1], false);
        if (currentIndex + 2 < allYears.length) loadWMSLayer(allYears[currentIndex + 2], false);
    }

    // 4. 清理缓存 (保留当前前后各 2 年)
    const keepRange = new Set();
    for (let i = currentIndex - 2; i <= currentIndex + 5; i++) {
        if (i >= 0 && i < allYears.length) keepRange.add(allYears[i]);
    }

    wmsLayerCache.forEach((layer, yr) => {
        if (!keepRange.has(yr)) {
            try {
                if (viewer.value && !viewer.value.isDestroyed()) {
                    viewer.value.imageryLayers.remove(layer, true);
                }
            } catch (e) {
                console.warn('Cleanup failed', e);
            }
            wmsLayerCache.delete(yr);
        }
    });
}


function getAttributeLabel(key) {
  const attr = attributes.find(a => a.value === key);
  return attr ? attr.label : key;
}

onUnmounted(() => {
  console.log('[RegionalAnalysis] Component unmounting, starting cleanup...');
  
  // 1. 清理数据源
  cleanupData();
  
  // 2. 清理点击事件处理器
  if (clickHandler) {
    try {
      clickHandler.destroy();
    } catch (e) {
      console.warn('[RegionalAnalysis] ClickHandler cleanup warning:', e);
    }
    clickHandler = null;
  }
  
  // 3. 清理底图图层
  if (viewer.value && baseMapLayer.value) {
    try {
      viewer.value.imageryLayers.remove(baseMapLayer.value, true);
    } catch (e) {
      console.warn('[RegionalAnalysis] BaseMapLayer cleanup warning:', e);
    }
    baseMapLayer.value = null;
  }
  
  // 4. 清理所有 DataSources
  if (viewer.value) {
    try {
      viewer.value.dataSources.removeAll(true);
    } catch (e) {
      console.warn('[RegionalAnalysis] DataSources cleanup warning:', e);
    }
  }
  
  // 5. 销毁 Cesium Viewer（这会释放大量 GPU 内存）
  if (viewer.value && typeof viewer.value.destroy === 'function') {
    try {
      viewer.value.destroy();
    } catch (e) {
      console.warn('[RegionalAnalysis] Viewer destroy warning:', e);
    }
    viewer.value = null;
  }
  
  console.log('[RegionalAnalysis] Cleanup complete');
});
</script>

<style scoped>
.regional-analysis-page {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #000; /* 防止加载时瞬间白屏 */
}

.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* 顶部控制面板 - 悬浮毛玻璃设计 (全宽版) */
.analysis-header.floating-glass {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32px; /* Increased padding for full width */
  background: rgba(15, 23, 42, 0.75); /* Slightly darker/more opaque for full bar */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08); /* Only bottom border */
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  pointer-events: auto;
  font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
}

.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* 圆形返回按钮 */
.back-btn-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn-circle:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
  border-color: rgba(255, 255, 255, 0.3);
}

.divider-vertical {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.divider-vertical.small {
  height: 16px;
  margin: 0 4px;
}

.header-title {
  font-size: 20px;
  font-weight: 800; /* Bolder */
  letter-spacing: 2px;
  background: linear-gradient(135deg, #e2e8f0 0%, #ffffff 50%, #94a3b8 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 10px rgba(255, 255, 255, 0.1);
  position: relative;
  padding-right: 12px;
}

/* Decorative dot for title */
.header-title::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  box-shadow: 0 0 8px #3b82f6;
}

/* Segmented Control (iOS style) */
.segmented-control {
  position: relative;
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.segment-bg {
  position: absolute;
  top: 4px;
  left: 4px;
  width: calc(50% - 4px);
  height: calc(100% - 8px);
  background: rgba(59, 130, 246, 0.8);
  border-radius: 8px;
  transition: left 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4); 
}

.segmented-control button {
  position: relative;
  z-index: 1;
  width: 60px;
  padding: 6px 0;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit; /* Inherit font from header */
  cursor: pointer;
  transition: color 0.3s;
}

.segmented-control button.active {
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* Glass Select Wrapper */
.glass-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 0 12px;
  height: 40px;
  transition: all 0.2s;
}

.glass-select-wrapper:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.glass-select-wrapper.icon-only {
  padding: 0;
  width: 40px;
  justify-content: center;
}

.glass-select-wrapper select {
  appearance: none;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 14px;
  padding: 0 24px 0 32px; /* Left space for icon, right for chevron */
  height: 100%;
  cursor: pointer;
  outline: none;
}

.glass-select-wrapper.icon-only select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0; /* Hidden select covering the icon */
}

/* Icons styling */
.select-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.6);
  pointer-events: none;
}

.glass-select-wrapper.icon-only .select-icon {
  position: static;
  color: rgba(255, 255, 255, 0.8);
}

.chevron-icon {
  position: absolute;
  right: 10px;
  width: 14px;
  height: 14px;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

/* Dark option styling for dropdowns */
.glass-select-wrapper select option {
  background: #1e293b;
  color: #fff;
  padding: 8px;
}


.load-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.load-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 图例 */
/* 图例 */
.legend-container {
  position: fixed;
  bottom: 40px; /* Slightly higher */
  right: 30px;
  background: rgba(15, 23, 42, 0.6); /* Same as TimePlayer */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  min-width: 180px;
}

.legend-container:hover {
  background: rgba(15, 23, 42, 0.8);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.legend-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  letter-spacing: 0.5px;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 10px; /* Increased gap */
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.legend-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
  font-weight: 500;
}

.legend-unit {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 16px;
  text-align: right;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 信息弹窗 */
/* 悬浮提示框 */
.info-tooltip {
  position: fixed;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 1000;
  pointer-events: none; /* 不阻挡鼠标事件 */
  min-width: 160px;
  max-width: 280px;
  padding: 10px 14px;
  transform: translate(-50%, -100%); /* 关键：实现居中并位于上方 */
  animation: tooltipFadeIn 0.15s ease-out;
}

@keyframes tooltipFadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.tooltip-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 3px 0;
  font-size: 13px;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.tooltip-value {
  color: #60a5fa;
  font-weight: 500;
  text-align: right;
}

/* 原有弹窗样式（保留用于其他用途） */
.info-popup {
  position: fixed;
  background: rgba(13, 25, 48, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  padding: 0;
  min-width: 200px;
  max-width: 300px;
  z-index: 1001;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-weight: 600;
  color: #fff;
}

.popup-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.popup-close:hover {
  color: #fff;
}

.popup-content {
  padding: 12px 16px;
}

.popup-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.popup-label {
  color: rgba(255, 255, 255, 0.6);
}

.popup-value {
  color: #fff;
  font-weight: 500;
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(13, 25, 48, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.9);
  z-index: 2000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.time-player-container {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  width: 600px;
}
</style>
