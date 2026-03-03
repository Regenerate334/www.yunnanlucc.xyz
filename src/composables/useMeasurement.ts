import { ref, reactive, onUnmounted, computed, watch } from 'vue';
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

    let handler: Cesium.ScreenSpaceEventHandler | null = null;
    let activeShapePoints: Cesium.Cartesian3[] = [];
    let activeShape: Cesium.Entity | null = null;
    let floatingPoint: Cesium.Entity | null = null;
    let entities: Cesium.Entity[] = [];

    // 保存当前弹窗位置，用于单位变化时更新
    let currentPopupPosition: Cesium.Cartesian3 | null = null;
    let currentMeasurementType: 'distance' | 'area' | null = null;

    // ==================== 核心方法 ====================

    const activateTool = (tool: string) => {
        if (mapStore.activeMeasurementTool === tool) {
            clearMeasurement();
            return;
        }

        clearMeasurement();

        // 清除县域标注和高亮（问题4的修复）
        // 通过自定义事件通知Workbench清除
        window.dispatchEvent(new CustomEvent('clearCountyHighlight'));

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

        // 清除弹窗
        const popup = document.getElementById('measurement-popup');
        if (popup) {
            popup.remove();
        }
    };

    const resetResults = () => {
        results.straight = 0;
        results.horizontal = 0;
        results.vertical = 0;
        results.area = 0;
        results.perimeter = 0;
        currentPopupPosition = null;
        currentMeasurementType = null;
    };

    // 更新弹窗内容（单位变化时调用）
    const updatePopupContent = () => {
        if (!currentPopupPosition || !currentMeasurementType) return;

        const viewer = mapStore.viewer;
        if (!viewer) return;

        let content = '';
        if (currentMeasurementType === 'distance') {
            content = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 20px; font-weight: 600; color: #fff; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center; letter-spacing: 0.5px;">测距结果</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px; font-size: 16px;">
                        <span style="color: rgba(255, 255, 255, 0.7); font-weight: 500;">直线距离:</span>
                        <span style="color: #60a5fa; font-weight: 600; font-size: 18px; font-family: 'Consolas', 'Monaco', monospace;">${formatDistance(results.straight)}</span>
                    </div>
                </div>
            `;
        } else if (currentMeasurementType === 'area') {
            content = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 20px; font-weight: 600; color: #fff; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center; letter-spacing: 0.5px;">测面积结果</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px; font-size: 16px;">
                        <span style="color: rgba(255, 255, 255, 0.7); font-weight: 500;">面积:</span>
                        <span style="color: #60a5fa; font-weight: 600; font-size: 18px; font-family: 'Consolas', 'Monaco', monospace;">${formatArea(results.area)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px; font-size: 16px;">
                        <span style="color: rgba(255, 255, 255, 0.7); font-weight: 500;">周长:</span>
                        <span style="color: #60a5fa; font-weight: 600; font-size: 18px; font-family: 'Consolas', 'Monaco', monospace;">${formatDistance(results.perimeter)}</span>
                    </div>
                </div>
            `;
        }

        createMeasurementPopup(viewer, currentPopupPosition, content);
    };

    // 监听单位变化，更新弹窗
    watch([distanceUnit, areaUnit], () => {
        updatePopupContent();
    });

    // ==================== 测距逻辑 ====================
    const startDistanceMeasure = (viewer: Cesium.Viewer) => {
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction((event: any) => {
            const earthPosition = pickPosition(viewer, event.position);
            if (Cesium.defined(earthPosition)) {
                if (activeShapePoints.length === 0) {
                    floatingPoint = createPoint(viewer, earthPosition);
                    activeShapePoints.push(earthPosition);

                    // 创建醒目的橙红色粗实线
                    const dynamicLine = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => activeShapePoints, false),
                            width: 4,
                            material: Cesium.Color.fromCssColorString('#FF5722'), // 鲜艳橙红色
                            arcType: Cesium.ArcType.GEODESIC,
                            clampToGround: true
                        }
                    });
                    entities.push(dynamicLine);

                    // 添加白色外边框增强对比度
                    const outlineLine = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => activeShapePoints, false),
                            width: 6,
                            material: Cesium.Color.WHITE.withAlpha(0.8),
                            arcType: Cesium.ArcType.GEODESIC,
                            clampToGround: true
                        }
                    });
                    entities.push(outlineLine);
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

        // 显示弹窗
        const viewer = mapStore.viewer;
        if (viewer && activeShapePoints.length >= 2) {
            const midpoint = Cesium.Cartesian3.midpoint(p1, p2, new Cesium.Cartesian3());

            // 保存位置和类型，用于单位变化时更新
            currentPopupPosition = midpoint;
            currentMeasurementType = 'distance';

            const content = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 20px; font-weight: 600; color: #fff; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center; letter-spacing: 0.5px;">测距结果</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px; font-size: 16px;">
                        <span style="color: rgba(255, 255, 255, 0.7); font-weight: 500;">直线距离:</span>
                        <span style="color: #60a5fa; font-weight: 600; font-size: 18px; font-family: 'Consolas', 'Monaco', monospace;">${formatDistance(results.straight)}</span>
                    </div>
                </div>
            `;
            createMeasurementPopup(viewer, midpoint, content);
        }
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

                    // 创建醒目的橙红色轮廓线
                    const outlinePolyline = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                if (activeShapePoints.length >= 2) {
                                    return [...activeShapePoints, activeShapePoints[0]];
                                }
                                return activeShapePoints;
                            }, false),
                            width: 4,
                            material: Cesium.Color.fromCssColorString('#FF5722'), // 鲜艳橙红色
                            arcType: Cesium.ArcType.GEODESIC,
                            clampToGround: true
                        }
                    });
                    entities.push(outlinePolyline);

                    // 白色外边框
                    const whiteOutline = viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                if (activeShapePoints.length >= 2) {
                                    return [...activeShapePoints, activeShapePoints[0]];
                                }
                                return activeShapePoints;
                            }, false),
                            width: 6,
                            material: Cesium.Color.WHITE.withAlpha(0.8),
                            arcType: Cesium.ArcType.GEODESIC,
                            clampToGround: true
                        }
                    });
                    entities.push(whiteOutline);

                    // 创建半透明橙红色填充
                    activeShape = viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(() => new Cesium.PolygonHierarchy(activeShapePoints), false),
                            material: Cesium.Color.fromCssColorString('#FF5722').withAlpha(0.25),
                            outline: false
                        }
                    });
                    entities.push(activeShape);
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

        // 显示弹窗
        const viewer = mapStore.viewer;
        if (viewer && positions.length >= 3) {
            // 计算多边形中心点
            const center = new Cesium.Cartesian3(0, 0, 0);
            for (const pos of positions) {
                Cesium.Cartesian3.add(center, pos, center);
            }
            Cesium.Cartesian3.divideByScalar(center, positions.length, center);

            // 保存位置和类型，用于单位变化时更新
            currentPopupPosition = center;
            currentMeasurementType = 'area';

            const content = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 20px; font-weight: 600; color: #fff; padding-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); text-align: center; letter-spacing: 0.5px;">测面积结果</div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px; font-size: 16px;">
                        <span style="color: rgba(255, 255, 255, 0.7); font-weight: 500;">面积:</span>
                        <span style="color: #60a5fa; font-weight: 600; font-size: 18px; font-family: 'Consolas', 'Monaco', monospace;">${formatArea(results.area)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 4px; font-size: 16px;">
                        <span style="color: rgba(255, 255, 255, 0.7); font-weight: 500;">周长:</span>
                        <span style="color: #60a5fa; font-weight: 600; font-size: 18px; font-family: 'Consolas', 'Monaco', monospace;">${formatDistance(results.perimeter)}</span>
                    </div>
                </div>
            `;
            createMeasurementPopup(viewer, center, content);
        }
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
        // 新的图钉SVG图标，颜色与线条一致
        const pinSvg = '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="M462.56152344 981.21523728a32.95924187 49.43847656 90 1 0 98.87695312 0 32.95924187 49.43847656 90 1 0-98.87695312 0z" fill="#D32F2F"/><path d="M552.0003125 567.48635417l0 353.180625A10.0003125 10.0003125 0 0 1 542 930.66635417l-60 0a10.0003125 10.0003125 0 0 1-10.0003125-9.999375L471.9996875 567.48541667c-135.639375-19.4596875-240-135.7996875-240-276.819375C231.9996875 136.02635417 357.3603125 10.66666667 512 10.66666667s280.0003125 125.3596875 280.0003125 280.0003125c0 141.0196875-104.360625 257.3596875-240 276.819375z" fill="#FF5722"/><path d="M432.0003125 290.66697917a79.9996875 79.9996875 0 1 0 159.999375 0 79.9996875 79.9996875 0 1 0-159.999375 0z" fill="#FFFFFF"/></svg>';
        const pinDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pinSvg);

        const point = viewer.entities.add({
            position: position,
            billboard: {
                image: pinDataUrl,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                scale: 1.0,
                pixelOffset: new Cesium.Cartesian2(0, -2),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        entities.push(point);
        return point;
    };

    // 创建HTML弹窗显示测量结果
    const createMeasurementPopup = (viewer: Cesium.Viewer, position: Cesium.Cartesian3, content: string) => {
        const oldPopup = document.getElementById('measurement-popup');
        if (oldPopup) {
            oldPopup.remove();
        }

        const canvasPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
        if (!canvasPosition) return;

        const popup = document.createElement('div');
        popup.id = 'measurement-popup';
        popup.style.cssText = `
            position: fixed;
            left: ${canvasPosition.x}px;
            top: ${canvasPosition.y - 20}px;
            transform: translate(-50%, -100%);
            background: rgba(13, 25, 48, 0.4);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
            z-index: 10000;
            pointer-events: none;
            min-width: 180px;
            padding: 12px;
            font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
        `;
        popup.innerHTML = content;
        document.body.appendChild(popup);

        const updatePopupPosition = () => {
            const newCanvasPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position);
            if (newCanvasPosition && popup.parentElement) {
                popup.style.left = newCanvasPosition.x + 'px';
                popup.style.top = (newCanvasPosition.y - 20) + 'px';
            }
        };

        viewer.scene.postRender.addEventListener(updatePopupPosition);

        return popup;
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
