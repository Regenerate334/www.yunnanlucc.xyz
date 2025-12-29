<template>
  <div id="cesiumContainerWrapper">
    <div class="background-layer"></div>
    <!-- <div class="mask-layer"></div> -->
    <div id="cesiumContainer"></div>

    <!-- 顶部标题栏 -->
    <div class="header-container">
      <div class="header-content">
        <!-- 退出登录按钮 -->
        <button class="logout-btn" @click="handleLogout" title="退出登录">
          <img :src="logoutIcon" alt="退出" class="logout-icon-img" />
        </button>
      </div>
    </div>

    <!-- 年份选择器 - -->
    <div class="year-selector-container">
      <YearRangeSelector v-model:selectedYear="selectedYear" :width="200" />
    </div>

    <!-- 复位视图控制按钮 - 左上角 -->
    <div class="reset-control-container">
      <ViewResetControl />
    </div>

    <!-- 底图选择器 - 左上角 -->
    <div class="basemap-selector-container">
      <BaseMapSelector @change="handleBaseMapChange" />
    </div>

    <!-- 底部控制按钮组 - 复位视图、测距、测面积、地级市饼图、变化趋势图 -->
    <div class="bottom-controls-container">
      <ViewResetControl />
      <DistanceMeasureButton />
      <AreaMeasureButton />
      <EChartsPrefecturePie :year="selectedYear" />
      <EChartsCountyPie :year="selectedYear" />
      <LandUseTrendControl :seriesData="cachedClcdData" />
      <RegionalTrendControl />
    </div>

    <!-- 测量结果面板集成到按钮组件 -->

    <!-- 右侧图表面板区域 -->
    <div class="right-panels">
      <!-- CLCD 图例 -->
      <div class="panel-card legend-panel">
        <div class="legend-grid">
          <div v-for="(color, name) in clcdColors" :key="name" class="legend-item">
            <span class="legend-color" :style="{ background: color }"></span>
            <span class="legend-name">{{ legendNames[name] }}</span>
          </div>
        </div>
      </div>

      <!-- 当年土地利用结构饼图 -->
      <div class="panel-card chart-panel">
        <LandUsePieChart :year="selectedYear" :seriesData="currentYearData" :compact="true" />
      </div>
    </div>
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
import { useMapStore } from '../stores/map.ts';
import { clcdApi, authApi } from '../api/index.js';
import logoutIcon from '../assets/icons/logout.png';

const router = useRouter();
const mapStore = useMapStore();

const viewer = shallowRef(null);
const clcdLayer = shallowRef(null); // 用于存储当前 CLCD 图层的引用
const baseMapLayer = shallowRef(null); // 用于存储当前底图图层
const cachedClcdData = ref([]); // 缓存 CLCD 数据，避免重复加载

const selectedYear = ref(1985); // 当前选择的年份，默认1985
const currentYearData = ref({}); // 当前年份的数据

// CLCD 颜色映射
const clcdColors = {
  Cropland: 'rgb(250,227,156)',
  Forest: 'rgb(68,111,51)',
  Shrub: 'rgb(51,160,44)',
  Grassland: 'rgb(171,211,123)',
  Water: 'rgb(30,105,180)',
  'Snow/Ice': 'rgb(166,206,227)',
  Barren: 'rgb(207,189,163)',
  Impervious: 'rgb(226,66,144)',
  Wetland: 'rgb(40,155,232)'
};

// 图例中文名称映射
const legendNames = {
  Cropland: '耕地',
  Forest: '林地',
  Shrub: '灌木',
  Grassland: '草地',
  Water: '水域',
  'Snow/Ice': '冰雪',
  Barren: '裸地',
  Impervious: '建设用地',
  Wetland: '湿地'
};

// 退出登录
const handleLogout = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_info');
  router.push('/login');
};

// 验证登录状态
const checkAuth = async () => {
  try {
    await authApi.verify();
  } catch (err) {
    console.error('身份验证失败:', err);
    handleLogout();
  }
};

// 监听年份变化，自动更新 CLCD 图层和图表数据
watch(selectedYear, (newYear) => {
  if (newYear && viewer.value) {
    loadCLCDLayer(newYear);
    loadYearData(newYear);
  }
});

