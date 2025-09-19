<template>
  <div id="cesiumContainerWrapper">
    <div id="cesiumContainer"></div>

    <!-- 复位按钮 -->
    <button id="resetViewButton" @click="resetViewToYunnan" title="缩放至云南范围">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20px" height="20px">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"/>
      </svg>
    </button>

    <!-- 顶部工具条（占位） -->
    <div class="top-toolbar">
      <div class="brand">
        <span class="brand-dot"></span>
        <span>国土空间规划“一张图” | 实施监测预警(CSPON) </span>
      </div>
      <div class="toolbar-actions">
        <button class="tb-btn">全国</button>
        <button class="tb-btn">2024年</button>
        <button class="tb-btn">底图</button>
      </div>
    </div>

    <!-- 左侧信息面板 -->
    <aside class="side-panel" :class="{ collapsed: isPanelCollapsed }">
      <header class="panel-header" @click="togglePanel">
        <div class="title">
          <span class="bullet"></span>
          <span>国土空间格局</span>
        </div>
        <button class="collapse-btn" :aria-expanded="!isPanelCollapsed">{{ isPanelCollapsed ? '展开' : '收起' }}</button>
      </header>

      <section class="panel-section">
        <div class="section-title">
          <span class="dot orange"></span>
          <span>格局演变</span>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">土地利用变化评价</div>
          <ul class="kpi-list">
            <li>
              <span class="kpi-name">耕地面积</span>
              <span class="kpi-value">{{ kpis.cultivated.area }} km²</span>
              <span class="kpi-delta" :class="{ up: kpis.cultivated.delta > 0, down: kpis.cultivated.delta < 0 }">{{ signed(kpis.cultivated.delta) }}</span>
            </li>
            <li>
              <span class="kpi-name">城镇用地面积</span>
              <span class="kpi-value">{{ kpis.urban.area }} km²</span>
              <span class="kpi-delta" :class="{ up: kpis.urban.delta > 0, down: kpis.urban.delta < 0 }">{{ signed(kpis.urban.delta) }}</span>
            </li>
            <li>
              <span class="kpi-name">城镇用地扩张速率</span>
              <span class="kpi-value">{{ kpis.urbanRate.area }} km²/yr</span>
              <span class="kpi-delta" :class="{ up: kpis.urbanRate.delta > 0, down: kpis.urbanRate.delta < 0 }">{{ signed(kpis.urbanRate.delta) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="panel-section">
        <div class="section-title">
          <span class="dot green"></span>
          <span>功能演变</span>
        </div>
        <div class="kpi-grid">
          <div class="mini-kpi">
            <div class="mini-name">农业功能均衡评价</div>
            <div class="mini-value">{{ kpis.agriBalance }}</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-name">城镇功能均衡评价</div>
            <div class="mini-value">{{ kpis.urbanBalance }}</div>
          </div>
          <div class="mini-kpi">
            <div class="mini-name">生态功能均衡评价</div>
            <div class="mini-value">{{ kpis.ecoBalance }}</div>
          </div>
        </div>
      </section>

      <!-- 当年TOP榜 -->
      <section class="panel-section">
        <div class="section-title">
          <span class="dot"></span>
          <span>{{ years[yearIndex] }} 年地类面积 TOP3</span>
        </div>
        <ul class="rank-list">
          <li v-for="(item, idx) in currentTop3" :key="'t'+idx">
            <span class="rank-index">{{ idx + 1 }}</span>
            <span class="rank-name">{{ item.name }}</span>
            <span class="rank-value">{{ formatNum(item.value) }} km²</span>
          </li>
        </ul>
      </section>

      <!-- 年度变化TOP榜（相对上一年） -->
      <section class="panel-section">
        <div class="section-title">
          <span class="dot"></span>
          <span>{{ years[yearIndex] }} 较上一年变化 TOP3</span>
        </div>
        <ul class="rank-list">
          <li v-for="(item, idx) in changeTop3" :key="'c'+idx">
            <span class="rank-index">{{ idx + 1 }}</span>
            <span class="rank-name">{{ item.name }}</span>
            <span class="rank-delta" :class="{ up: item.delta > 0, down: item.delta < 0 }">{{ signed(item.delta) }} km²</span>
          </li>
        </ul>
      </section>
    </aside>

    <!-- 右侧图例与图表卡片 -->
    <div class="right-cards">
      <div class="card legend-card">
        <div class="card-title">图例</div>
        <ul class="legend-list">
          <li><span class="legend" :style="{background: clcdColors.Cropland}"></span>耕地</li>
          <li><span class="legend" :style="{background: clcdColors.Forest}"></span>林地</li>
          <li><span class="legend" :style="{background: clcdColors.Shrub}"></span>灌木</li>
          <li><span class="legend" :style="{background: clcdColors.Grassland}"></span>草地</li>
          <li><span class="legend" :style="{background: clcdColors.Water}"></span>水域</li>
          <li><span class="legend" :style="{background: clcdColors.SnowIce}"></span>冰雪</li>
          <li><span class="legend" :style="{background: clcdColors.Barren}"></span>裸地</li>
          <li><span class="legend" :style="{background: clcdColors.Impervious}"></span>建设用地</li>
          <li><span class="legend" :style="{background: clcdColors.Wetland}"></span>湿地</li>
        </ul>
      </div>
      <div class="card trend-card">
        <div class="card-title">年度总面积变化</div>
        <StackedTrend />
      </div>
      <div class="card pie-card">
        <div class="card-title">{{ years[yearIndex] }} 年地类占比</div>
        <RoseCurrent />
      </div>
    </div>

    <!-- 时间滑块 -->
    <div id="timeSliderContainer">
      <input
        type="range"
        min="0"
        :max="years.length - 1"
        step="1"
        v-model="yearIndex"
        @input="switchYearLayer" 
      />
      <span>{{ years[yearIndex] }}</span>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, nextTick } from 'vue'; 
import StackedTrend from './charts/StackedTrend.vue';
import RoseCurrent from './charts/RoseCurrent.vue';
import * as Cesium from 'cesium'; 
import 'cesium/Build/Cesium/Widgets/widgets.css';

let viewer = null;
let cityLayerDataSource = null;
let wmsLayer = null;

// 年份数组
const years = ref([1985, ...Array.from({ length: 2023 - 1990 + 1 }, (_, i) => 1990 + i)]);
const yearIndex = ref(0); // 默认显示第一个1985

// UI：面板与占位数据
const isPanelCollapsed = ref(false);
const kpis = ref({
  cultivated: { area: 3078.12, delta: 7.25 },
  urban: { area: 15780.64, delta: 12.14 },
  urbanRate: { area: 65, delta: -2.25 },
  agriBalance: 0.456,
  urbanBalance: 0.343,
  ecoBalance: 0.698
});

const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
const togglePanel = () => { isPanelCollapsed.value = !isPanelCollapsed.value; };

// CLCD 配色（来自截图RGB）
const clcdColors = {
  Cropland: 'rgb(250,227,156)',
  Forest: 'rgb(68,111,51)',
  Shrub: 'rgb(51,160,44)',
  Grassland: 'rgb(171,211,123)',
  Water: 'rgb(30,105,180)',
  SnowIce: 'rgb(166,206,227)',
  Barren: 'rgb(207,189,163)',
  Impervious: 'rgb(226,66,144)',
  Wetland: 'rgb(40,155,232)'
};

// 图表：堆叠面积折线与饼图（以占位数据为例，后续接入数据库）
const lineChartRef = ref(null);
let lineChartInstance = null;
const pieChartRef = ref(null);
let pieChartInstance = null;
// 从后端拉取的实际数据
const serverSeries = ref([]); // [{year, landuse_type, area_km2}]

// 占位数据结构：每年各类面积（km²）
const yearsAll = ref([1985, ...Array.from({ length: 2023 - 1990 + 1 }, (_, i) => 1990 + i)]);
const clcdClasses = ['Cropland','Forest','Shrub','Grassland','Water','SnowIce','Barren','Impervious','Wetland'];
// 简化：生成一些可视化占位数据（后续由后端替换）
const mockSeriesByYear = ref({});
function generateMock() {
  const data = {};
  yearsAll.value.forEach((y, idx) => {
    data[y] = {
      Cropland: 120000 - idx * 300 + 500 * Math.sin(idx/2),
      Forest: 150000 + idx * 120,
      Shrub: 23000 + 50 * idx,
      Grassland: 80000 - idx * 150,
      Water: 12000 + 10 * idx,
      SnowIce: 800 + Math.max(0, 20 - idx * 2),
      Barren: 16000 - 50 * idx,
      Impervious: 9000 + 120 * idx,
      Wetland: 9000 + 12 * idx
    };
  });
  mockSeriesByYear.value = data;
}
generateMock();

// 拉取后端真实序列并覆盖占位数据
async function fetchSeriesFromServer() {
  try {
    const resp = await fetch('/api/clcd/series');
    const data = await resp.json();
    serverSeries.value = data;
    const grouped = {};
    // 后端已返回 class_name；兼容旧字段 class_code/landuse_type
    data.forEach(row => {
      const y = row.year ?? row.Year ?? row.y;
      const name = (row.class_name || row.class || row.name);
      const area = Number(row.area_km2 ?? row.area ?? 0);
      if (!grouped[y]) grouped[y] = {};
      if (name) grouped[y][name] = area;
    });
    const yearsSorted = Array.from(new Set(data.map(d => d.year))).sort((a,b)=>a-b);
    yearsAll.value = yearsSorted;
    years.value = yearsSorted; // 同步时间滑块年份源
    mockSeriesByYear.value = grouped; // 用真实数据覆盖
    renderLineChart();
    renderPieChart();
    recomputeRanks();
  } catch (e) {
    console.error('fetch series failed', e);
  }
}

// 占位接口：从后端获取数据，填充 mockSeriesByYear
async function fetchCLCDSeriesFromAPI() {
  // TODO: 替换为真实API
  // const resp = await fetch('/api/clcd-series?region=yunnan');
  // const json = await resp.json();
  // mockSeriesByYear.value = json.seriesByYear; // 形如 { 1990: {Cropland:..., ...}, ... }
  // yearsAll.value = json.years;
  // renderLineChart(); renderPieChart(); recomputeRanks();
}

function renderLineChart() {
  if (!lineChartInstance && lineChartRef.value) {
    lineChartInstance = echarts.init(lineChartRef.value);
  }
  const series = clcdClasses.map(cls => ({
    name: cls,
    type: 'line',
    stack: 'total',
    smooth: true,
    showSymbol: false,
    areaStyle: { opacity: 0.25 },
    lineStyle: { width: 1.5 },
    emphasis: { focus: 'series' },
    itemStyle: { color: clcdColors[cls] },
    data: yearsAll.value.map(y => (mockSeriesByYear.value[y]?.[cls] ?? 0))
  }));

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', textStyle: { color: '#e8f0fb' } },
    grid: { left: 40, right: 10, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: yearsAll.value },
    yAxis: { type: 'value', name: 'km²' },
    series
  };
  lineChartInstance && lineChartInstance.setOption(option);
}

