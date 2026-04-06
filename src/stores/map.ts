/**
 * 地图状态 Store
 * 管理 Cesium 地图实例和交互状态
 */

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type * as Cesium from 'cesium'
import { UI_CONFIG } from '@/config'

export const useMapStore = defineStore('map', () => {
    // ============================================
    // 状态 (State)
    // ============================================

    // Cesium Viewer 实例 - 使用 shallowRef 避免深层响应式开销
    const viewer = shallowRef<Cesium.Viewer | null>(null)

    // 数据源 - 使用 shallowRef 避免深层响应式开销
    const dataSources = shallowRef<{
        province: Cesium.DataSource | null
        cities: Cesium.DataSource | null
        counties: Cesium.DataSource | null
    }>({
        province: null,
        cities: null,
        counties: null
    })

    // 交互状态
    const highlightedEntity = ref<Cesium.Entity | null>(null)
    const hoveredEntity = ref<Cesium.Entity | null>(null)
    const selectedEntity = ref<Cesium.Entity | null>(null)

    // UI 状态
    const infoCardVisible = ref(false)
    const infoCardPosition = ref({ x: 0, y: 0 })
    const infoCardData = ref<any>(null)
    const activeMeasurementTool = ref<string | null>(null) // 'distance' | 'area' | null

    // ============================================
    // 方法 (Actions)
    // ============================================

    /**
     * 设置 Viewer 实例
     */
    function setViewer(viewerInstance: Cesium.Viewer) {
        viewer.value = viewerInstance
    }

    /**
     * 添加数据源
     */
    function addDataSource(
        level: 'province' | 'cities' | 'counties',
        dataSource: Cesium.DataSource
    ) {
        dataSources.value[level] = dataSource
    }

    /**
     * 高亮实体
     */
    function highlightEntity(entity: Cesium.Entity | null) {
        // 重置之前的高亮
        if (highlightedEntity.value && highlightedEntity.value.polygon) {
            // 恢复原始样式
            highlightedEntity.value.polygon.outlineWidth = new (window as any).Cesium.ConstantProperty(UI_CONFIG.BOUNDARY_STYLE.countyWidth)
            highlightedEntity.value.polygon.outlineColor = new (window as any).Cesium.Color.WHITE.withAlpha(0.5)
        }

        // 设置新的高亮
        if (entity && entity.polygon) {
            entity.polygon.outlineWidth = new (window as any).Cesium.ConstantProperty(UI_CONFIG.BOUNDARY_STYLE.highlightWidth)
            entity.polygon.outlineColor = new (window as any).Cesium.Color.YELLOW
            highlightedEntity.value = entity
        } else {
            highlightedEntity.value = null
        }
    }

    /**
     * 显示信息卡片
     */
    function showInfoCard(entity: Cesium.Entity, position: { x: number; y: number }) {
        infoCardData.value = {
            name: entity.name || '未知区域',
            properties: entity.properties
        }
        infoCardPosition.value = position
        infoCardVisible.value = true
    }

    /**
     * 隐藏信息卡片
     */
    function hideInfoCard() {
        infoCardVisible.value = false
        infoCardData.value = null
    }

    /**
     * 重置地图状态
     */
    function resetMapState() {
        highlightedEntity.value = null
        hoveredEntity.value = null
        selectedEntity.value = null
        hideInfoCard()
    }

    /**
     * 飞向指定区域
     */
    function flyToRegion(entity: Cesium.Entity, duration = 2) {
        if (!viewer.value || !entity) return

        viewer.value.flyTo(entity, {
            duration,
            offset: new (window as any).Cesium.HeadingPitchRange(
                0,
                -(window as any).Cesium.Math.PI_OVER_TWO,
                0
            )
        })
    }

    /**
     * 飞向云南省（复位到初始默认视图）
     */
    function flyToYunnan() {
        if (!viewer.value) return

        viewer.value.camera.setView({
            destination: (window as any).Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
            orientation: {
                heading: (window as any).Cesium.Math.toRadians(0),
                pitch: (window as any).Cesium.Math.toRadians(-90),
                roll: 0.0
            }
        })
    }

    // ============================================
    // 返回 Store API
    // ============================================

    return {
        // 状态
        viewer,
        dataSources,
        highlightedEntity,
        hoveredEntity,
        selectedEntity,
        infoCardVisible,
        infoCardPosition,
        infoCardData,
        activeMeasurementTool,

        // 方法
        setViewer,
        addDataSource,
        highlightEntity,
        showInfoCard,
        hideInfoCard,
        resetMapState,
        flyToRegion,
        flyToYunnan
    }
})
