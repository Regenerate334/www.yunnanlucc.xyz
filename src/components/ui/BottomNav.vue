<!--
  @component BottomNav
  @description 工作台底部核心导航栏，集成地图底图切换、时间轴播放及所有业务分析面板的触发入口
  @props activeTheme (当前专题)
  @emits theme-change (专题切换)
  @dependencies 多个子组件（BaseMapSelector, TimeSelectionButton等）
-->
<template>
  <div class="home-bottom-nav">
    <div class="top-right-tools">
      <div 
        v-if="authStore.user?.role === 'super_admin'"
        class="floating-tool-btn admin-trigger"
        @click="goToAdmin"
        tabindex="-1"
        title="系统控制中心"
      >
        <div class="tool-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </div>
      </div>
    </div>

    <div 
      class="nav-container" 
    >
      <!-- 左侧组：基础工具与测量 (6个) -->
      <div class="nav-group left">
        <button type="button" class="control-btn logout-btn" @click="handleLogout" @keydown.enter.stop tabindex="-1" title="退出系统">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
            <line x1="12" y1="2" x2="12" y2="12"></line>
          </svg>
        </button>
        <BaseMapSelector @change="(val) => $emit('base-map-change', val)" />
        <SpatialLayerSelector 
          :modelValue="spatialUnit"
          @update:modelValue="(val) => $emit('update:spatialUnit', val)"
          :selectedAttribute="selectedAttribute"
          @update:selectedAttribute="(val) => $emit('update:selectedAttribute', val)"
          :attributes="attributes"
        />
        <TimeSelectionButton 
          :modelValue="selectedYear"
          @update:modelValue="(val) => $emit('update:selectedYear', val)"
        />
        <RegionSelector />
        <ViewResetButton @reset-map="$emit('reset-map')" />
        <DistanceMeasureButton />
      </div>

      <!-- 中央主页按钮 -->
      <div class="nav-btn-wrapper home-center" @click="$emit('overview-click')">
        <div class="home-btn-container">
          <div class="main-btn-core">
            <img :src="overviewIcon" class="main-home-icon" alt="概览" />
          </div>
        </div>
      </div>

      <!-- 右侧组：高级分析与可视化 (7个) -->
      <div class="nav-group right">
        <AreaMeasureButton />
        <SpatialStatsButton
          ref="spatialStatsControl"
          @stats-query="(val) => $emit('stats-query', val)"
          @update-visibility="(val) => $emit('update-visibility', val)"
          @reset-map="() => $emit('reset-map')"
        />
        <AIAnalysisControl />
        <StructureAnalysisDashboard :year="selectedYear" />
        <TrendAnalysisDashboard />
        <KlineAnalysisDashboard />
        <TransferMatrixControl 
          ref="transferControl"
          @transfer-query="(val) => $emit('transfer-query', val)" 
          @reset-map="() => $emit('reset-map')" 
        />
        <RateControl
          ref="rateControl"
          @rate-query="(val) => $emit('rate-query', val)"
          @reset-map="() => $emit('reset-map')"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import overviewIcon from '@/assets/icons/common/overview.png';
// 控制组件导入
import BaseMapSelector from '../cards/BaseMapSelector.vue';
import ViewResetButton from '../buttons/ViewResetButton.vue';
import DistanceMeasureButton from '../buttons/DistanceMeasureButton.vue';
import AIAnalysisControl from '../controls/AIAnalysisControl.vue';
import StructureAnalysisDashboard from '../dashboards/StructureAnalysisDashboard.vue';
import TrendAnalysisDashboard from '../dashboards/TrendAnalysisDashboard.vue';
import KlineAnalysisDashboard from '../dashboards/KlineAnalysisDashboard.vue';
import TransferMatrixControl from '../controls/TransferMatrixControl.vue';
import RateControl from '../controls/RateControl.vue';
import AreaMeasureButton from '../buttons/AreaMeasureButton.vue';
import SpatialStatsButton from '../buttons/SpatialStatsButton.vue';
import SpatialLayerSelector from '../cards/SpatialLayerSelector.vue';
import TimeSelectionButton from '../cards/TimeSelectionButton.vue';
import RegionSelector from './RegionSelector.vue';

const props = defineProps({
  selectedYear: Number,
  playerYears: Array,
  spatialUnit: String,
  selectedAttribute: String,
  attributes: Array,
  cachedClcdData: Array
});