function renderPieChart() {
  const y = years.value[yearIndex.value];
  const obj = mockSeriesByYear.value[y] || {};
  const seriesData = clcdClasses.map(c => ({ name: c, value: obj[c] || 0, itemStyle: { color: clcdColors[c] } }));
  if (!pieChartInstance && pieChartRef.value) {
    pieChartInstance = echarts.init(pieChartRef.value);
  }
  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} km² ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['40%','75%'],
      center: ['50%','50%'],
      data: seriesData,
      label: { color: '#e8f0fb' }
    }]
  };
  pieChartInstance && pieChartInstance.setOption(option);
}

watch([yearIndex], () => {
  nextTick(() => renderPieChart());
});

// 排行：当前年份TOP3 & 同比变化TOP3
const currentTop3 = ref([]);
const changeTop3 = ref([]);
const formatNum = (v) => Number(v).toLocaleString();

function recomputeRanks() {
  const y = years.value[yearIndex.value];
  const obj = mockSeriesByYear.value[y] || {};
  currentTop3.value = clcdClasses
    .map(c => ({ name: c, value: obj[c] || 0 }))
    .sort((a,b) => b.value - a.value)
    .slice(0,3);

  const prevY = years.value[yearIndex.value - 1];
  const prevObj = mockSeriesByYear.value[prevY] || {};
  changeTop3.value = clcdClasses
    .map(c => ({ name: c, delta: (obj[c]||0) - (prevObj[c]||0) }))
    .sort((a,b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0,3);
}

watch([yearIndex], () => { recomputeRanks(); });

const initMap = () => {
  Cesium.Ion.defaultAccessToken = // Cesium在线底图Token
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjZDNhNDE3Yy1mYjkxLTQ2YzMtYTczNy1hODA4OGVlNTMxOGIiLCJpZCI6MTMyMzI5LCJpYXQiOjE3NDkxMDc3MDF9.vlEXqaZLyWOZ6_XhdkCJr0NqqoqmuOryn2IHX3CV1z4';

  viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false, // 获取动画小部件
    baseLayerPicker: true, // Cesium默认底图选择
    fullscreenButton: true, // 全屏按钮
    geocoder: true, // 地理编码
    homeButton: false, // Cesium默认复位
    infoBox: true,  // 
    sceneModePicker: true, // 3D/2D场景切换 
    selectionIndicator: true,
    timeline: false, // 时间轴
    navigationHelpButton: false, // 帮助按钮
    skyAtmosphere: false, // 蓝色天空和椭球体光晕效果
    shouldAnimate: true
  });
};

