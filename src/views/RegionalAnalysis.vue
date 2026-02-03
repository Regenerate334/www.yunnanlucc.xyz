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
      </div>
    </div>

    <!-- 图例 -->
    <div v-if="legendBreaks.length > 0" class="legend-container">
      <div class="legend-title">{{ currentAttributeLabel }}</div>
      <div class="legend-items">
        <div v-for="(color, index) in currentColorScale" :key="index" class="legend-item">
          <span class="legend-color" :style="{ background: color }"></span>
          <span class="legend-label">{{ formatLegendLabel(index) }}</span>
        </div>
      </div>
      <div class="legend-unit">单位: km²</div>
    </div>

    <!-- 区域信息弹窗 -->
    <div v-if="selectedEntity" class="info-popup" :style="popupStyle">
      <div class="popup-header">
        <span>{{ selectedEntity.name }}</span>
        <button @click="selectedEntity = null" class="popup-close">×</button>
      </div>
      <div class="popup-content">
        <div v-for="(value, key) in selectedEntity.properties" :key="key" class="popup-row">
          <span class="popup-label">{{ getAttributeLabel(key) }}:</span>
          <span class="popup-value">{{ formatValue(value) }} km²</span>
        </div>
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
const spatialUnit = ref('county');
const selectedAttribute = ref('cropland');
const selectedYear = ref(1990);
const years = ref([]);

const legendBreaks = ref([]);
const selectedEntity = ref(null);
const popupStyle = ref({ left: '0px', top: '0px' });

const colorScale5 = ['#2ecc71', '#7dcea0', '#f9e79f', '#f5b041', '#e74c3c'];
const colorScale10 = ['#A50026', '#D73027', '#F46D43', '#FDAE61', '#FEE08B', '#D9EF8B', '#A6D96A', '#66BD63', '#1A9850', '#006837'];

const currentColorScale = computed(() => {
  return selectedAttribute.value === 'forest' ? colorScale10 : colorScale5;
});

// 用于 getColorForValue 的色阶引用
const colorScale = computed(() => currentColorScale.value);

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
watch(spatialUnit, (newUnit) => {
  console.log(`[RegionalAnalysis] Spatial unit changed to ${newUnit}, updating WMS...`);
  loadSpatialLayer(newUnit);
  // 切换单元后自动重载数据
  loadAndRender();
});

// 监听年份变化，自动刷新
watch(selectedYear, () => {
  console.log('[RegionalAnalysis] Year changed, auto-refreshing...');
  loadAndRender();
});

