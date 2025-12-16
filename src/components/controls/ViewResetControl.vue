<template>
  <div class="view-reset-control">
    <button @click="resetView" class="reset-btn" title="复位视图">
      <img src="../../assets/reset.svg" alt="复位" class="reset-icon" />
    </button>
  </div>
</template>

<script setup>
import { useMapStore } from '../../stores/map.ts';

const mapStore = useMapStore();

/**
 * 重置视图到默认位置（云南省）
 */
function resetView() {
  mapStore.flyToYunnan();
}
</script>

<style scoped>
.view-reset-control {
  position: relative;
}

.reset-btn {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(42, 61, 110, 0.85);
  backdrop-filter: blur(8px);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.reset-btn:hover {
  background: rgba(52, 71, 130, 0.95);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.reset-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.reset-icon {
  width: 24px;
  height: 24px;
  filter: brightness(0) invert(1);
  opacity: 0.9;
  transition: all 0.3s ease;
}

.reset-btn:hover .reset-icon {
  opacity: 1;
  transform: rotate(-15deg);
}
</style>
