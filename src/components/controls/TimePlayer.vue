<template>
  <div class="time-player-wrapper" ref="containerRef">
    <!-- 主按钮 -->
    <button 
      class="time-toggle-btn" 
      @click="toggleOpen" 
      :class="{ active: isOpen }" 
      title="时间控制器"
    >
      <svg class="toggle-icon" viewBox="0 0 24 24" fill="currentColor">
         <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
      </svg>
      <span class="btn-label">时间轴</span>
    </button>

    <!-- 弹出面板 (原时间播放器内容) -->
    <transition name="pop-fade">
      <div v-if="isOpen" class="time-player-panel" :class="{ vertical: layout === 'vertical' }">
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
          <div v-if="showSpeedControl" class="speed-control" @click="toggleSpeed" :title="'当前速度: ' + currentSpeedLabel">
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
                :style="layout === 'vertical' ? { top: getPercent(index) + '%' } : { left: getPercent(index) + '%' }"
              >
                <!-- 仅显示主要刻度 (竖线风格 -> 垂直模式下改为横线) -->
                <span v-if="shouldShowStaticLabel(index)" class="tick major-tick"></span>
                
                <!-- 静态年份标签 -->
                <span v-if="shouldShowStaticLabel(index)" class="tick-label static-label">{{ year }}</span>
              </div>
              
              <!-- 动态当前年份标签 (跟随滑块) -->
              <div 
                class="current-year-label"
                :style="layout === 'vertical' ? { top: getPercent(currentIndex) + '%' } : { left: getPercent(currentIndex) + '%' }"
              >
                {{ years[currentIndex] }}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount, onMounted, onUnmounted } from 'vue';

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
  },
  layout: {
    type: String,
    default: 'horizontal',
    validator: (v) => ['horizontal', 'vertical'].includes(v)
  },
  showSpeedControl: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:modelValue']);

// Playback Logic
const isPlaying = ref(false);
const currentIndex = ref(0);
let timer = null;

const speedOptions = [
  { label: '1x', val: 1 },
  { label: '2x', val: 2 },
  { label: '0.5x', val: 0.5 }
];
const currentSpeedIndex = ref(0);
const currentSpeedLabel = computed(() => speedOptions[currentSpeedIndex.value].label);
const maxIndex = computed(() => props.years.length - 1);

// Sync local index with prop
watch(() => props.modelValue, (newVal) => {
  const idx = props.years.indexOf(newVal);
  if (idx !== -1) {
    currentIndex.value = idx;
  }
}, { immediate: true });

function togglePlay() {
  if (isPlaying.value) {
    stop();
  } else {
    play();
  }
}

function play() {
  if (isPlaying.value) return;
  isPlaying.value = true;
  
  const speed = speedOptions[currentSpeedIndex.value].val;
  // Higher speed value = Faster playback = Smaller interval
  const effectiveInterval = props.interval / speed;
  
  timer = setInterval(() => {
    let next = currentIndex.value + 1;
    if (next > maxIndex.value) {
      next = 0; // Loop by default
    }
    currentIndex.value = next;
    emit('update:modelValue', props.years[next]);
  }, effectiveInterval);
}

function toggleSpeed() {
  currentSpeedIndex.value = (currentSpeedIndex.value + 1) % speedOptions.length;
  if (isPlaying.value) {
    stop();
    play();
  }
}

function onInput(e) {
  const val = parseInt(e.target.value);
  currentIndex.value = val;
  emit('update:modelValue', props.years[val]);
}

function getPercent(index) {
  if (maxIndex.value <= 0) return 0;
  return (index / maxIndex.value) * 100;
}

function shouldShowStaticLabel(index) {
  const total = props.years.length;
  if (total <= 12) return true;
  // Show first, last, and every ~5th
  if (index === 0 || index === total - 1) return true;
  const step = Math.floor(total / 6);
  return index % step === 0;
}

// Popup State managed by global store
import { useGlobalStore } from '../../stores/global'

const globalStore = useGlobalStore()
const panelName = 'time'
const containerRef = ref(null);
const isOpen = computed(() => globalStore.activePanel === panelName);

