<template>
  <div class="placeholder-chart">
    <div class="placeholder-icon-ring"></div>
    <div class="placeholder-text">{{ message }}</div>
    <div class="placeholder-subtitle">{{ subtitle }}</div>
  </div>
</template>

<script setup>
defineProps({
  message: {
    type: String,
    default: '功能开发中...'
  },
  subtitle: {
    type: String,
    default: '敬请期待'
  }
})
</script>

<style scoped>
.placeholder-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #999;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  border-radius: 8px;
}

.placeholder-icon-ring {
  width: 48px;
  height: 48px;
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  margin-bottom: 16px;
  animation: rotate 20s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.placeholder-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.placeholder-subtitle {
  font-size: 12px;
  opacity: 0.7;
}
</style>
