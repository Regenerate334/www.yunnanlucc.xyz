<!--
  @component TimeSelectionButton
  @description 时间选择入口组件，采用底部导航栏标准的圆形按钮触发，弹出水平时间轴面板。
  @props modelValue (选中年份)
  @emits update:modelValue (年份变更事件)
-->
<template>
  <div class="time-selection-wrapper">
    <!-- 统一风格的圆形触发按钮 -->
    <button 
      class="time-toggle-btn" 
      :class="{ active: isVisible }"
      @click="togglePanel"
      title="时间选择"
    >
      <img :src="timeIcon" class="btn-icon" alt="图标" />
      <span class="btn-label">时间选择</span>
    </button>

    <!-- 水平时间轴弹出面板 -->
    <transition name="timeline-slide">
      <div v-if="isVisible" class="timeline-popover" @click.stop>
        <div class="timeline-container">
          <!-- 时间轴导航 -->
          <div class="timeline-nav">
            <button class="nav-arrow" @click="stepYear(-1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <!-- 播放控制 -->
            <div class="playback-controls">
              <button class="play-toggle" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
                <div class="play-icon-wrapper icon" :class="{ 'is-playing': isPlaying }">
                  <svg v-if="!isPlaying" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                </div>
              </button>
            </div>

            <div 
              class="timeline-track-wrapper" 
              ref="trackWrapper"
              @wheel="handleWheel"
              @mousedown="startDrag"
              :class="{ 'is-dragging': isDragging }"
            >
              <div class="timeline-track">
                <div 
                  v-for="(year, index) in yearsAll" 
                  :key="year"
                  class="year-node"
                  :class="{ 
                    active: modelValue === year,
                    'is-last': index === yearsAll.length - 1
                  }"
                  @click="selectYear(year)"
                >
                  <div class="node-dot"></div>
                  <span class="node-year">{{ year }}</span>
                </div>
              </div>
            </div>

            <button class="nav-arrow" @click="stepYear(1)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 点击外部关闭 -->
    <div v-if="isVisible" class="popover-backdrop" @click="closePanel"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useGlobalStore } from '../../stores/index.ts';
import timeIcon from '../../assets/icons/business/time-selector.png';

const props = defineProps({
  modelValue: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

const globalStore = useGlobalStore();
const panelName = 'time_selection';
const isVisible = computed(() => globalStore.activePanel === panelName);

const yearsAll = computed(() => globalStore.yearsAll || []);
const isPlaying = ref(false);
let playTimer = null;

const isAtStart = computed(() => props.modelValue === yearsAll.value[0]);
const isAtEnd = computed(() => props.modelValue === yearsAll.value[yearsAll.value.length - 1]);

// 时间轴滚动逻辑
const trackWrapper = ref(null);
const nodeOffset = 70; // 每个节点的预估宽度

const trackStyle = computed(() => {
  const index = yearsAll.value.indexOf(props.modelValue);
  if (index === -1) return {};
  
  // 核心同步：让当前选中的年份始终位于容器可见范围
  // 这里可以根据需求做更复杂的偏移计算
  return {};
});

function togglePanel() {
  if (globalStore.activePanel === panelName) {
    globalStore.setActivePanel(null);
  } else {
    globalStore.setActivePanel(panelName);
    isPlaying.value = false;
    // 自动滚动到当前年份
    nextTick(() => scrollIntoView(props.modelValue));
  }
}

function closePanel() {
  globalStore.setActivePanel(null);
  isPlaying.value = false;
}

function selectYear(year) {
  emit('update:modelValue', year);
  scrollIntoView(year);
}

// 左右箭头控制：点击时逐年切换年份
function stepYear(direction) {
  if (!yearsAll.value.length) return;
  const index = yearsAll.value.indexOf(props.modelValue);
  const nextIndex = index + direction;
  
  // 边界检查
  if (nextIndex >= 0 && nextIndex < yearsAll.value.length) {
    selectYear(yearsAll.value[nextIndex]);
  }
}

// 鼠标滚轮横向滚动支持
function handleWheel(e) {
  if (!trackWrapper.value) return;
  // 阻止默认垂直滚动，转为水平滚动
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    trackWrapper.value.scrollLeft += e.deltaY;
  }
}

// 鼠标拖拽平滑滚动支持
const isDragging = ref(false);
const startX = ref(0);
const startScrollLeft = ref(0);

function startDrag(e) {
  if (!trackWrapper.value) return;
  isDragging.value = true;
  startX.value = e.pageX - trackWrapper.value.offsetLeft;
  startScrollLeft.value = trackWrapper.value.scrollLeft;
  // 增加全局监听以防鼠标移出容器
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}

function stopDrag() {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
}

function onDrag(e) {
  if (!isDragging.value || !trackWrapper.value) return;
  e.preventDefault();
  const x = e.pageX - trackWrapper.value.offsetLeft;
  const walk = (x - startX.value) * 1.5; // 滚动灵敏度系数
  trackWrapper.value.scrollLeft = startScrollLeft.value - walk;
}

// 播放逻辑
function togglePlay() {
  isPlaying.value = !isPlaying.value;
  if (isPlaying.value) {
    if (isAtEnd.value) selectYear(yearsAll.value[0]);
    startPlayback();
  } else {
    stopPlayback();
  }
}

function startPlayback() {
  stopPlayback();
  playTimer = setInterval(() => {
    const index = yearsAll.value.indexOf(props.modelValue);
    if (index < yearsAll.value.length - 1) {
      selectYear(yearsAll.value[index + 1]);
    } else {
      // 默认循环：回到起点继续播放
      selectYear(yearsAll.value[0]);
    }
  }, 3000); // 播放间隔：3秒一跳
}

function stopPlayback() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}