const emit = defineEmits([
  'base-map-change',
  'update:selectedYear', 
  'update:spatialUnit', 
  'update:selectedAttribute', 
  'transfer-query', 
  'rate-query', 
  'stats-query', 
  'update-visibility',
  'reset-map', 
  'overview-click'
]);
const transferControl = ref(null);
const rateControl = ref(null);
const spatialStatsControl = ref(null);

const router = useRouter();
const authStore = useAuthStore();

function handleLogout() {
  if (confirm('确认退出系统吗？')) {
    authStore.logout();
    router.push('/portal');
  }
}

function goToAdmin() {
  router.push('/admin');
}

defineExpose({ transferControl, rateControl, spatialStatsControl });
</script>

<style scoped>
.home-bottom-nav {
  position: fixed;
  bottom: 0px; 
  left: 0;
  right: 0;
  width: 100%;
  height: 120px; /* 大幅度增加总高度容器，确保发光和悬浮不被截断 */
  z-index: 2500;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  overflow: visible; /* 核心修复：允许内部内容突破容器 */

  /* 禁止选中文字 */
  user-select: none;
  -webkit-user-select: none;
}

.nav-container {
  position: relative;
  width: 100%; 
  max-width: 1400px;
  height: 100px; /* 从 80px 增加到 100px，提供更充裕的垂直空间 */
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: auto;
  padding: 0 30px 0 110px;
  gap: 12px;
  background: transparent;
  border: none;
  overflow: visible; /* 核心修复：允许按钮悬浮动画突破 */
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 30px; /* 增加一点间距，避免紧凑 */
}

/* 底部导航栏控制按钮拱形自适应 - 7个左侧 */
.nav-group.left > :deep(*:nth-child(1)) { transform: translateY(26px) !important; }
.nav-group.left > :deep(*:nth-child(2)) { transform: translateY(26px) !important; }
.nav-group.left > :deep(*:nth-child(3)) { transform: translateY(25px) !important; }
.nav-group.left > :deep(*:nth-child(4)) { transform: translateY(24px) !important; }
.nav-group.left > :deep(*:nth-child(5)) { transform: translateY(22px) !important; }
.nav-group.left > :deep(*:nth-child(6)) { transform: translateY(20px) !important; }
.nav-group.left > :deep(*:nth-child(7)) { transform: translateY(18px) !important; }

/* 底部导航栏控制按钮拱形自适应 - 8个右侧 */
.nav-group.right > :deep(*:nth-child(1)) { transform: translateY(18px) !important; }
.nav-group.right > :deep(*:nth-child(2)) { transform: translateY(20px) !important; }
.nav-group.right > :deep(*:nth-child(3)) { transform: translateY(21px) !important; }
.nav-group.right > :deep(*:nth-child(4)) { transform: translateY(23px) !important; }
.nav-group.right > :deep(*:nth-child(5)) { transform: translateY(24px) !important; }
.nav-group.right > :deep(*:nth-child(6)) { transform: translateY(25px) !important; }
.nav-group.right > :deep(*:nth-child(7)) { transform: translateY(26px) !important; }
.nav-group.right > :deep(*:nth-child(8)) { transform: translateY(26px) !important; }

/* 深度选择器：让所有控制按钮透明，融入背景设计图 */
:deep(.control-btn),
:deep(.reset-btn),
:deep(.measure-btn),
:deep(.ai-btn),
:deep(.time-toggle-btn),
:deep(.logout-btn),
:deep(.admin-btn),
:deep(.region-btn) {
  width: 48px !important; 
  height: 48px !important;
  border: 1px solid rgba(255, 255, 255, 0.45) !important;
  background: radial-gradient(circle at 30% 30%, rgba(80, 110, 200, 0.6) 0%, rgba(30, 45, 90, 0.85) 100%) !important;
  border-radius: 50% !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  padding: 0 !important;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
  box-shadow: 
    0 4px 10px rgba(0, 0, 0, 0.4),
    inset 0 2px 5px rgba(255, 255, 255, 0.2),
    inset 0 -2px 5px rgba(0, 0, 0, 0.3),
    0 0 12px rgba(64, 150, 255, 0.2) !important;
  backdrop-filter: blur(8px) !important;
  position: relative;
  overflow: visible; /* 允许图标轻微溢出或阴影显示 */
}

/* 添加按钮表面的高光质感 */
:deep(.logout-btn)::after,
:deep(.admin-btn)::after,
:deep(.region-btn)::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit; /* 核心修复：确保高光层契合圆形边界，去除尖角 */
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
  pointer-events: none;
}