onMounted(async () => {
  // 1. 验证身份
  await checkAuth();

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

    // 开启抗锯齿
    viewer.value.scene.postProcessStages.fxaa.enabled = true;
    // 开启高动态范围渲染
    viewer.value.scene.highDynamicRange = true;
    // 设置分辨率缩放因子，提高清晰度
    viewer.value.resolutionScale = window.devicePixelRatio || 1.0;

    viewer.value.cesiumWidget.creditContainer.style.display = "none";

    // 禁用倾斜控制，保持垂直视角
    viewer.value.scene.screenSpaceCameraController.enableTilt = false;
    // 添加默认底图（天地图影像）
    loadBaseMap('imagery');

    // 加载云南省边界
    Cesium.GeoJsonDataSource.load('/data/yunnan_boundary.geo.json', {
      stroke: Cesium.Color.fromCssColorString('#00E5FF'), // 青色
      fill: Cesium.Color.TRANSPARENT,
      strokeWidth: 10, // 加粗
      markerSize: 0,
      clampToGround: true
    }).then(function (dataSource) {
      viewer.value.dataSources.add(dataSource);
      const entities = dataSource.entities.values;

      // 遍历所有实体，只保留云南省（code: 530000 或 name: 云南）
      for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        const name = entity.properties.name ? entity.properties.name.getValue() : '';
        const code = entity.properties.code ? entity.properties.code.getValue() : '';

        if (name.includes('云南') || code == '530000') {
          // 云南省，设置样式
          if (entity.polyline) {
            entity.polyline.width = 10; // 加粗
            // 使用轮廓材质效果
            entity.polyline.material = new Cesium.PolylineOutlineMaterialProperty({
              color: Cesium.Color.fromCssColorString('#00E5FF'), // 内部青色
              outlineColor: Cesium.Color.fromCssColorString('#00838F'), // 外部深青色描边
              outlineWidth: 6 // 加粗描边
            });
            entity.polyline.clampToGround = true;
          }
          if (entity.polygon) {
            entity.polygon.fill = false;
            entity.polygon.outline = true;
            entity.polygon.outlineColor = Cesium.Color.fromCssColorString('#00E5FF');
            entity.polygon.outlineWidth = 6; // 加粗
          }
        } else {
          // 移除不是云南省区域
          dataSource.entities.remove(entity);
        }
      }
    }).catch(function (error) {
      console.error('加载云南边界数据失败:', error);
    });

    // 设置初始视角到云南省中心，垂直俯视视角
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
      orientation: {
        pitch: Cesium.Math.toRadians(-90),
        roll: 0.0
      }
    });

    // 将 viewer 挂载到 window 对象上，供其他组件使用
    window.cesiumViewer = viewer.value;

    // 将 viewer 注册到 map store，以便其他组件可以使用
    mapStore.setViewer(viewer.value);

    // 加载默认年份（1985）的 CLCD 图层
    loadCLCDLayer(selectedYear.value);
    loadYearData(selectedYear.value);

  } catch (e) {
    console.error('Cesium initialization error:', e);
  }
});

// 加载当年数据（用于图表）- 带缓存优化
async function loadYearData(year) {
  try {
    // 只在第一次加载数据，之后使用缓存
    if (cachedClcdData.value.length === 0) {
      const data = await clcdApi.getProvinceTrend();
      cachedClcdData.value = data;
      console.log('CLCD 数据已加载并缓存 (1985-2023)');
    }

    // 从缓存中按需查询指定年份
    if (cachedClcdData.value.length > 0) {
      const yearData = cachedClcdData.value.find(item => item.year === year);

      if (yearData) {
        // 映射为前端需要的字段名（英文 → 中文）
        currentYearData.value = {
          year: yearData.year,
          耕地: yearData.cropland,
          林地: yearData.forest,
          灌木: yearData.shrub,
          草地: yearData.grassland,
          水域: yearData.water,
          冰雪: yearData.snow_ice,
          裸地: yearData.barren,
          建设用地: yearData.impervious,
          湿地: yearData.wetland
        };
      } else {
        console.warn(`未找到 ${year} 年的数据`);
      }
    }
  } catch (e) {
    console.error('加载 CLCD 数据失败:', e);
  }
}

