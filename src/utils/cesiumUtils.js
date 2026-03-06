/**
 * Cesium 业务图层管理器
 * 实现全局互斥的分析图层调度逻辑，防止显存泄漏
 */

/**
 * 清除所有标记为分析业务的图层
 * @param {Cesium.Viewer} viewer 
 */
export function clearAllAnalysisLayers(viewer) {
    if (!viewer || viewer.isDestroyed()) return;

    const layers = viewer.imageryLayers;
    // 倒序遍历，安全删除
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers.get(i);
        // 核心逻辑：只删除打过业务标记的图层，保留底图
        if (layer.isAnalysisLayer === true) {
            layers.remove(layer, true); // 第二个参数为 true 彻底销毁 WebGL 资源
        }
    }
}

/**
 * 添加互斥的分析业务图层
 * 确保场景中始终只存在一个处于激活状态的业务分析图层
 * @param {Cesium.Viewer} viewer 
 * @param {Cesium.ImageryLayer} newLayer 
 */
export function addExclusiveAnalysisLayer(viewer, newLayer) {
    if (!viewer || viewer.isDestroyed() || !newLayer) return;

    // 1. 先执行全局清理，确保环境纯净
    clearAllAnalysisLayers(viewer);

    // 2. 为新图层打上业务标记
    newLayer.isAnalysisLayer = true;

    // 3. 将新图层加入场景
    viewer.imageryLayers.add(newLayer);

    return newLayer;
}