:deep(.logout-btn:hover),
:deep(.admin-btn:hover),
:deep(.region-btn:hover) {
  background: radial-gradient(circle at 30% 30%, rgba(100, 140, 255, 0.8) 0%, rgba(40, 60, 120, 0.95) 100%) !important;
  border-color: rgba(255, 255, 255, 0.8) !important;
  transform: translateY(-8px) scale(1.15) rotate(5deg) !important;
  box-shadow: 
    0 12px 20px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(64, 150, 255, 0.6),
    inset 0 1px 2px rgba(255, 255, 255, 0.4) !important;
}

:deep(.logout-btn:hover) {
  background: radial-gradient(circle at 30% 30%, rgba(239, 68, 68, 0.8) 0%, rgba(153, 27, 27, 0.95) 100%) !important;
  border-color: rgba(255, 100, 100, 0.8) !important;
  box-shadow: 
    0 12px 20px rgba(0, 0, 0, 0.5),
    0 0 20px rgba(239, 68, 68, 0.6),
    inset 0 1px 2px rgba(255, 255, 255, 0.4) !important;
}

/* 彻底隐藏按钮内的所有文字标注 */
:deep(.control-btn span),
:deep(.reset-btn span),
:deep(.measure-btn span),
:deep(.ai-btn span),
:deep(.time-toggle-btn span),
:deep(.logout-btn span),
:deep(.admin-btn span),
:deep(.region-btn span),
:deep(.btn-label),
:deep(.nav-group button div:not(.icon):not(.btn-icon)),
:deep(.control-btn span) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
  width: 0 !important;
  overflow: hidden !important;
  position: absolute !important;
}

/* 统一所有按钮内的图标颜色为纯净白，增加滤镜使其可见 */
:deep(.nav-group button img),
:deep(.nav-group button svg) {
  width: 26px;
  height: 26px;
  margin: 0;
  filter: brightness(0) invert(1) drop-shadow(0 2px 2px rgba(0,0,0,0.3)); /* 增加图标阴影增强立体感 */
  opacity: 0.95;
  transition: transform 0.3s ease;
}

:deep(.nav-group button:hover img),
:deep(.nav-group button:hover svg) {
  transform: scale(1.1);
  opacity: 1;
}

.home-center {
  margin: 0 15px; /* 适度拉开核心距离 */
}

.nav-btn-wrapper.home-center {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 10;
  transform: translateY(15px); /* 往下平移 20px */
}

/* 首页按钮增强样式 */
.home-btn-container {
  position: relative;
  width: 88px;
  height: 88px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.home-btn-container:hover {
  transform: scale(1.1) translateY(-8px);
}

.main-btn-core {
  position: relative;
  width: 68px;
  height: 68px;
  background: radial-gradient(circle at 35% 35%, rgba(100, 130, 230, 0.8) 0%, rgba(20, 40, 100, 0.95) 100%);
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 5;
  box-shadow: 
    0px 10px 25px rgba(0, 0, 0, 0.6),
    0px 0px 30px rgba(64, 150, 255, 0.5),
    inset 0px 4px 10px rgba(255, 255, 255, 0.4),
    inset 0px -4px 10px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* 首页按钮的玻璃高光 */
.main-btn-core::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%);
  pointer-events: none;
}

/* 外围装饰光环 */
.home-btn-container::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(64, 150, 255, 0.3);
  border-radius: 50%;
  animation: pulse 3s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.8; }
  50% { transform: scale(1.1); opacity: 0.2; }
  100% { transform: scale(0.9); opacity: 0.8; }
}

.main-home-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
  filter: brightness(0) invert(1) drop-shadow(0 4px 6px rgba(0,0,0,0.4));
  transition: all 0.4s ease;
  z-index: 10;
}

.home-btn-container:hover .main-home-icon {
  transform: scale(1.1) rotate(-5deg);
}
/* 悬浮工具组样式 */
.top-right-tools {
  position: fixed;
  top: 30px;
  right: 30px;
  display: flex;
  gap: 15px;
  z-index: 9999;
  pointer-events: auto; /* 核心修复：允许鼠标事件穿透父容器的 pointer-events: none */
}

.floating-tool-btn {
  width: 50px;
  height: 50px;
  background: rgba(30, 41, 59, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

.floating-tool-btn.admin-trigger:hover {
  background: rgba(59, 130, 246, 0.6);
  transform: scale(1.1) rotate(90deg);
}

.tool-icon {
  width: 24px;
  height: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: white;
}

.tool-icon svg {
  width: 100%;
  height: 100%;
}

</style>
