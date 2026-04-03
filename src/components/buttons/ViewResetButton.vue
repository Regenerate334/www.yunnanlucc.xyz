<!--
  @component ViewResetButton
  @description 视角复位工具，一键将地图相机返回定位至云南省默认观察范围
  @props 无
  @emits 无
  @dependencies Cesium (地图引擎)
-->
<template>
  <div class="view-reset-control">
    <button @click="resetView" class="reset-btn" title="复位视图">
      <img :src="resetIcon" alt="复位" class="reset-icon" />
      <span class="btn-label">视图复位</span>
    </button>
  </div>
</template>

<script setup>
import * as Cesium from 'cesium';
import resetIcon from '@/assets/icons/map/reset.svg';

const emit = defineEmits(['reset-map']);

function resetView() {
  const viewer = window.cesiumViewer;

  if (!viewer) {
    return;
  }

  // 1. 发出重置图层信号
  emit('reset-map');

  // 2. 执行视角飞行
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0
    },
    duration: 2.0
  });
}
</script>

<style scoped>
.reset-btn {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #a5ccff;
  pointer-events: auto; /* 核心修复：确保按钮本体捕捉事件 */
}

.btn-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
  pointer-events: none; /* 让点击穿透到按钮本体 */
}

.reset-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-2px);
  color: #ffffff;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.reset-btn:active {
  transform: translateY(0);
}

.reset-icon {
  width: 28px;
  height: 28px;
  filter: brightness(0) invert(1);
  opacity: 0.8;
  transition: all 0.3s ease;
  pointer-events: none; /* 让点击穿透到按钮本体 */
}

.reset-btn:hover .reset-icon {
  opacity: 1;
  transform: rotate(-15deg);
}
</style>
