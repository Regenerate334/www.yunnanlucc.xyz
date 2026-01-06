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
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.4) 100%);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transition: all 0.3s ease;
}

.tech-border-box:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 0, 0, 0.4);
}

.corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid var(--border-color);
  z-index: 3;
  filter: drop-shadow(0 0 5px var(--border-color));
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
  padding: 15px;
}

.glow-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow: 0 0 12px var(--border-color);
  z-index: 4;
  opacity: 0.8;
}

.top-left-dot {
  top: -3px;
  left: -3px;
}

.top-right-dot {
  top: -3px;
  right: -3px;
}

.bottom-left-dot {
  bottom: -3px;
  left: -3px;
}

.bottom-right-dot {
  bottom: -3px;
  right: -3px;
}
</style>
