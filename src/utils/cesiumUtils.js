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