// 加载云南 GeoJSON 行政区
const addJson = async () => {
  try {
    const cityGeoJson = '/data/ali_530100_full.json'; // 阿里云GeoJson文件路径
    cityLayerDataSource = await Cesium.GeoJsonDataSource.load(cityGeoJson, {
      stroke: Cesium.Color.RED, // 边界颜色
      strokeWidth: 0, // 线宽
      fill: Cesium.Color.PINK.withAlpha(0), // 填充颜色以及透明度
      clampToGround: false, // 贴地
    });
    cityLayerDataSource.name = "Yunnan Cities Outline";
    viewer.dataSources.add(cityLayerDataSource);
    await viewer.flyTo(cityLayerDataSource.entities, { duration: 2 });
  } catch (error) {
    console.error('GeoJSON loading failed:', error);
  }
};

// 从GeoServer服务器添加 WMS 图层
const addWmsLayer = (year) => {
  if (wmsLayer) {
    viewer.imageryLayers.remove(wmsLayer, true);
  }
  wmsLayer = viewer.imageryLayers.addImageryProvider(
    new Cesium.WebMapServiceImageryProvider({
      url: 'http://localhost:8080/geoserver/WebGIS/wms', //服务器地址端口，工作空间和WMS服务
      layers: `WebGIS:${year}_yunnan_CLCD_raster`, // 图层名称，使用年份通配符
      parameters: {
        service: 'WMS', // 服务方式，栅格为Web Map Server
        version: '1.1.0', // Openlayers版本
        request: 'GetMap', 
        format: 'image/png', // 栅格瓦片格式
        transparent: true
      }
    })
  );
};

