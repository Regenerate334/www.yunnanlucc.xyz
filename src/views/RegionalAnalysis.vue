<template>
  <div class="regional-analysis-page">
    <div id="cesiumContainer" class="map-container"></div>
    <!-- 顶部控制面板 -->
    <div class="analysis-header">
      <button class="back-btn" @click="goBack" title="返回工作台">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        返回工作台
      </button>

      <div class="header-title">区域土地利用检测分析</div>

      <div class="controls">
        <div class="control-group">
          <label>空间单元</label>
          <div class="btn-group">
            <button 
              :class="{ active: spatialUnit === 'county' }" 
              @click="spatialUnit = 'county'"
            >县级</button>
            <button 
              :class="{ active: spatialUnit === 'grid' }" 
              @click="spatialUnit = 'grid'"
              title="切换为格网单元"
            >格网</button>
          </div>
        </div>

        <div class="control-group">
          <label>分析指标</label>
          <select v-model="selectedAttribute">
            <option v-for="attr in attributes" :key="attr.value" :value="attr.value">
              {{ attr.label }}
            </option>
          </select>
        </div>

        <div class="control-group">
          <label>年份</label>
          <select v-model="selectedYear">
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>

        <div class="control-group">
          <label>底图</label>
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
import 'cesium/Build/Cesium/Widgets/widgets.css';

const router = useRouter();

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
const selectedYear = ref(1990);
const years = ref([]);

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
watch(spatialUnit, (newUnit, oldUnit) => {
  if (newUnit !== oldUnit) {
    console.log(`[RegionalAnalysis] Spatial unit changed to ${newUnit}`);
    // 使用 WMS 渲染
    loadWMSLayer();
  }
});

// 监听年份变化，自动刷新 WMS 图层
watch(selectedYear, () => {
  console.log('[RegionalAnalysis] Year changed, updating WMS...');
  loadWMSLayer();
});

// 监听分析指标变化，更新 WMS 样式
watch(selectedAttribute, () => {
  console.log('[RegionalAnalysis] Attribute changed, updating WMS style...');
  loadWMSLayer();
});

async function fetchYears() {
  try {
    const data = await clcdApi.getAvailableYears();
    years.value = data || [];
    if (years.value.length > 0 && !years.value.includes(selectedYear.value)) {
      selectedYear.value = years.value[years.value.length - 1];
    }
  } catch (err) {
    console.error('[RegionalAnalysis] Failed to fetch years:', err);
    // 回退默认值
    years.value = [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2022];
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

    // 飞到初始视角
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
                    
                    // 更新弹窗位置（跟随鼠标）
                    popupStyle.value = {
                        left: position.x + 15 + 'px',
                        top: position.y + 15 + 'px'
                    };
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
      }, 80); // 80ms 防抖延迟
      
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
async function loadWMSLayer() {
  if (!viewer.value) {
    console.warn('[RegionalAnalysis] Viewer not ready');
    return;
  }
  
  isLoading.value = true;
  
  // 移除旧的 WMS 图层
  if (spatialLayer.value) {
    try {
      viewer.value.imageryLayers.remove(spatialLayer.value, true);
    } catch (e) {
      console.warn('[RegionalAnalysis] WMS layer cleanup warning:', e);
    }
    spatialLayer.value = null;
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
  
  const prefix = attrPrefixMap[selectedAttribute.value] || 'cro';
  
  // 获取动态分级断点及其对应的正确字段名
  try {
    // 增加分级数到10级，以更好区分高端数值（如宣威 vs 隆阳）
    // 使用自然断点法(Jenks)以获得最佳的视觉区分度
    const numClasses = 10;
    const breaksData = await clcdApi.getBreaks(selectedAttribute.value, selectedYear.value, 'jenks', numClasses);
    let breaks = breaksData.breaks; // [min, th1, ..., th(k), max]
    const dynamicAttr = breaksData.field;
    currentStatsField.value = dynamicAttr;
    
    // Jenks 可能返回少于请求的分级数（如果数据值种类少）
    // 补全 breaks 数组，确保长度满足 numClasses + 1
    while (breaks.length < numClasses + 1) {
        breaks.push(breaks[breaks.length - 1]);
    }
    
    console.log(`[RegionalAnalysis] Loaded breaks (Jenks) for field: ${dynamicAttr}, classes: ${numClasses}`);
    
    // 更新图例标签
    const labels = [];
    for (let i = 0; i < numClasses; i++) {
        const minVal = Math.round(breaks[i]);
        const maxVal = Math.round(breaks[i+1]);
        if (minVal === maxVal && i > 0 && breaks[i] === breaks[breaks.length-1]) {
             // 已经到了填充的尾部，不再显示重复标签
             break;
        }
        labels.push(`${minVal}-${maxVal}`);
    }
    
    currentLegendLabels.value = labels;
    
    // 构建 GeoServer env 参数
    let envParams = `attr:${dynamicAttr}`;
    for (let i = 1; i < numClasses; i++) {
        // 安全获取阈值，如果越界则用最大值
        const val = i < breaks.length - 1 ? breaks[i] : breaks[breaks.length - 1];
        const valSqM = Math.round(val * 1000000); 
        envParams += `;th${i}:${valSqM}`;
    }
    
    console.log(`[RegionalAnalysis] Loading WMS: ${layerName}, env: ${envParams}`);
  
    const wmsProvider = new Cesium.WebMapServiceImageryProvider({
      url: 'http://localhost:8080/geoserver/WebGIS/wms',
      layers: layerName,
      enablePickFeatures: true, // 开启特征拾取
      parameters: {
        service: 'WMS',
        version: '1.1.0',
        request: 'GetMap',
        format: 'image/png',
        transparent: true,
        styles: `${selectedAttribute.value}_dynamic`,
        env: envParams,
        info_format: 'application/json' // 请求JSON格式的特征信息
      }
    });
    
    // 监听加载错误
    wmsProvider.errorEvent.addEventListener((error) => {
      console.warn(`[RegionalAnalysis] WMS tile error:`, error);
    });
    
    const newLayer = viewer.value.imageryLayers.addImageryProvider(wmsProvider);
    spatialLayer.value = newLayer;
    
  } catch (err) {
    console.error('[RegionalAnalysis] Failed to load breaks or WMS:', err);
  } finally {
    isLoading.value = false;
  }
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

/* 顶部控制面板 */
.analysis-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 24px;
  background: rgba(13, 25, 48, 0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(-4px);
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.header-title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 2px;
  text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.controls {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-group label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.control-group select {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  min-width: 120px;
}

.control-group select:focus {
  outline: none;
  border-color: #3b82f6;
}

.control-group select option {
  background: #1e3a5f;
  color: #fff;
}

.btn-group {
  display: flex;
  gap: 0;
}

.btn-group button {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-group button:first-child {
  border-radius: 6px 0 0 6px;
}

.btn-group button:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}

.btn-group button.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.btn-group button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
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
.legend-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  background: rgba(13, 25, 48, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  z-index: 1000;
}

.legend-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 12px;
}

.legend-items {
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
}

.legend-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.legend-unit {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 10px;
  text-align: right;
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
</style>
