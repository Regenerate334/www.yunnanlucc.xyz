<template>
  <div id="cesiumContainerWrapper">
    <!-- 背景遮罩层与地图掩膜层：Dashboard模式下隐藏，增加过渡动画 -->
    <transition name="layer-fade">
      <div v-if="!isDashboardMode" class="background-layer"></div>
    </transition>
    <transition name="layer-fade">
      <div v-if="!isDashboardMode" class="mask-layer"></div>
    </transition>
    <div id="cesiumContainer"></div>

    <!-- 顶部标题栏（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="header-container">
      <div class="header-content">
        <button class="logout-btn" @click="handleLogout" title="退出登录">
          <img :src="logoutIcon" alt="退出" class="logout-icon-img" />
        </button>
      </div>
    </div>

    <!-- 年份选择器（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="year-selector-container">
      <YearRangeSelector v-model:selectedYear="selectedYear" :width="200" />
    </div>

    <!-- 底图选择器（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="basemap-selector-container">
      <BaseMapSelector @change="handleBaseMapChange" />
    </div>

    <!-- 空间图层选择器已迁移到区域检测页面 -->

    <!-- 底部控制按钮组（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="bottom-controls-container">
      <ViewResetControl />
      <DistanceMeasureButton />
      <AreaMeasureButton />
      <EChartsPrefecturePie :year="selectedYear" />
      <EChartsCountyPie :year="selectedYear" />
      <LandUseTrendControl :seriesData="cachedClcdData" />
      <RegionalTrendControl />
      <!-- 区域检测入口按钮 -->
      <button type="button" class="control-btn regional-analysis-btn" @click.prevent="goToRegionalAnalysis" title="区域检测分析">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span class="btn-label">区域检测</span>
      </button>
    </div>


    <!-- 大屏指挥中心入口按钮（切换模式） -->
    <div v-if="!isDashboardMode" class="dashboard-entry-container">
      <button @click="isDashboardMode = true" class="dashboard-toggle-btn" title="进入大屏指挥中心">
        <img :src="dashboardIcon" class="toggle-icon-img" alt="大屏" />
      </button>
    </div>

    <!-- 右侧图表面板区域（Dashboard模式下隐藏） -->
    <div v-if="!isDashboardMode" class="right-panels">
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
import { onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import YearRangeSelector from '../components/controls/YearRangeSelector.vue';
import ViewResetControl from '../components/controls/ViewResetControl.vue';
import BaseMapSelector from '../components/controls/BaseMapSelector.vue';
import LandUsePieChart from '../components/charts/LandUsePieChart.vue';
import DistanceMeasureButton from '../components/controls/DistanceMeasureButton.vue';
import AreaMeasureButton from '../components/controls/AreaMeasureButton.vue';
import EChartsPrefecturePie from '../components/controls/EChartsPrefecturePie.vue';
import EChartsCountyPie from '../components/controls/EChartsCountyPie.vue';
import LandUseTrendControl from '../components/controls/LandUseTrendControl.vue';
import RegionalTrendControl from '../components/controls/RegionalTrendControl.vue';
import SpatialLayerSelector from '../components/controls/SpatialLayerSelector.vue';
import DashboardOverlay from './DashboardOverlay.vue';
import { useMapStore } from '../stores/map.ts';
import { clcdApi, authApi } from '../api/index.js';
import logoutIcon from '../assets/icons/logout.png';
import dashboardIcon from '../assets/icons/dashboard.png';

const router = useRouter();
const mapStore = useMapStore();

const viewer = shallowRef(null);
const clcdLayer = shallowRef(null);
const baseMapLayer = shallowRef(null);
const spatialLayer = shallowRef(null);
const cachedClcdData = ref([]);

const selectedYear = ref(1985);
const currentYearData = ref({});
const isDashboardMode = ref(false);

// CLCD 颜色映射
const clcdColors = {
  Cropland: 'rgb(250,227,156)',
  Forest: 'rgb(68,111,51)',
  Shrub: 'rgb(51,160,44)',
  Grassland: 'rgb(171,211,123)',
  Water: 'rgb(30,105,180)',
  Wetland: 'rgb(130,209,219)',
  Impervious: 'rgb(227,26,28)',
  Barren: 'rgb(255,255,255)',
  Snow_Ice: 'rgb(173, 216, 230)'
};

const legendNames = {
  Cropland: '耕地',
  Forest: '林地',
  Shrub: '灌木',
  Grassland: '草地',
  Water: '水域',
  Wetland: '湿地',
  Impervious: '建设用地',
  Barren: '裸地',
  Snow_Ice: '冰雪'
};

async function handleLogout() {
  try {
    localStorage.removeItem('auth_token');
    router.push('/login');
  } catch (e) {
    console.error('Logout failed:', e);
  }
}

const checkAuth = async () => {
  // 冗余检查已移除，完全交由 router/index.js 的 beforeEach 导航守卫处理
  // 避免在 SPA 跳转瞬间产生额外的并发认证请求
};

onMounted(async () => {
  // 移除 checkAuth() 调用，确保页面能立即开始 Cesium 初始化
  // await checkAuth(); 

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
    viewer.value.scene.highDynamicRange = true;
    viewer.value.resolutionScale = window.devicePixelRatio || 1.0;
    viewer.value.cesiumWidget.creditContainer.style.display = "none";
    viewer.value.scene.screenSpaceCameraController.enableTilt = false;

    loadBaseMap('imagery');

    // 加载云南省边界
    Cesium.GeoJsonDataSource.load('/data/yunnan_boundary.geo.json', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF'),
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 10,
      markerSize: 0,
      clampToGround: true
    }).then(function (dataSource) {
      viewer.value.dataSources.add(dataSource);
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
    }).catch(function (error) {
      console.error('加载云南边界数据失败:', error);
    });

    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
      orientation: {
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });

    window.cesiumViewer = viewer.value;
    mapStore.setViewer(viewer.value);

    loadCLCDLayer(selectedYear.value);
    loadYearData(selectedYear.value);

  } catch (e) {
    console.error('Cesium initialization error:', e);
  }
});