// 不同年份CLCD图层切换滑块
const switchYearLayer = () => {
  const selectedYear = years.value[yearIndex.value];
  addWmsLayer(selectedYear);
};

// 复位视图
const resetViewToYunnan = async () => {
  if (viewer && cityLayerDataSource) {
    await viewer.flyTo(cityLayerDataSource.entities, { duration: 2 });
  }
};

onMounted(() => {
  initMap();
  if (viewer) {
    addJson();
    addWmsLayer(years.value[yearIndex.value]);
  }
  nextTick(() => {
    renderLineChart();
    renderPieChart();
    recomputeRanks();
    window.addEventListener('resize', () => {
      lineChartInstance && lineChartInstance.resize();
      pieChartInstance && pieChartInstance.resize();
    });
  });
  // 拉取真实数据
  fetchSeriesFromServer();
});
</script>

<style scoped>
#cesiumContainerWrapper {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
#cesiumContainer {
  width: 100%;
  height: 100%;
}
/* 顶部工具条 */
.top-toolbar {
  position: absolute;
  top: 7px;
  left: 56px;
  right: 125px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(20, 28, 38, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #e7eef7;
  backdrop-filter: blur(6px);
  z-index: 120;
}
.brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.brand-dot { width: 8px; height: 8px; border-radius: 50%; background: #3fbfff; box-shadow: 0 0 8px #3fbfff; }
.toolbar-actions { display: flex; gap: 8px; }
.tb-btn { background: rgba(255,255,255,0.08); color: #e7eef7; border: 1px solid rgba(255,255,255,0.18); padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.tb-btn:hover { background: rgba(255,255,255,0.14); }

/* 左侧面板 */
.side-panel {
  position: absolute;
  top: 60px;
  left: 16px;
  width: 360px;
  max-height: calc(100% - 80px);
  overflow: auto;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  color: #e8f0fb;
  backdrop-filter: blur(8px);
  z-index: 110;
  transition: transform 0.25s ease;
}
.side-panel.collapsed { transform: translateX(-380px); }
.panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
.panel-header .title { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.panel-header .bullet { width: 6px; height: 6px; border-radius: 50%; background: #3fbfff; box-shadow: 0 0 6px #3fbfff; }
.collapse-btn { background: rgba(255,255,255,0.08); color: #e7eef7; border: 1px solid rgba(255,255,255,0.18); padding: 4px 8px; border-radius: 6px; }
.panel-section { padding: 10px 12px; }
.section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 600; }
.dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
.dot.orange { background: #ffb86b; box-shadow: 0 0 6px #ffb86b; }
.dot.green { background: #7ce38b; box-shadow: 0 0 6px #7ce38b; }
.kpi-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px; }
.kpi-title { color: #9cc9ff; margin-bottom: 8px; font-weight: 600; }
.kpi-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.kpi-list li { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 6px; }
.kpi-name { color: #d7e9ff; }
.kpi-value { font-weight: 700; }
.kpi-delta { width: 64px; text-align: right; }
.kpi-delta.up { color: #3ddc97; }
.kpi-delta.down { color: #ff6b6b; }
.kpi-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
.mini-kpi { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; }
.mini-name { color: #d7e9ff; margin-bottom: 4px; }
.mini-value { font-weight: 800; font-size: 18px; color: #fff; }
.rank-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.rank-list li { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 6px; }
.rank-index { font-weight: 800; color: #9cc9ff; }
.rank-name { color: #e8f0fb; }
.rank-value { font-weight: 700; }
.rank-delta.up { color: #3ddc97; }
.rank-delta.down { color: #ff6b6b; }

/* 右侧卡片 */
.right-cards { position: absolute; right: 16px; top: 72px; display: grid; gap: 10px; width: 320px; z-index: 110; }
.card { background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; color: #e8f0fb; backdrop-filter: blur(8px); padding: 10px; }
.card-title { font-weight: 700; margin-bottom: 8px; color: #9cc9ff; }
.legend-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
.legend { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 6px; border: 1px solid rgba(255,255,255,0.5); }
.chart { width: 100%; height: 180px; }
#resetViewButton {
  position: absolute;
  top: 7px;
  left: 10px;
  z-index: 100;
  padding: 8px;
  background-color: rgba(45, 45, 45, 0.8);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 2px;
  cursor: pointer;
  width: 35px;
  height: 35px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#timeSliderContainer {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.85);
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 200;
}
#timeSliderContainer input {
  width: 300px;
}
</style>