function toggleOpen() {
  globalStore.setActivePanel(panelName);
}

// Stop playback
function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isPlaying.value = false;
}

// Expose stop as pause for parent components
defineExpose({
  pause: stop
});

watch(() => props.years, () => {
  stop();
});

onBeforeUnmount(() => {
  stop();
});

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

// Click outside to close - Modified to ignore toolbar interactions
function handleClickOutside(event) {
  if (!isOpen.value || !event.target) return;
  
  if (containerRef.value && !containerRef.value.contains(event.target)) {
    // Exception: Do not close if clicking on main toolbar or analysis header components
    const target = event.target;
    const isToolbar = target.closest && target.closest('.main-toolbar');
    const isHeader = target.closest && target.closest('.analysis-header');
    const isDropdown = target.closest && target.closest('.dropdown-selector'); // Corrected class name
    const isSegment = target.closest && target.closest('.segmented-control');
    
    if (!isToolbar && !isHeader && !isDropdown && !isSegment) {
      globalStore.setActivePanel(null);
    }
  }
}


</script>

<style scoped>
.time-player-wrapper {
  position: relative;
  display: inline-block;
}

/* Button Base Style - Matching other control buttons */
.time-toggle-btn {
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
  z-index: 2;
}

.time-toggle-btn .toggle-icon {
  fill: #ffffff;
}

.time-toggle-btn .btn-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

.time-toggle-btn:hover {
  background: rgba(30, 58, 138, 0.6);
  border-color: rgba(59, 130, 246, 0.5);
  transform: translateY(-4px);
  color: #ffffff;
   box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.time-toggle-btn.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.time-toggle-btn.active:hover {
  transform: translateY(0);
}

.toggle-icon {
  width: 32px;
  height: 32px;
  opacity: 0.9;
}


/* Panel Styles (Renamed from .time-player) */
.time-player-panel {
  position: absolute;
  /* Updated for left-side toolbar: Expand to the RIGHT */
  left: 100%;
  right: auto;
  top: auto; /* Align to bottom instead of center */
  bottom: 0;
  transform: none;
  margin-left: 16px; /* Gap from button */
  margin-right: 0;
  
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 10px 24px 14px 24px; 
  min-width: 600px; 
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  
  transform-origin: bottom left; /* Origin for scale animation */
  z-index: 10;
}

.time-player-panel:hover {
  background: rgba(13, 25, 48, 0.5);
  border-color: rgba(59, 130, 246, 0.3);
}

/* Vertical specific styles for the panel */
.time-player-panel.vertical {
  padding: 16px 6px; 
  min-width: unset;
  width: 76px; 
  height: auto;
  max-height: 85vh;
  border-radius: 40px; 
  
  /* Reset horizontal styles ?? actually vertical mode is designed to be tall */
  /* If the button is vertical, user might want the bar along side it? */
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
  border-radius: 10px; 
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #a5ccff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  padding: 0;
}

.play-btn:hover {
  background: rgba(59, 130, 246, 0.4);
  border-color: rgba(59, 130, 246, 0.6);
  transform: translateY(-2px);
  color: white;
}

.speed-control {
  font-size: 11px;
  color: #a5ccff;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  min-width: 44px;
  text-align: center;
}

.speed-control:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  color: white;
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
  z-index: 4; 
  cursor: pointer;
  height: 100%; 
  margin: 0;
  position: absolute;
  top: 0;
  left: 0;
}

.tick {
  display: block;
  position: absolute;
  width: 1px;
  height: 6px; 
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
  height: 18px;
  width: 18px;
  border-radius: 6px; 
  background: #a5ccff;
  border: 2px solid #fff;
  margin-top: -7px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: grab;
}

.timeline-slider:hover::-webkit-slider-thumb {
  background: #fff;
  transform: scale(1.1);
}

.timeline-slider:active::-webkit-slider-thumb {
  cursor: grabbing;
  transform: scale(0.9);
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
  color: rgba(255, 255, 255, 0.5); 
  font-weight: 400;
  white-space: nowrap;
}