// 加载底图
function loadBaseMap(mapType) {
  if (!viewer.value) return;

  // 移除现有底图
  if (baseMapLayer.value) {
    viewer.value.imageryLayers.remove(baseMapLayer.value);
    baseMapLayer.value = null;
  }

  const token = 'ab70e90828db5b27aa040f2cb879c7f1';
  let layerName, url;

  switch (mapType) {
    case 'imagery':
      // 天地图影像
      layerName = 'img';
      url = `http://t0.tianditu.gov.cn/img_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'vector':
      // 天地图矢量
      layerName = 'vec';
      url = `http://t0.tianditu.gov.cn/vec_w/wmts?service=wmts&request=GetTile&version=1.0.0&LAYER=${layerName}&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=${token}`;
      break;
    case 'terrain':
      // 天地图地形
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

    // 在索引 0 位置添加底图，确保底图在最底层
    baseMapLayer.value = viewer.value.imageryLayers.addImageryProvider(imageryProvider, 0);
  } catch (e) {
    console.error('加载底图失败:', e);
  }
}

// 处理底图切换
function handleBaseMapChange(mapType) {
  loadBaseMap(mapType);
}

// 加载指定年份的 CLCD WMS 图层
function loadCLCDLayer(year) {
  // 如果已有图层，先移除
  if (clcdLayer.value && viewer.value) {
    viewer.value.imageryLayers.remove(clcdLayer.value, true);
    clcdLayer.value = null;
  }

  try {
    clcdLayer.value = viewer.value.imageryLayers.addImageryProvider(
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
    console.log(`已加载 ${year} 年 CLCD 图层`);
  } catch (e) {
    console.error(`加载 ${year} 年 CLCD 图层失败:`, e);
  }
}

onUnmounted(() => {
  if (viewer.value) {
    viewer.value.dispose();
    viewer.value = null;
  }
  window.cesiumViewer = null;
});
</script>

<style>
/* 全局样式：移除浏览器默认边距 */
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
}
</style>

<style scoped>
#cesiumContainerWrapper {
  position: fixed;
  top: 0;
  left: 0;
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

#cesiumContainer {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 10;
}

/* 顶部标题栏样式 */
.header-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  z-index: 1000;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.header-content {
  position: relative;
  width: 100%;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
}

.project-title {
  margin: 0;
  padding-top: 5px;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 6px;
  color: #ffffff;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 0 20px rgba(59, 130, 246, 0.5);
  font-family: "Microsoft YaHei", sans-serif;
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  padding: 0;
  overflow: hidden;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
}

.logout-icon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  opacity: 0.8;
  transition: all 0.3s ease;
}

.logout-btn:hover .logout-icon-img {
  opacity: 1;
  transform: scale(1.1);
}

.logout-btn svg {
  width: 20px;
  height: 20px;
}

.logout-btn:hover {
  color: #fca5a5;
  transform: scale(1.1);
}

.background-layer {
  position: fixed;
  top: -2%;
  left: -2%;
  right: -2%;
  bottom: -2%;
  width: 104vw;
  height: 104vh;
  z-index: 100;
  pointer-events: none;
  background-image: url('../assets/images/front_bg.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center center;
}

.year-selector-container {
  position: fixed;
  top: 40px;
  left: 20px;
  z-index: 1100;
}

.bottom-controls-container {
  position: fixed;
  bottom: 30px;
  left: 20px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-height: 160px;
}

.basemap-selector-container {
  position: fixed;
  top: 40px;
  left: 250px;
  z-index: 1100;
}

.right-panels {
  position: fixed;
  right: 20px;
  top: 20px;
  width: 450px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
  z-index: 150;
}

.panel-card {
  background: rgba(13, 25, 48, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(16px) saturate(180%);
  overflow: hidden;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-title {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #a5ccff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(90deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 58, 138, 0) 100%);
  display: flex;
  align-items: center;
}

.panel-title::before {
  content: '';
  width: 3px;
  height: 12px;
  background: #3b82f6;
  margin-right: 8px;
  border-radius: 2px;
}

.legend-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  padding: 12px 16px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.legend-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.legend-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.chart-panel {
  min-height: 220px;
}

.right-panels::-webkit-scrollbar {
  width: 4px;
}

.right-panels::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
</style>
