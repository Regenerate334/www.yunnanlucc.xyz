<template>
  <div class="tech-border-box" :style="{ '--border-color': color }">
    <!-- 四个角的装饰线 -->
    <div class="corner top-left"></div>
    <div class="corner top-right"></div>
    <div class="corner bottom-left"></div>
    <div class="corner bottom-right"></div>

    <div class="content-slot">
      <slot></slot>
    </div>

    <!-- 装饰光点 -->
    <div class="glow-dot top-left-dot" :style="{ background: color }"></div>
    <div class="glow-dot top-right-dot" :style="{ background: color }"></div>
    <div class="glow-dot bottom-left-dot" :style="{ background: color }"></div>
    <div class="glow-dot bottom-right-dot" :style="{ background: color }"></div>
  </div>
</template>

<script setup>
defineProps({
  color: {
    type: String,
    default: '#3b82f6' // Default Blue
  }
});
</script>

<style scoped>
.tech-border-box {
  position: relative;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.corner {
  position: absolute;
  width: 15px;
  height: 15px;
  border: 2px solid var(--border-color);
  z-index: 1;
}

.top-left {
  top: 0;
  left: 0;
  border-right: none;
  border-bottom: none;
}

.top-right {
  top: 0;
  right: 0;
  border-left: none;
  border-bottom: none;
}

.bottom-left {
  bottom: 0;
  left: 0;
  border-right: none;
  border-top: none;
}

.bottom-right {
  bottom: 0;
  right: 0;
  border-left: none;
  border-top: none;
}

.content-slot {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 2;
  padding: 10px;
}

.glow-dot {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  box-shadow: 0 0 8px var(--border-color);
  z-index: 3;
}

.top-left-dot {
  top: -2px;
  left: -2px;
}

.top-right-dot {
  top: -2px;
  right: -2px;
}

.bottom-left-dot {
  bottom: -2px;
  left: -2px;
}

.bottom-right-dot {
  bottom: -2px;
  right: -2px;
}
</style>