/* 当前年份标签 - 跟随滑块，高亮显示 */
.current-year-label {
  position: absolute;
  top: -32px; 
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

/* ============================
   Vertical Layout Styles 
   ============================ */

.time-player-panel.vertical {
  width: 76px; /* consistent width */
  padding: 16px 6px;
  /* Re-assert colors */
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(12px);
}

.time-player-panel.vertical .controls-row {
  flex-direction: column;
  height: min(70vh, 560px); 
  gap: 4px; 
  width: 100%;
}

.time-player-panel.vertical .play-btn {
  width: 38px;
  height: 38px;
  margin: 0 auto;
  border-radius: 50%; 
  background: rgba(59, 130, 246, 0.25);
  border: 1px solid rgba(59, 130, 246, 0.4);
  color: #a5ccff;
  box-shadow: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.time-player-panel.vertical .play-btn:hover {
  background: rgba(59, 130, 246, 0.4);
  border-color: rgba(59, 130, 246, 0.6);
  transform: translateY(-2px);
  color: white;
}

.time-player-panel.vertical .play-btn svg {
  width: 16px;
  height: 16px;
}

.time-player-panel.vertical .speed-control {
  font-size: 10px;
  font-weight: 500;
  padding: 4px 10px;
  min-width: unset;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px; 
  color: #a5ccff;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.time-player-panel.vertical .speed-control:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  color: white;
}

.time-player-panel.vertical .timeline-slider {
  transform: rotate(90deg);
  transform-origin: center center;
  width: 480px; 
  height: 48px; 
  position: absolute;
  top: 50%;
  left: 30%;
  margin-left: -240px; 
  margin-top: -24px; 
}

/* Adjust ticks for vertical */
.time-player-panel.vertical .ticks {
  width: 100%;
  height: 100%; 
  top: 0;
  left: 0;
  transform: none;
  pointer-events: none;
}

.time-player-panel.vertical .tick-wrapper {
  left: 30%; 
  transform: translate(-50%, -50%);
  width: 0;
  height: 0;
}

.time-player-panel.vertical .tick {
  width: 14px; 
  height: 3px; 
  background: rgba(255, 255, 255, 0.7);
  border-radius: 1.5px;
}

/* Revert Static Labels to persistent visibility */
.time-player-panel.vertical .tick-label.static-label {
  left: 14px; 
  right: auto;
  top: 50%;
  transform: translateY(-50%);
  text-align: left;
  white-space: nowrap;
  width: auto; 
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.5px;
  opacity: 1; 
}

/* Revert current year label */
.time-player-panel.vertical .current-year-label {
  top: 50%; 
  left: 40px; 
  right: auto;
  transform: translateY(-50%); 
  background: #3b82f6;
  padding: 4px 8px; 
  font-size: 14px; 
  font-weight: 700;
  color: #fff;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  border-radius: 6px; 
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  z-index: 10;
}

.time-player-panel.vertical:hover .current-year-label {
  opacity: 1;
  visibility: visible;
}

/* Triangle for vertical mode */
.time-player-panel.vertical .current-year-label::after {
  content: '';
  display: block;
  position: absolute;
  top: 50%;
  left: -6px; 
  right: auto;
  bottom: auto;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #3b82f6; 
  border-left: none;
}

.time-player-panel.vertical .slider-container {
   overflow: visible; 
   width: 100%;
   height: 480px; 
   flex: none; 
   display: flex;
   justify-content: center; 
   position: relative;
   margin-top: 10px; 
   margin-bottom: 30px; 
}

/* Continuous Axis Line */
.time-player-panel.vertical .ticks::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 30%; 
  transform: translateX(-50%);
  width: 4px; 
  background: rgba(255, 255, 255, 0.3); 
  border-radius: 2px;
  z-index: -1; 
}

.time-player-panel.vertical .timeline-slider::-webkit-slider-runnable-track {
  background: transparent;
}


/* Animation for Popup */
.pop-fade-enter-active,
.pop-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom left; /* Expand from left */
}

.pop-fade-enter-from,
.pop-fade-leave-to {
  opacity: 0;
  transform: scale(0.9) translateX(-20px);
}

.pop-fade-enter-to,
.pop-fade-leave-from {
  opacity: 1;
  transform: scale(1) translateX(0);
}
</style>