function scrollIntoView(year) {
  if (!trackWrapper.value) return;
  const index = yearsAll.value.indexOf(year);
  const targetX = index * nodeOffset - (trackWrapper.value.clientWidth / 2 - nodeOffset / 2);
  trackWrapper.value.scrollTo({
    left: targetX,
    behavior: 'smooth'
  });
}

// 生命周期清理
onUnmounted(() => {
  stopPlayback();
});

watch(isVisible, (val) => {
  if (!val) stopPlayback();
});
</script>

<style scoped>
.time-selection-wrapper {
  position: relative;
}

/* 按钮样式：继承 BottomNav 统一风格 */
.time-toggle-btn {
  /* 基准样式由 BottomNav 深度选择器覆盖 */
  cursor: pointer;
}

.time-toggle-btn.active {
  background: #3B76E1 !important;
  border-color: #3B76E1;
  color: #ffffff;
  box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3) !important;
}

.btn-icon {
  width: 28px;
  height: 28px;
  filter: brightness(0) invert(1);
  opacity: 0.8;
  transition: transform 0.3s ease;
}

.trigger-btn:hover .btn-icon {
  opacity: 1;
  transform: scale(1.1);
}

.btn-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}

/* 弹出面板样式 */
.timeline-popover {
  position: absolute;
  bottom: 58px; /* 降低高度，使其更贴近底部的触发按钮 */
  left: 50%;
  transform: translateX(-50%);
  width: 480px;
  height: 64px;
  background: rgba(13, 27, 48, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  padding: 0 4px;
  z-index: 1000;
  
  /* 禁止选中文字 */
  user-select: none;
  -webkit-user-select: none;
}

.timeline-container {
  display: flex;
  align-items: center;
  width: 100%;
}

/* 播放控制 */
.playback-controls {
  margin: 0 2px;
  display: flex;
  align-items: center;
}

.play-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon-wrapper {
  width: 32px;
  height: 32px;
  background: radial-gradient(circle at 35% 35%, rgba(60, 120, 240, 0.9) 0%, rgba(20, 50, 140, 1) 100%);
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(59, 118, 225, 0.5);
  transition: all 0.3s ease;
}

.play-icon-wrapper:hover {
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(59, 118, 225, 0.8);
}

.play-icon-wrapper svg {
  width: 18px;
  height: 18px;
}

/* 时间轴导航 */
.timeline-nav {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
  overflow: hidden;
}

.nav-arrow {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  width: 24px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-arrow:hover:not(:disabled) {
  color: #fff;
}

.nav-arrow:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.nav-arrow svg {
  width: 18px;
  height: 18px;
}

.timeline-track-wrapper {
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  position: relative;
  height: 100%; /* 满高以支持垂直居中对齐 */
  /* 渐变遮罩：实现首尾模糊过渡边缘，减小比例以保护首个节点的连线 */
  mask-image: linear-gradient(
    to right, 
    transparent 0%, 
    black 8%, 
    black 92%, 
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to right, 
    transparent 0%, 
    black 8%, 
    black 92%, 
    transparent 100%
  );
}

.timeline-track-wrapper.is-dragging {
  cursor: grabbing;
  scroll-behavior: auto !important; /* 拖拽时禁用平滑滚动，确保实时跟随 */
}

.timeline-track-wrapper::-webkit-scrollbar {
  display: none;
}


.timeline-track {
  display: flex;
  position: relative;
  z-index: 1;
  padding: 0 10px;
  height: 100%;
}

.year-node {
  flex-shrink: 0;
  width: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  /* 64px高度下，中心点20px。点10px，所以padding=(20-5)=15px */
  padding-top: 15px;
  cursor: pointer;
  position: relative;
  height: 100%;
}

/* 连线段：从当前点连向下一个点 */
.year-node::after {
  content: '';
  position: absolute;
  top: 20px; /* 居中于圆点中心 15px + 5px */
  left: 50%;
  width: 70px;
  height: 1px;
  background: rgba(255, 255, 255, 0.25);
  z-index: 1;
}

.year-node.is-last::after {
  display: none;
}

.node-dot {
  width: 10px;
  height: 10px;
  background: rgba(165, 204, 255, 0.4);
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 2;
}

.node-year {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
  margin: 0;
  text-align: center;
  transition: all 0.3s ease;
  font-family: 'Din Alternate', sans-serif;
  letter-spacing: 0.5px;
}

/* 激活态：蓝色光圈 */
.year-node.active .node-dot {
  background: #3B76E1;
  border: 3px solid rgba(59, 118, 225, 0.5);
  box-shadow: 0 0 12px rgba(59, 118, 225, 0.8);
  transform: scale(1.2);
}

.year-node.active .node-year {
  color: #4a85ee;
  font-weight: 600;
  transform: scale(1.05);
}

.year-node:hover .node-dot {
  background: rgba(255, 255, 255, 0.8);
  transform: scale(1.1);
}

.year-node:hover .node-year {
  color: #ffffff;
}

/* 动画 */
.timeline-slide-enter-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.timeline-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.6, -0.28, 0.735, 0.045);
}
.timeline-slide-enter-from, .timeline-slide-leave-to {
  transform: translate(-50%, 20px) scale(0.9);
  opacity: 0;
}

.popover-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 999;
}
</style>