// 响应年份变化，自动更新图层
watch(selectedYear, (newYear, oldYear) => {
  if (viewer.value && newYear !== oldYear) {
    loadCLCDLayer(newYear);
    loadYearData(newYear);
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

function loadCLCDLayer(year) {
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

onUnmounted(() => {
  console.log('[Workbench] Component unmounting, starting cleanup...');
  
  // 1. 移除 CLCD 图层
  if (viewer.value && clcdLayer.value) {
    try {
      viewer.value.imageryLayers.remove(clcdLayer.value, true);
    } catch (e) {
      console.warn('[Workbench] CLCD layer cleanup warning:', e);
    }
    clcdLayer.value = null;
  }
  
  // 2. 移除底图图层
  if (viewer.value && baseMapLayer.value) {
    try {
      viewer.value.imageryLayers.remove(baseMapLayer.value, true);
    } catch (e) {
      console.warn('[Workbench] BaseMap layer cleanup warning:', e);
    }
    baseMapLayer.value = null;
  }
  
  // 3. 移除空间图层
  if (viewer.value && spatialLayer.value) {
    try {
      viewer.value.imageryLayers.remove(spatialLayer.value, true);
    } catch (e) {
      console.warn('[Workbench] Spatial layer cleanup warning:', e);
    }
    spatialLayer.value = null;
  }
  
  // 4. 移除所有数据源（如云南边界等）
  if (viewer.value) {
    try {
      viewer.value.dataSources.removeAll(true);
    } catch (e) {
      console.warn('[Workbench] DataSources cleanup warning:', e);
    }
  }
  
  // 5. 清除 mapStore 中的 viewer 引用
  mapStore.setViewer(null);
  
  // 6. 销毁 Cesium Viewer
  if (viewer.value && typeof viewer.value.destroy === 'function') {
    try {
      viewer.value.destroy();
    } catch (e) {
      console.warn('[Workbench] Viewer destroy warning:', e);
    }
    viewer.value = null;
  }
  
  window.cesiumViewer = null;
  
  // 7. 清理缓存数据
  cachedClcdData.value = [];
  currentYearData.value = {};
  
  console.log('[Workbench] Cleanup complete');
});

// 跳转到区域检测分析页面
function goToRegionalAnalysis() {
  console.log('[Workbench] 准备跳转到区域检测页面...');
  router.push('/regional-analysis')
    .then(() => {
      console.log('[Workbench] 跳转成功');
    })
    .catch(err => {
      console.error('[Workbench] 跳转失败:', err);
    });
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

.year-selector-container {
  position: fixed;
  top: 40px;
  left: 20px;
  z-index: 1100;
}

.basemap-selector-container {
  position: fixed;
  top: 40px;
  left: 250px;
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
  bottom: 30px;
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
</style>
