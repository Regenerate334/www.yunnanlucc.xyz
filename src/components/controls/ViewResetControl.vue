<template>
  <div class="view-reset-control">
    <button @click="resetView" class="reset-btn" title="复位视图">
      <img :src="resetIcon" alt="复位" class="reset-icon" />
    </button>
  </div>
</template>

<script setup>
import * as Cesium from 'cesium';
import resetIcon from '../../assets/icons/reset.svg';

/**
 * 重置视图到默认位置（云南省）- 带平滑飞行动画
 */
function resetView() {
  const viewer = window.cesiumViewer;

  if (!viewer) {
    return;
  }

  // 使用 flyTo 实现平滑飞行动画（2秒）
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(101.8, 25.2, 1900000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0
    },
    duration: 2.0  // 飞行动画持续2秒
  });
}
</script>

<style scoped>
.view-reset-control {
  position: relative;
}

.reset-btn {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  color: #a5ccff;
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
}

.reset-btn:hover .reset-icon {
  opacity: 1;
  transform: rotate(-15deg);
}
</style>
