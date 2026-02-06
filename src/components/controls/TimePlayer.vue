<template>
  <div class="time-player">
    <div class="controls-row">
      <!-- 播放/暂停按钮 -->
      <button class="play-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
        <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      </button>

      <!-- 倍速控制 -->
      <div class="speed-control" @click="toggleSpeed" :title="'当前速度: ' + currentSpeedLabel">
        <span>{{ currentSpeedLabel }}</span>
      </div>
      
      <!-- 时间滑块 (基于索引) -->
      <div class="slider-container">
        <input 
          type="range" 
          :min="0" 
          :max="maxIndex" 
          :step="1" 
          :value="currentIndex" 
          @input="onInput"
          class="timeline-slider"
        />
        <!-- 刻度点与年份标签 -->
        <div class="ticks">
          <div 
            v-for="(year, index) in years" 
            :key="year" 
            class="tick-wrapper"
            :style="{ left: getPercent(index) + '%' }"
          >
            <!-- 仅显示主要刻度 (竖线风格) -->
            <span v-if="shouldShowStaticLabel(index)" class="tick major-tick"></span>
            
            <!-- 静态年份标签：仅显示首尾和每隔N个 -->
            <span v-if="shouldShowStaticLabel(index)" class="tick-label static-label">{{ year }}</span>
          </div>
          
          <!-- 动态当前年份标签 (跟随滑块) -->
          <div 
            class="current-year-label"
            :style="{ left: getPercent(currentIndex) + '%' }"
          >
            {{ years[currentIndex] }}
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';

const props = defineProps({
  years: {
    type: Array,
    required: true,
    default: () => []
  },
  modelValue: {
    type: Number,
    required: true
  },
  interval: {
    type: Number,
    default: 1000 // 基准间隔 1秒
  }
});

const emit = defineEmits(['update:modelValue']);

const isPlaying = ref(false);
let timer = null;

// 倍速控制 logic
// 0: 0.5x, 1: 1.0x, 2: 2.0x
const speedOptions = [
  { label: '0.5x', multiplier: 0.5 },
  { label: '1.0x', multiplier: 1.0 },
  { label: '2.0x', multiplier: 2.0 },
  { label: '4.0x', multiplier: 4.0 }
];
const speedIndex = ref(2); // 默认 2.0x

const currentSpeedLabel = computed(() => speedOptions[speedIndex.value].label);
const currentInterval = computed(() => props.interval / speedOptions[speedIndex.value].multiplier);

function toggleSpeed() {
  speedIndex.value = (speedIndex.value + 1) % speedOptions.length;
  // 如果正在播放，重启定时器以应用新速度
  if (isPlaying.value) {
    stop();
    startPlay();
  }
}

// 基于索引计算，确保间距均匀
const maxIndex = computed(() => Math.max(0, props.years.length - 1));
const currentIndex = computed(() => {
  const idx = props.years.indexOf(props.modelValue);
  return idx === -1 ? 0 : idx;
});

function getPercent(index) {
  if (maxIndex.value === 0) return 0;
  return (index / maxIndex.value) * 100;
}

function shouldShowStaticLabel(index) {
  const total = props.years.length;
  // 如果年份少于10个，全部显示作为静态标签
  if (total <= 10) return true;
  // 否则首尾必显示
  if (index === 0 || index === total - 1) return true;
  // 中间每隔5个显示
  return index % 5 === 0;
}

function onInput(e) {
  const idx = Number(e.target.value);
  const year = props.years[idx];
  emit('update:modelValue', year);
}

function togglePlay() {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    playNext();
    startPlay();
  } else {
    stop();
  }
}

function startPlay() {
  if (timer) clearInterval(timer);
  timer = setInterval(playNext, currentInterval.value);
}

function playNext() {
  let nextIndex = currentIndex.value + 1;
  if (nextIndex >= props.years.length) {
    nextIndex = 0; 
  }
  emit('update:modelValue', props.years[nextIndex]);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isPlaying.value = false;
}

watch(() => props.years, () => {
  stop();
});

onBeforeUnmount(() => {
  stop();
});
</script>

<style scoped>
.time-player {
  background: rgba(15, 23, 42, 0.65); /* 稍微加深一点背景增加对比度 */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50px;
  padding: 10px 24px 14px 24px; /* 底部padding加大给标签留位置 */
  min-width: 600px; 
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  transition: all 0.3s ease;
  pointer-events: auto;
}

.time-player:hover {
  background: rgba(15, 23, 42, 0.85);
  border-color: rgba(255, 255, 255, 0.25);
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 36px;
}

.play-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  padding: 0;
}

.play-btn:hover {
  transform: scale(1.1);
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
}

.speed-control {
  font-size: 12px;
  color: rgba(255,255,255,0.8);
  cursor: pointer;
  background: rgba(255,255,255,0.1);
  padding: 4px 8px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  transition: all 0.2s;
  user-select: none;
  min-width: 42px;
  text-align: center;
}

.speed-control:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.play-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.slider-container {
  flex: 1;
  position: relative;
  height: 36px;
  display: flex;
  align-items: center;
}

.timeline-slider {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  z-index: 4; /* 最高层级，保证可拖拽 */
  cursor: pointer;
  height: 100%; /* 占满高度便于点击 */
  margin: 0;
  position: absolute;
  top: 0;
  left: 0;
}

/* ... track styles ... */

.tick {
  display: block;
  position: absolute;
  width: 1px;
  height: 6px; /* 竖线高度 */
  border-radius: 0;
  background: rgba(255,255,255,0.6);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Track styles - visual only */
.timeline-slider::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  cursor: pointer;
}

.slider-container:hover .timeline-slider::-webkit-slider-runnable-track {
  background: rgba(255, 255, 255, 0.3);
}

/* Thumb styles */
.timeline-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #3b82f6;
  margin-top: -6px; /* 4px track height / 2 - 16px thumb height / 2 = -6 */
  box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.5);
  transition: transform 0.1s;
  cursor: grab;
}

.timeline-slider:active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(1.2);
  background: #3b82f6;
}

.ticks {
  position: absolute;
  top: 50%;
  left: 0; 
  right: 0;
  height: 4px; 
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
}

.tick-wrapper {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
}



.tick-label.static-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5); /* 静态标签颜色淡一点 */
  font-weight: 400;
  white-space: nowrap;
}

/* 当前年份标签 - 跟随滑块，高亮显示 */
.current-year-label {
  position: absolute;
  top: -32px; /* 显示在滑块上方 */
  transform: translateX(-50%);
  background: #3b82f6;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  z-index: 5;
}

/* 小三角 */
.current-year-label::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid #3b82f6;
}
</style>