// 监听分析指标变化，如果是 GeoJSON 渲染，则只需要重新上色即可，但为了逻辑简单统一调用重载
watch(selectedAttribute, () => {
  console.log('[RegionalAnalysis] Attribute changed, auto-refreshing...');
  loadAndRender();
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
    // 自动触发第一次加载，让用户进来就能看到数据
    if (viewer.value) {
      console.log('[RegionalAnalysis] Auto-triggering initial load...');
      loadSpatialLayer(spatialUnit.value); // 同步加载 WMS底图
      loadAndRender(); // 全矢量加载
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

    // 设置点击事件
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);
    clickHandler.setInputAction((click) => {
      const picked = viewer.value.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties) {
        const props = {};
        const propertyNames = picked.id.properties.propertyNames;
        propertyNames.forEach(name => {
          if (attributes.some(a => a.value === name)) {
            props[name] = picked.id.properties[name].getValue();
          }
        });

        selectedEntity.value = {
          name: picked.id.properties.name?.getValue() || '未知区域',
          properties: props
        };

        popupStyle.value = {
          left: click.position.x + 20 + 'px',
          top: click.position.y + 'px'
        };
      } else {
        selectedEntity.value = null;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    
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
  let layerName = 'img';
  let url = `http://t0.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;

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

// 加载数据的函数（之前模板中调用）
async function loadAndRender() {
  if (!viewer.value) {
    console.error('Viewer not available');
    return;
  }
  
  isLoading.value = true;

  try {
    // 先清理旧的 DataSource 以释放内存
    if (dataSource.value && viewer.value) {
      try {
        if (dataSource.value.entities) {
          dataSource.value.entities.removeAll();
        }
        viewer.value.dataSources.remove(dataSource.value, true);
      } catch (e) {
        console.warn('[RegionalAnalysis] Old dataSource cleanup warning:', e);
      }
      dataSource.value = null;
    }

    console.log(`[RegionalAnalysis] Loading ${spatialUnit.value} vector data for year ${selectedYear.value}...`);
    let geojson;
    if (spatialUnit.value === 'grid') {
      geojson = await clcdApi.getSpatialGridData(selectedYear.value);
    } else {
      geojson = await clcdApi.getSpatialCountyData(selectedYear.value);
    }
    
    console.log(`[RegionalAnalysis] Received GeoJSON:`, geojson);
    
    if (!geojson || !geojson.features || geojson.features.length === 0) {
      console.warn(`[RegionalAnalysis] No data for year ${selectedYear.value}. Full API response:`, geojson);
      alert(`未找到 ${selectedYear.value} 年的空间统计数据，请尝试其他年份`);
      isLoading.value = false;
      return;
    }

    const values = geojson.features
      .map(f => f.properties[selectedAttribute.value] || 0)
      .filter(v => v > 0);
    
    // 林地指标使用 10 级分段以匹配 SLD 模板
    const steps = selectedAttribute.value === 'forest' ? 10 : 5;
    const breaks = calculateBreaks(values, steps);
    legendBreaks.value = breaks;

    const ds = await Cesium.GeoJsonDataSource.load(geojson, {
      stroke: Cesium.Color.WHITE.withAlpha(0.8),
      strokeWidth: 1,
      fill: Cesium.Color.TRANSPARENT,
      clampToGround: true
    });

    const entities = ds.entities.values;
    entities.forEach(entity => {
      if (entity.polygon) {
        const value = entity.properties[selectedAttribute.value]?.getValue() || 0;
        const color = getColorForValue(value, breaks);
        entity.polygon.material = color.withAlpha(0.75);
        entity.polygon.outline = true;
        entity.polygon.outlineColor = Cesium.Color.WHITE.withAlpha(0.6);
        entity.polygon.outlineWidth = 1;
      }
    });

    viewer.value.dataSources.add(ds);
    dataSource.value = ds;
    viewer.value.flyTo(ds, { duration: 1.5 });

  } catch (e) {
    console.error('加载空间数据失败:', e);
  } finally {
    isLoading.value = false;
  }
}

function calculateBreaks(values, numClasses) {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const interval = (max - min) / numClasses;
  
  const breaks = [];
  for (let i = 0; i <= numClasses; i++) {
    breaks.push(min + interval * i);
  }
  return breaks;
}

function getColorForValue(value, breaks) {
  const scale = colorScale.value; // 使用 computed 的值
  if (breaks.length < 2) return Cesium.Color.GRAY;
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value >= breaks[i] && value < breaks[i + 1]) {
      return Cesium.Color.fromCssColorString(scale[i]);
    }
  }
  if (value >= breaks[breaks.length - 2]) {
    return Cesium.Color.fromCssColorString(scale[scale.length - 1]);
  }
  return Cesium.Color.fromCssColorString(scale[0]);
}

function formatLegendLabel(index) {
  if (legendBreaks.value.length < 2) return '';
  const min = legendBreaks.value[index];
  const max = legendBreaks.value[index + 1];
  // 使用辅助函数
  return `${formatValue(min)} - ${formatValue(max)}`;
}

function formatValue(value) {
  if (value === undefined || value === null) return '0';
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

// 空间图层切换逻辑已直接绑定到空间单元
function loadSpatialLayer(layerType) {
  if (!viewer.value) return;
  // 移除旧图层
  if (spatialLayer.value) {
    viewer.value.imageryLayers.remove(spatialLayer.value, true);
    spatialLayer.value = null;
  }
  
  // 如果是 'none' 就不加载 (虽然现在 UI 上至少会选一个，但保留防御性判断)
  if (layerType === 'none') return;

  const layerNameMap = {
    county: 'WebGIS:spatial_county_yunnan_stats',
    grid: 'WebGIS:spatial_grid_yunnan_stats'
  };

  const layerName = layerNameMap[layerType];
  if (!layerName) return;

  try {
    const newLayer = viewer.value.imageryLayers.addImageryProvider(
      new Cesium.WebMapServiceImageryProvider({
        url: 'http://localhost:8080/geoserver/WebGIS/wms',
        layers: layerName,
        parameters: {
          service: 'WMS',
          version: '1.1.0',
          request: 'GetMap',
          format: 'image/png',
          transparent: true,
          styles: ''
        }
      })
    );
    spatialLayer.value = newLayer;
    console.log(`[RegionalAnalysis] Sync WMS Layer loaded: ${layerName}`);
  } catch (e) {
    console.error(`[RegionalAnalysis] Sync WMS Load error:`, e);
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
