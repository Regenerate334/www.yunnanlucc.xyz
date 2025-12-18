<template>
    <div class="measurement-control-container">
        <!-- 测量按钮组 -->
        <div class="measurement-buttons">
            <button class="measure-btn" :class="{ active: activeTool === 'distance' }" @click="activateTool('distance')"
                title="测距">
                <span class="icon">📏</span>
            </button>
            <button class="measure-btn" :class="{ active: activeTool === 'area' }" @click="activateTool('area')"
                title="测面积">
                <span class="icon">📐</span>
            </button>
        </div>

        <!-- 结果面板 -->
        <div v-if="showResultPanel" class="result-panel">
            <div class="panel-header">
                <span class="panel-title">单位</span>
                <select class="unit-select" v-model="unitSystem">
                    <option value="metric">公制</option>
                </select>
                <button class="close-btn" @click="clearMeasurement">×</button>
            </div>

            <div class="panel-content">
                <!-- 测距结果 -->
                <div v-if="activeTool === 'distance'" class="result-list">
                    <div class="result-item">
                        <span class="label">直线</span>
                        <span class="value">{{ formatDistance(results.straight) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">水平</span>
                        <span class="value">{{ formatDistance(results.horizontal) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">垂直</span>
                        <span class="value">{{ formatDistance(results.vertical) }}</span>
                    </div>
                </div>

                <!-- 测面结果 -->
                <div v-if="activeTool === 'area'" class="result-list">
                    <div class="result-item">
                        <span class="label">面积</span>
                        <span class="value">{{ formatArea(results.area) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">周长</span>
                        <span class="value">{{ formatDistance(results.perimeter) }}</span>
                    </div>
                </div>
            </div>

            <div class="panel-footer">
                <button class="new-measure-btn" @click="restartMeasurement">新测量</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import * as Cesium from 'cesium';
import { useMapStore } from '../../stores/map.ts';

const mapStore = useMapStore();
const activeTool = ref(null); // 'distance' | 'area' | null
const showResultPanel = ref(false);
const unitSystem = ref('metric');

// 测量结果数据
const results = reactive({
    straight: 0,
    horizontal: 0,
    vertical: 0,
    area: 0,
    perimeter: 0
});

// Cesium 相关变量
let handler = null;
let activeShapePoints = [];
let activeShape = null;
let floatingPoint = null;
let entities = []; // 存储所有绘制的实体

// 激活工具
const activateTool = (tool) => {
    clearMeasurement(); // 先清除之前的
    activeTool.value = tool;
    showResultPanel.value = true;

    const viewer = mapStore.viewer;
    if (!viewer) return;

    if (tool === 'distance') {
        startDistanceMeasure(viewer);
    } else if (tool === 'area') {
        startAreaMeasure(viewer);
    }
};

// 清除测量
const clearMeasurement = () => {
    const viewer = mapStore.viewer;
    if (viewer) {
        // 移除所有实体
        entities.forEach(entity => viewer.entities.remove(entity));
        entities = [];

        // 移除临时点和形状
        if (floatingPoint) {
            viewer.entities.remove(floatingPoint);
            floatingPoint = null;
        }
        if (activeShape) {
            viewer.entities.remove(activeShape);
            activeShape = null;
        }

        // 销毁 handler
        if (handler) {
            handler.destroy();
            handler = null;
        }
    }

    activeShapePoints = [];
    activeTool.value = null;
    showResultPanel.value = false;
    resetResults();
};

// 重新开始当前测量
const restartMeasurement = () => {
    const currentTool = activeTool.value;
    clearMeasurement();
    if (currentTool) {
        activateTool(currentTool);
    }
};

const resetResults = () => {
    results.straight = 0;
    results.horizontal = 0;
    results.vertical = 0;
    results.area = 0;
    results.perimeter = 0;
};

// ==================== 测距逻辑 ====================
const startDistanceMeasure = (viewer) => {
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // 左键点击：添加点
    handler.setInputAction((event) => {
        const earthPosition = pickPosition(viewer, event.position);
        if (Cesium.defined(earthPosition)) {
            if (activeShapePoints.length === 0) {
                floatingPoint = createPoint(viewer, earthPosition);
                activeShapePoints.push(earthPosition);

                // 创建动态线
                const dynamicLine = viewer.entities.add({
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => activeShapePoints, false),
                        width: 8, // 加宽线条
                        material: new Cesium.PolylineDashMaterialProperty({
                            color: Cesium.Color.fromCssColorString('#ff9900'),
                            gapColor: Cesium.Color.WHITE,
                            dashLength: 32, // 更大的方格
                            dashPattern: 255 // 实线段
                        }),
                        depthFailMaterial: new Cesium.PolylineDashMaterialProperty({
                            color: Cesium.Color.fromCssColorString('#ff9900'),
                            gapColor: Cesium.Color.WHITE,
                            dashLength: 32,
                            dashPattern: 255
                        }),
                        clampToGround: true
                    }
                });
                entities.push(dynamicLine);
            }

            activeShapePoints.push(earthPosition);
            createPoint(viewer, earthPosition);

            // 两点确定一条线，测距通常只测两点（根据需求，如果是多段线需要调整逻辑，这里实现两点测距）
            if (activeShapePoints.length === 3) { // start, end, moving
                activeShapePoints.pop(); // 移除移动点
                finishDistanceMeasure(viewer);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 鼠标移动：更新终点
    handler.setInputAction((event) => {
        if (Cesium.defined(floatingPoint)) {
            const newPosition = pickPosition(viewer, event.endPosition);
            if (Cesium.defined(newPosition)) {
                activeShapePoints.pop();
                activeShapePoints.push(newPosition);

                // 实时计算结果
                if (activeShapePoints.length >= 2) {
                    calculateDistance(activeShapePoints[0], activeShapePoints[1]);
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 右键点击：取消/结束（对于两点测距，左键第二次点击即结束，右键可用于取消）
    handler.setInputAction(() => {
        clearMeasurement();
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
};

const finishDistanceMeasure = (viewer) => {
    if (handler) {
        handler.destroy();
        handler = null;
    }
    if (floatingPoint) {
        viewer.entities.remove(floatingPoint);
        floatingPoint = null;
    }
    // 最终计算
    calculateDistance(activeShapePoints[0], activeShapePoints[1]);
};

const calculateDistance = (p1, p2) => {
    // 直线距离
    const straight = Cesium.Cartesian3.distance(p1, p2);
    results.straight = straight;

    // 转换为经纬度计算水平和垂直距离
    const c1 = Cesium.Cartographic.fromCartesian(p1);
    const c2 = Cesium.Cartographic.fromCartesian(p2);

    // 垂直距离 (高度差)
    results.vertical = Math.abs(c1.height - c2.height);

    // 水平距离 (投影到椭球体表面)
    const geodesic = new Cesium.EllipsoidGeodesic();
    geodesic.setEndPoints(c1, c2);
    results.horizontal = geodesic.surfaceDistance;
};

// ==================== 测面逻辑 ====================
const startAreaMeasure = (viewer) => {
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // 左键点击：添加点
    handler.setInputAction((event) => {
        const earthPosition = pickPosition(viewer, event.position);
        if (Cesium.defined(earthPosition)) {
            if (activeShapePoints.length === 0) {
                floatingPoint = createPoint(viewer, earthPosition);
                activeShapePoints.push(earthPosition);

                // 创建动态多边形
                activeShape = viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(activeShapePoints), false),
                        material: Cesium.Color.fromCssColorString('#ff9900').withAlpha(0.3),
                        outline: true,
                        outlineColor: Cesium.Color.fromCssColorString('#ff9900'),
                        outlineWidth: 2
                    }
                });
                entities.push(activeShape);
            }
            activeShapePoints.push(earthPosition);
            createPoint(viewer, earthPosition);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 鼠标移动
    handler.setInputAction((event) => {
        if (Cesium.defined(floatingPoint)) {
            const newPosition = pickPosition(viewer, event.endPosition);
            if (Cesium.defined(newPosition)) {
                activeShapePoints.pop();
                activeShapePoints.push(newPosition);

                // 实时计算（可选，如果点多会卡顿，可以只在点击时计算）
                if (activeShapePoints.length >= 3) {
                    calculateArea(activeShapePoints);
                }
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // 右键点击：结束绘制
    handler.setInputAction(() => {
        activeShapePoints.pop(); // 移除最后一个移动点
        finishAreaMeasure(viewer);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
};

const finishAreaMeasure = (viewer) => {
    if (handler) {
        handler.destroy();
        handler = null;
    }
    if (floatingPoint) {
        viewer.entities.remove(floatingPoint);
        floatingPoint = null;
    }
    calculateArea(activeShapePoints);
};

const calculateArea = (positions) => {
    if (positions.length < 3) return;

    // 计算面积 (简化算法，适用于小范围，大范围需用 geodesic)
    // 这里使用 Cesium 的 PolygonGeometry 来计算
    // 注意：CoplanarPolygonGeometry 需要点共面，GeoJsonDataSource 也是投影到椭球。
    // 简单的近似计算：

    // 1. 周长
    let perimeter = 0;
    for (let i = 0; i < positions.length; i++) {
        const p1 = positions[i];
        const p2 = positions[(i + 1) % positions.length];
        perimeter += Cesium.Cartesian3.distance(p1, p2);
    }
    results.perimeter = perimeter;

    // 2. 面积 (使用三角剖分或投影面积)
    // 简单方法：将点转为 Cartographic，然后计算多边形面积
    // 严谨方法比较复杂，这里使用 turf.js 或者简化的平面投影近似（如果范围不大）
    // 为了不引入 turf，我们使用一种近似方法：

    // 尝试使用 PolygonGeometryLibrary (内部API) 或者自己实现 Shoelace formula (投影后)
    // 这里使用一个简单的近似：
    let area = 0;
    // 转换为 Cartographic
    const cartographics = positions.map(p => Cesium.Cartographic.fromCartesian(p));

    // 简单的梯形公式 (Shoelace) - 投影到 2D 平面 (Mercator) 或直接用经纬度近似 (如果不跨越极大范围)
    // 更准确的是使用 Cesium 官方示例中的计算方法

    // 参考 Cesium 官方计算多边形面积的方法 (Triangulation)
    const hierarchy = new Cesium.PolygonHierarchy(positions);
    const indices = Cesium.PolygonPipeline.triangulate(hierarchy.positions, hierarchy.holes);

    for (let i = 0; i < indices.length; i += 3) {
        const p0 = positions[indices[i]];
        const p1 = positions[indices[i + 1]];
        const p2 = positions[indices[i + 2]];

        // 计算三角形面积 (海伦公式 或 向量积)
        // Area = 0.5 * |AB x AC|
        const ab = Cesium.Cartesian3.subtract(p1, p0, new Cesium.Cartesian3());
        const ac = Cesium.Cartesian3.subtract(p2, p0, new Cesium.Cartesian3());
        const cross = Cesium.Cartesian3.cross(ab, ac, new Cesium.Cartesian3());
        area += 0.5 * Cesium.Cartesian3.magnitude(cross);
    }

    results.area = area;
};

// ==================== 辅助函数 ====================
const pickPosition = (viewer, position) => {
    // 尝试拾取物体
    const pickedObject = viewer.scene.pick(position);
    if (viewer.scene.pickPositionSupported && Cesium.defined(pickedObject)) {
        return viewer.scene.pickPosition(position);
    }
    // 否则拾取地球表面
    const ray = viewer.camera.getPickRay(position);
    return viewer.scene.globe.pick(ray, viewer.scene);
};

const createPoint = (viewer, position) => {
    const point = viewer.entities.add({
        position: position,
        point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#ff9900'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY // 始终显示在最前
        }
    });
    entities.push(point);
    return point;
};

const formatDistance = (val) => {
    if (val > 1000) {
        return (val / 1000).toFixed(2) + ' km';
    }
    return val.toFixed(2) + ' m';
};

const formatArea = (val) => {
    if (val > 1000000) {
        return (val / 1000000).toFixed(2) + ' km²';
    }
    return val.toFixed(2) + ' m²';
};

onUnmounted(() => {
    clearMeasurement();
});
</script>

<style scoped>
.measurement-control-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
}

.measurement-buttons {
    display: flex;
    gap: 10px;
}

.measure-btn {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: none;
    backdrop-filter: none;
}

.measure-btn:hover {
    background: rgba(52, 71, 130, 0.4);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.measure-btn.active {
    background: rgba(0, 229, 255, 0.3);
    border-color: rgba(0, 229, 255, 0.6);
}

.measure-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.icon {
    font-size: 24px;
    opacity: 0.9;
    transition: all 0.3s ease;
}

.measure-btn:hover .icon {
    opacity: 1;
}

.measure-btn.active .icon {
    opacity: 1;
}

/* 结果面板样式 */
.result-panel {
    width: 240px;
    background: rgba(42, 61, 110, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    backdrop-filter: blur(10px);
    color: #fff;
    overflow: hidden;
}

.panel-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
    font-size: 12px;
    color: #aaa;
    margin-right: 8px;
}

.unit-select {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    outline: none;
}

.unit-select option {
    background: #2a3d6e;
}

.close-btn {
    margin-left: auto;
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 16px;
}

.close-btn:hover {
    color: #fff;
}

.panel-content {
    padding: 12px;
}

.result-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.result-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.result-item .label {
    font-size: 12px;
    color: #aaa;
}

.result-item .value {
    font-size: 14px;
    font-weight: bold;
    color: #fff;
}

.panel-footer {
    padding: 8px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: right;
}

.new-measure-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
    padding: 4px 12px;
    border-radius: 2px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}

.new-measure-btn:hover {
    border-color: #00e5ff;
    color: #00e5ff;
}
</style>
