<template>
    <div class="prefecture-pie-control">
        <button @click="togglePrefecturePie" class="control-btn" :class="{ active: isActive }" title="各州市土地利用结构">
            <svg class="icon-svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
        </button>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as Cesium from 'cesium';
import { useMapStore } from '../../stores/map';

const props = defineProps({
    year: { type: Number, default: 1985 }
});

const mapStore = useMapStore();
const isActive = ref(false);

let prefectureDataSource = null; // 地级市边界数据源
let provinceDataSource = null;   // 省级边界数据源
let pieEntities = [];
let prefectureData = null;
const cityInfoMap = new Map(); // cityName -> [lon, lat]

// CLCD 颜色映射
const landUseColors = {
    cropland: 'rgb(250,227,156)',
    forest: 'rgb(68,111,51)',
    shrubland: 'rgb(51,160,44)',
    grassland: 'rgb(171,211,123)',
    water: 'rgb(30,105,180)',
    tundra: 'rgb(166,206,227)',
    bareland: 'rgb(207,189,163)',
    impervious: 'rgb(226,66,144)',
    wetland: 'rgb(40,155,232)'
};

async function loadPrefectureData() {
    if (prefectureData) return prefectureData;
    try {
        const resp = await fetch('/data/clcd_prefecture.json');
        prefectureData = await resp.json();
        return prefectureData;
    } catch (e) {
        console.error('加载地级市数据失败:', e);
        return [];
    }
}

function getCityData(name, year) {
    if (!prefectureData) return null;
    return prefectureData.find(d => d.region_name.includes(name) && d.year === year);
}

function createPieChartCanvas(cityData, cityName) {
    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size + 18;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const radius = 30;

    // 背景蒙版
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();

    if (!cityData) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#888888';
        ctx.fill();
    } else {
        const types = ['cropland', 'forest', 'shrubland', 'grassland', 'water', 'wetland', 'impervious', 'bareland', 'tundra'];
        const values = types.map(t => cityData[t] || 0);
        const total = values.reduce((a, b) => a + b, 0);
        if (total > 0) {
            let start = -Math.PI / 2;
            types.forEach((type, i) => {
                if (values[i] > 0) {
                    const angle = (values[i] / total) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.arc(cx, cy, radius, start, start + angle);
                    ctx.closePath();
                    ctx.fillStyle = landUseColors[type];
                    ctx.fill();
                    start += angle;
                }
            });
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // 城市名称背景与文字
    ctx.font = 'bold 11px Microsoft YaHei, sans-serif';
    const textW = ctx.measureText(cityName).width;
    ctx.fillStyle = 'rgba(50,50,50,0.85)';
    ctx.fillRect(cx - textW / 2 - 4, size + 2, textW + 8, 14);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(cityName, cx, size + 13);

    return canvas.toDataURL();
}

async function showPrefecturePie() {
    const viewer = mapStore.viewer;
    if (!viewer) { console.error('Cesium viewer 未初始化'); return; }

    await loadPrefectureData();

    try {
        const resp = await fetch('/data/yunnan_cities_boundary.geo.json');
        const geo = await resp.json();
        // 收集中心点
        geo.features.forEach(f => {
            const name = f.properties.name;
            const center = f.properties.center;
            if (name && center) cityInfoMap.set(name, center);
        });
        // 地级市边界
        prefectureDataSource = await Cesium.GeoJsonDataSource.load(geo, {
            stroke: Cesium.Color.fromCssColorString('#666666'),
            strokeWidth: 2,
            fill: Cesium.Color.TRANSPARENT,
            clampToGround: true
        });
        viewer.dataSources.add(prefectureDataSource);
        // 样式
        prefectureDataSource.entities.values.forEach(e => {
            if (e.polyline) {
                e.polyline.material = Cesium.Color.fromCssColorString('#555555');
                e.polyline.width = 2;
                e.polyline.clampToGround = true;
            }
        });
        // 省级边界
        const provResp = await fetch('/data/yunnan_boundary.geo.json');
        const provGeo = await provResp.json();
        provinceDataSource = await Cesium.GeoJsonDataSource.load(provGeo, {
            stroke: Cesium.Color.fromCssColorString('#00E5FF'),
            strokeWidth: 3,
            fill: Cesium.Color.TRANSPARENT,
            clampToGround: true
        });
        viewer.dataSources.add(provinceDataSource);
        // 饼图
        addPieCharts(viewer);
    } catch (e) {
        console.error('加载地级市或省级边界失败:', e);
    }
}

function hidePrefecturePie() {
    const viewer = mapStore.viewer;
    if (!viewer) return;
    if (prefectureDataSource) { viewer.dataSources.remove(prefectureDataSource, true); prefectureDataSource = null; }
    if (provinceDataSource) { viewer.dataSources.remove(provinceDataSource, true); provinceDataSource = null; }
    pieEntities.forEach(ent => viewer.entities.remove(ent));
    pieEntities = [];
}

function addPieCharts(viewer) {
    cityInfoMap.forEach((center, name) => {
        const data = getCityData(name, props.year);
        const entity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(center[0], center[1], 0),
            billboard: {
                image: createPieChartCanvas(data, name),
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                scale: 1.0,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            }
        });
        pieEntities.push(entity);
    });
}

function togglePrefecturePie() {
    isActive.value = !isActive.value;
    if (isActive.value) showPrefecturePie(); else hidePrefecturePie();
}

watch(() => props.year, () => {
    if (isActive.value) {
        // 重新绘制饼图
        const viewer = mapStore.viewer;
        if (!viewer) return;
        pieEntities.forEach(e => viewer.entities.remove(e));
        pieEntities = [];
        addPieCharts(viewer);
    }
});

onMounted(() => { loadPrefectureData(); });
onUnmounted(() => { hidePrefecturePie(); });
</script>

<style scoped>
.prefecture-pie-control {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2000;
    pointer-events: none;
}

.control-btn {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(42, 61, 110, 0.2);
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
}

.control-btn:hover {
    background: rgba(52, 71, 130, 0.4);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.control-btn.active {
    background: rgba(156, 201, 255, 0.2);
    border-color: #9cc9ff;
    box-shadow: 0 0 3px rgba(156, 201, 255, 0.2);
}

.icon {
    font-size: 24px;
}
</style>
