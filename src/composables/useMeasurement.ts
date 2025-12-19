import { ref, reactive, onUnmounted, computed } from 'vue';
import * as Cesium from 'cesium';
import { useMapStore } from '../stores/map';

export function useMeasurement() {
    const mapStore = useMapStore();
    const showResultPanel = ref(false);

    // 距离单位类型
    type DistanceUnit = 'meter' | 'kilometer' | 'inch' | 'foot' | 'yard' | 'mile' | 'nautical_mile';
    // 面积单位类型
    type AreaUnit = 'sq_meter' | 'sq_kilometer' | 'sq_inch' | 'sq_foot' | 'sq_yard' | 'sq_mile' | 'acre' | 'are' | 'hectare';

    const distanceUnit = ref<DistanceUnit>('meter');
    const areaUnit = ref<AreaUnit>('sq_meter');

    // 测量结果数据 (原始单位: m, m²)
    const results = reactive({
        straight: 0,
        horizontal: 0,
        vertical: 0,
        area: 0,
        perimeter: 0
    });

    // Cesium 相关变量
    let handler: Cesium.ScreenSpaceEventHandler | null = null;
    let activeShapePoints: Cesium.Cartesian3[] = [];
    let activeShape: Cesium.Entity | null = null;
    let floatingPoint: Cesium.Entity | null = null;
    let entities: Cesium.Entity[] = [];
    let distanceLabel: Cesium.Entity | null = null; // 距离标注
    let areaLabel: Cesium.Entity | null = null; // 面积标注

    // ==================== 核心方法 ====================

    const activateTool = (tool: string) => {
        if (mapStore.activeMeasurementTool === tool) {
            clearMeasurement();
            return;
        }

        clearMeasurement();
        mapStore.activeMeasurementTool = tool;
        showResultPanel.value = true;

        const viewer = mapStore.viewer;
        if (!viewer) return;

        if (tool === 'distance') {
            startDistanceMeasure(viewer);
        } else if (tool === 'area') {
            startAreaMeasure(viewer);
        }
    };

    const clearMeasurement = () => {
        const viewer = mapStore.viewer;
        if (viewer) {
            entities.forEach(entity => viewer.entities.remove(entity));
            entities = [];

            if (floatingPoint) {
                viewer.entities.remove(floatingPoint);
                floatingPoint = null;
            }
            if (activeShape) {
                viewer.entities.remove(activeShape);
                activeShape = null;
            }
            if (handler) {
                handler.destroy();
                handler = null;
            }
        }

        activeShapePoints = [];
        mapStore.activeMeasurementTool = null;
        showResultPanel.value = false;
        resetResults();
    };

    const resetResults = () => {
        results.straight = 0;
        results.horizontal = 0;
        results.vertical = 0;
        results.area = 0;
        results.perimeter = 0;
    };

    // ==================== 测距逻辑 ====================
    const startDistanceMeasure = (viewer: Cesium.Viewer) => {
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((event: any) => {
            const earthPosition = pickPosition(viewer, event.position);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(viewer, earthPosition);
                    activeShapePoints.push(earthPosition);

                    const dynamicLine = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => activeShapePoints, false),
                            width: 8,
                            material: new Cesium.PolylineDashMaterialProperty({
                                color: Cesium.Color.fromCssColorString('#FF8C00'),
                                gapColor: Cesium.Color.WHITE,
                                dashLength: 20
                            }),
                            arcType: Cesium.ArcType.GEODESIC,
                            zIndex: 1000
                        }
                    });
                    entities.push(dynamicLine);

                    // 创建实时距离标注
                    distanceLabel = viewer.entities.add({
                        position: new Cesium.CallbackProperty(() => {
                            if (activeShapePoints.length >= 2) {
                                return getMidpoint(activeShapePoints[0], activeShapePoints[1]);
                            }
                            return activeShapePoints[0];
                        }, false) as any,
                        label: {
                            text: new Cesium.CallbackProperty(() => {
                                if (activeShapePoints.length >= 2) {
                                    const distance = Cesium.Cartesian3.distance(activeShapePoints[0], activeShapePoints[1]);
                                    return formatDistance(distance);
                                }
                                return '';
                            }, false),
                            font: 'bold 18px sans-serif',
                            fillColor: Cesium.Color.WHITE,
                            outlineColor: Cesium.Color.BLACK,
                            outlineWidth: 4,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            showBackground: true,
                            backgroundColor: new Cesium.Color(0, 0, 0, 0.75),
                            backgroundPadding: new Cesium.Cartesian2(10, 6),
                            pixelOffset: new Cesium.Cartesian2(0, -25),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY
                        }
                    });
                    entities.push(distanceLabel);
                }

                activeShapePoints.push(earthPosition);
                createPoint(viewer, earthPosition);

                if (activeShapePoints.length === 3) {
                    activeShapePoints.pop();
                    finishDistanceMeasure(viewer);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((event: any) => {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = pickPosition(viewer, event.endPosition);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);

                    if (activeShapePoints.length >= 2) {
                        calculateDistance(activeShapePoints[0], activeShapePoints[1]);
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(() => {
            clearMeasurement();
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };

    const finishDistanceMeasure = (viewer: Cesium.Viewer) => {
        if (handler) {
            handler.destroy();
            handler = null;
        }
        if (floatingPoint) {
            viewer.entities.remove(floatingPoint);
            floatingPoint = null;
        }
        calculateDistance(activeShapePoints[0], activeShapePoints[1]);
    };

    const calculateDistance = (p1: Cesium.Cartesian3, p2: Cesium.Cartesian3) => {
        const straight = Cesium.Cartesian3.distance(p1, p2);
        results.straight = straight;

        const c1 = Cesium.Cartographic.fromCartesian(p1);
        const c2 = Cesium.Cartographic.fromCartesian(p2);

        results.vertical = Math.abs(c1.height - c2.height);

        const geodesic = new Cesium.EllipsoidGeodesic();
        geodesic.setEndPoints(c1, c2);
        results.horizontal = geodesic.surfaceDistance;
    };

    // ==================== 测面逻辑 ====================
    const startAreaMeasure = (viewer: Cesium.Viewer) => {
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((event: any) => {
            const earthPosition = pickPosition(viewer, event.position);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(viewer, earthPosition);
                    activeShapePoints.push(earthPosition);

                    // 创建多边形轮廓线（橙色）
                    const outlinePolyline = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                if (activeShapePoints.length >= 2) {
                                    return [...activeShapePoints, activeShapePoints[0]];
                                }
                                return activeShapePoints;
                            }, false),
                            width: 6,
                            material: Cesium.Color.fromCssColorString('#FF8C00'),
                            arcType: Cesium.ArcType.GEODESIC,
                            zIndex: 1000
                        }
                    });
                    entities.push(outlinePolyline);

                    // 创建多边形填充
                    activeShape = viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(activeShapePoints), false),
                            material: Cesium.Color.fromCssColorString('#FF8C00').withAlpha(0.3)
                        }
                    });
                    entities.push(activeShape);

                    // 创建实时面积标注
                    areaLabel = viewer.entities.add({
                        position: new Cesium.CallbackProperty(() => {
                            if (activeShapePoints.length >= 3) {
                                return getPolygonCenter(activeShapePoints);
                            }
                            return activeShapePoints[0];
                        }, false) as any,
                        label: {
                            text: new Cesium.CallbackProperty(() => {
                                if (activeShapePoints.length >= 3) {
                                    calculateArea(activeShapePoints);
                                    return formatArea(results.area) + '\n' + formatDistance(results.perimeter);
                                }
                                return '';
                            }, false),
                            font: 'bold 18px sans-serif',
                            fillColor: Cesium.Color.WHITE,
                            outlineColor: Cesium.Color.BLACK,
                            outlineWidth: 4,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            showBackground: true,
                            backgroundColor: new Cesium.Color(0, 0, 0, 0.75),
                            backgroundPadding: new Cesium.Cartesian2(10, 6),
                            pixelOffset: new Cesium.Cartesian2(0, -25),
                            disableDepthTestDistance: Number.POSITIVE_INFINITY
                        }
                    });
                    entities.push(areaLabel);
                }
                activeShapePoints.push(earthPosition);
                createPoint(viewer, earthPosition);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((event: any) => {
            if (Cesium.defined(floatingPoint)) {
                const newPosition = pickPosition(viewer, event.endPosition);
                if (Cesium.defined(newPosition)) {
                    activeShapePoints.pop();
                    activeShapePoints.push(newPosition);

                    if (activeShapePoints.length >= 3) {
                        calculateArea(activeShapePoints);
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(() => {
            activeShapePoints.pop();
            finishAreaMeasure(viewer);
        }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    };

    const finishAreaMeasure = (viewer: Cesium.Viewer) => {
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

    const calculateArea = (positions: Cesium.Cartesian3[]) => {
        if (positions.length < 3) return;

        let perimeter = 0;
        for (let i = 0; i < positions.length; i++) {
            const p1 = positions[i];
            const p2 = positions[(i + 1) % positions.length];
            perimeter += Cesium.Cartesian3.distance(p1, p2);
        }
        results.perimeter = perimeter;

        let area = 0;
        const hierarchy = new Cesium.PolygonHierarchy(positions);
        const indices = (Cesium as any).PolygonPipeline.triangulate(hierarchy.positions, hierarchy.holes);

        for (let i = 0; i < indices.length; i += 3) {
            const p0 = positions[indices[i]];
            const p1 = positions[indices[i + 1]];
            const p2 = positions[indices[i + 2]];

            const ab = Cesium.Cartesian3.subtract(p1, p0, new Cesium.Cartesian3());
            const ac = Cesium.Cartesian3.subtract(p2, p0, new Cesium.Cartesian3());
            const cross = Cesium.Cartesian3.cross(ab, ac, new Cesium.Cartesian3());
            area += 0.5 * Cesium.Cartesian3.magnitude(cross);
        }

        results.area = area;
    };

    // ==================== 辅助函数 ====================
    const pickPosition = (viewer: Cesium.Viewer, position: Cesium.Cartesian2) => {
        const pickedObject = viewer.scene.pick(position);
        if (viewer.scene.pickPositionSupported && Cesium.defined(pickedObject)) {
            return viewer.scene.pickPosition(position);
        }
        const ray = viewer.camera.getPickRay(position);
        if (!ray) return undefined;
        return viewer.scene.globe.pick(ray, viewer.scene);
    };

    const createPoint = (viewer: Cesium.Viewer, position: Cesium.Cartesian3) => {
        const point = viewer.entities.add({
            position: position,
            point: {
                pixelSize: 10,
                color: Cesium.Color.fromCssColorString('#FF8C00'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        entities.push(point);
        return point;
    };

    // 计算两点中心
    const getMidpoint = (p1: Cesium.Cartesian3, p2: Cesium.Cartesian3): Cesium.Cartesian3 => {
        return Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());
    };

    // 计算多边形中心（质心）
    const getPolygonCenter = (positions: Cesium.Cartesian3[]): Cesium.Cartesian3 => {
        const center = new Cesium.Cartesian3(0, 0, 0);
        for (const pos of positions) {
            Cesium.Cartesian3.add(center, pos, center);
        }
        Cesium.Cartesian3.divideByScalar(center, positions.length, center);
        return center;
    };

    // ==================== 格式化逻辑 ====================
    const formatDistance = (val: number) => {
        // val 是米为单位
        switch (distanceUnit.value) {
            case 'meter':
                return val.toFixed(2) + ' m';
            case 'kilometer':
                return (val / 1000).toFixed(2) + ' km';
            case 'inch':
                return (val * 39.3701).toFixed(2) + ' in';
            case 'foot':
                return (val * 3.28084).toFixed(2) + ' ft';
            case 'yard':
                return (val * 1.09361).toFixed(2) + ' yd';
            case 'mile':
                return (val / 1609.34).toFixed(2) + ' mi';
            case 'nautical_mile':
                return (val / 1852).toFixed(2) + ' nmi';
            default:
                return val.toFixed(2) + ' m';
        }
    };

    const formatArea = (val: number) => {
        // val 是平方米为单位
        switch (areaUnit.value) {
            case 'sq_meter':
                return val.toFixed(2) + ' m²';
            case 'sq_kilometer':
                return (val / 1000000).toFixed(2) + ' km²';
            case 'sq_inch':
                return (val * 1550).toFixed(2) + ' in²';
            case 'sq_foot':
                return (val * 10.7639).toFixed(2) + ' ft²';
            case 'sq_yard':
                return (val * 1.19599).toFixed(2) + ' yd²';
            case 'sq_mile':
                return (val / 2589988.11).toFixed(2) + ' mi²';
            case 'acre':
                return (val / 4046.86).toFixed(2) + ' ac';
            case 'are':
                return (val / 100).toFixed(2) + ' a';
            case 'hectare':
                return (val / 10000).toFixed(2) + ' ha';
            default:
                return val.toFixed(2) + ' m²';
        }
    };

    onUnmounted(() => {
        clearMeasurement();
    });

    return {
        activeTool: computed(() => mapStore.activeMeasurementTool),
        showResultPanel,
        distanceUnit,
        areaUnit,
        results,
        activateTool,
        clearMeasurement,
        formatDistance,
        formatArea
    };
}
