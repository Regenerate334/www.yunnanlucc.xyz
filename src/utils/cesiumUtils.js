/**
 * Cesium 业务图层管理器
 * 实现全局互斥的分析图层调度逻辑，防止显存泄漏
 */

/**
 * 清除所有标记为分析业务的图层
 * @param {Cesium.Viewer} viewer 
 * @param {Cesium.ImageryLayer} [excludeLayer] 可选，排除该图层不删除
 */
export function clearAllAnalysisLayers(viewer, excludeLayer = null) {
    if (!viewer || viewer.isDestroyed()) return;

    const layers = viewer.imageryLayers;
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers.get(i);
        if (layer.isAnalysisLayer === true && layer !== excludeLayer) {
            layers.remove(layer, true);
        }
    }
}

/**
 * 添加互斥的分析业务图层
 * @param {Cesium.Viewer} viewer 
 * @param {Cesium.ImageryLayer} newLayer 
 * @param {number} [delay=0] 缓冲延迟时间（毫秒），用于平滑过渡防止闪烁
 */
export function addExclusiveAnalysisLayer(viewer, newLayer, delay = 0) {
    if (!viewer || viewer.isDestroyed() || !newLayer) return;

    // 1. 为新图层打上业务标记并添加到场景最上方
    newLayer.isAnalysisLayer = true;
    if (!viewer.imageryLayers.contains(newLayer)) {
        viewer.imageryLayers.add(newLayer);
    }
    viewer.imageryLayers.raiseToTop(newLayer);
    newLayer.show = true;
    newLayer.alpha = 1.0;

    // 2. 执行互斥清理
    if (delay > 0) {
        // 延迟清理：先叠加显示新图层，等待瓦片加载缓冲后再移除旧图层
        setTimeout(() => {
            clearAllAnalysisLayers(viewer, newLayer);
        }, delay);
    } else {
        // 立即清理
        clearAllAnalysisLayers(viewer, newLayer);
    }

    return newLayer;
}

/**
 * 为单个 Entity 转换 Polygon Outline 为独立加粗的 Polyline (绕开 WebGL 1px 线宽限制)
 * @param {Cesium.Entity} entity 
 * @param {Cesium.Color} color 
 * @param {number} width 
 * @param {any} Cesium 
 */
export function applyThickPolygonOutlineForEntity(entity, color, width, Cesium) {
    if (!entity.polygon) return;

    // 关闭原生的 1px 外边框
    entity.polygon.outline = false;

    // 获取多边形的层级节点 (Positions)
    let hierarchy = undefined;
    if (typeof entity.polygon.hierarchy.getValue === 'function') {
        hierarchy = entity.polygon.hierarchy.getValue(Cesium.JulianDate.now());
    } else {
        hierarchy = entity.polygon.hierarchy;
    }

    if (hierarchy && hierarchy.positions && hierarchy.positions.length > 0) {
        // 闭合环线
        const positions = [...hierarchy.positions, hierarchy.positions[0]];
        if (!entity.polyline) {
            entity.polyline = new Cesium.PolylineGraphics({
                positions: positions,
                width: width,
                material: color,
                clampToGround: true // 开启贴地才能支持 Windows Chrome 显示比 1 宽的线条
            });
        } else {
            entity.polyline.positions = positions;
            entity.polyline.width = width;
            entity.polyline.material = color;
            entity.polyline.clampToGround = true;
            entity.polyline.show = true;
        }
    }
}

/**
 * 遍历 DataSource 的实体，将所有 Polygon 的 outline 转为可加粗的 Polyline
 * @param {Cesium.DataSource} dataSource 
 * @param {Cesium.Color} color 
 * @param {number} width 
 * @param {any} Cesium 
 */
export function applyThickPolygonOutline(dataSource, color, width, Cesium) {
    if (!dataSource || !dataSource.entities) return;
    const entities = dataSource.entities.values;
    entities.forEach(ent => {
        applyThickPolygonOutlineForEntity(ent, color, width, Cesium);
    });
}
