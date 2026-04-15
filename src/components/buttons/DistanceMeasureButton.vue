<!--
  @component DistanceMeasureButton
  @description 地图测距工具组件，支持折线绘制、实时距离计算及多种长度单位切换
  @props 无
  @emits 无
  @dependencies useMeasurement (测绘逻辑), useGlobalStore (全局状态控制)
-->
<template>
    <div class="distance-measure-control" ref="containerRef">
        <button @click="toggleMeasure" class="measure-btn" :class="{ active: isMeasuring }" title="测距">
            <img src="../../assets/icons/map/measure-distance.png" class="measure-icon" alt="测距" />
            <span class="btn-label">测距</span>
        </button>

        <transition name="bubble-pop">
            <div v-if="globalStore.activePanel === 'distance'" class="result-popover vibe-panel">
                <div class="vibe-panel-header">
                    <h1 class="vibe-panel-title">测距结果</h1>
                    <button class="vibe-close-btn" @click="globalStore.setActivePanel(null)" title="关闭面板">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="vibe-panel-body">
                    <!-- 单位选择模块 -->
                    <div class="vibe-section">
                        <div class="vibe-section-label">显示单位</div>
                        <div class="vibe-inset-card unit-selector-card" ref="unitDropdownRef">
                            <div class="vibe-custom-select" @click.stop="toggleUnitDropdown">
                                <span class="selected-text">{{ unitLabels[distanceUnit] }}</span>
                                <svg class="chevron" :class="{ open: isUnitDropdownOpen }" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="1.2" fill="none">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </div>
                            <transition name="dropdown-fade">
                                <ul v-if="isUnitDropdownOpen" class="vibe-select-options">
                                    <li v-for="(label, value) in unitLabels" :key="value" 
                                        :class="{ active: distanceUnit === value }" @click.stop="selectUnit(value)">
                                        {{ label }}
                                        <svg v-if="distanceUnit === value" viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="1.2" fill="none">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </li>
                                </ul>
                            </transition>
                        </div>
                    </div>

                    <!-- 结果数值模块: 仅保留水平距离 -->
                    <div class="vibe-section">
                        <div class="vibe-section-label">水平距离</div>
                        <div class="vibe-inset-card data-card">
                            <span class="vibe-data-value">{{ formatDistance(results.horizontal) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 面板底部: 全宽主按钮 -->
                <div class="vibe-panel-footer">
                    <button class="vibe-execute-btn vibe-warn" @click="clearMeasurement">
                        清除测量结果
                    </button>
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useMeasurement } from '../../composables/useMeasurement';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const {
    activeTool,
    distanceUnit,
    results,
    activateTool,
    clearMeasurement,
    formatDistance
} = useMeasurement();

const isMeasuring = computed(() => activeTool.value === 'distance');

// 监听全局面板状态，如果是 distance 则激活测量工具，否则取消激活
watch(() => globalStore.activePanel, (newVal) => {
    if (newVal === 'distance') {
        if (activeTool.value !== 'distance') {
            activateTool('distance');
        }
    } else if (activeTool.value === 'distance') {
        activateTool(null);
    }
});

function toggleMeasure() {
    if (globalStore.activePanel === 'distance') {
        globalStore.setActivePanel(null);
    } else {
        globalStore.setActivePanel('distance');
    }
}

const isUnitDropdownOpen = ref(false);
const containerRef = ref(null);
const unitDropdownRef = ref(null);

const unitLabels = {
    meter: '米',
    kilometer: '公里',
    inch: '英寸',
    foot: '英尺',
    yard: '码',
    mile: '英里',
    nautical_mile: '海里'
};

function toggleUnitDropdown() {
    isUnitDropdownOpen.value = !isUnitDropdownOpen.value;
}

function selectUnit(value) {
    distanceUnit.value = value;
    isUnitDropdownOpen.value = false;
}

const handleClickOutside = (event) => {
    const path = event.composedPath();
    const isInside = containerRef.value && path.includes(containerRef.value);
    
    // 关键修正：只有在点击既不在按钮容器内，也不在地图区域内时，才关闭面板
    const isMapClick = path.some(el => el.id === 'cesiumContainer' || (el.classList && el.classList.contains('cesium-viewer')));
    
    if (!isInside && !isMapClick && globalStore.activePanel === 'distance') {
        globalStore.setActivePanel(null);
    }
    
    // 下拉框遮罩逻辑
    const isSelectClick = path.some(el => 
        el.classList && (el.classList.contains('vibe-custom-select') || el.classList.contains('vibe-select-options'))
    );
    if (!isSelectClick) {
        isUnitDropdownOpen.value = false;
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});


</script>

<style scoped>
/* 根容器不再需要 position: relative，以便子面板相对于主工具栏容器对齐 */

.measure-btn {
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
    pointer-events: auto;
}

.btn-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
    pointer-events: none;
}

.measure-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.measure-btn.active {
    background: #3B76E1 !important;
    border-color: #3B76E1;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.measure-btn:active {
    transform: translateY(0);
}

.measure-icon {
    width: 32px;
    height: 32px;
    object-fit: contain;
    transition: all 0.3s ease;
}

.measure-btn:hover .measure-icon {
    opacity: 1;
}

.measure-btn.active .measure-icon {
    opacity: 1;
}

/* 弹出面板基础结构 (Vibe Panel 规范) */
.vibe-panel {
    position: absolute;
    bottom: calc(100% + 15px); /* 置于按钮上方 15px */
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    background: rgba(30, 45, 90, 0.95);
    backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.5);
    color: #E2E8F0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: visible; 
    font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 气泡尖角 */
.vibe-panel::after {
    content: '';
    position: absolute;
    bottom: -6px; 
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: inherit; 
    border-right: 1px solid rgba(255, 255, 255, 0.12);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    z-index: -1; 
}

/* Header 样式 */
.vibe-panel-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 43px; 
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.vibe-panel-title {
    font-weight: 600;
    font-size: 15px;
    letter-spacing: 1.5px;
    color: #fff;
    margin: 0;
    text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.vibe-close-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(245, 108, 108, 0.15); /* 默认开启半透明红 */
    border: none;
    color: #F56C6C; /* 默认红色 */
    cursor: pointer;
    width: 34px; /* 放大一致 */
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: 50%;
}

.vibe-close-btn:hover {
    background: rgba(245, 108, 108, 0.25);
    color: #fff;
    transform: translateY(-50%) rotate(90deg) scale(1.1);
}

/* Body: 极限压缩间距 */
.vibe-panel-body {
    padding: 10px 14px; /* 从 12/16 进一步压缩 */
    display: flex;
    flex-direction: column;
    gap: 10px; /* 从 12px 压缩 */
}

/* 二级标题简洁化 */
.vibe-section {
    display: flex;
    flex-direction: column;
    gap: 8px; /* 从 10px 压缩 */
}

.vibe-section-label {
    position: relative;
    font-size: 12px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: 0.5px;
    padding-left: 10px;
    display: flex;
    align-items: center;
}

.vibe-section-label::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 12px;
    background: #3B76E1;
    border-radius: 1px;
}

/* 内嵌卡片: 极限尺寸压缩 */
.vibe-inset-card {
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 6px 12px; /* 从 8/12 压缩 */
    transition: all 0.2s;
}

.vibe-inset-card.data-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 34px; /* 从 38px 压缩 */
}

.vibe-data-value {
    font-size: 16px; /* 字号降级，确保不盖过主标题 */
    font-weight: 700;
    color: #fff;
    font-family: 'Inter', system-ui, sans-serif;
    letter-spacing: 0.5px;
}

/* 下拉框深度定制 (Vibe Select) */
.unit-selector-card {
    position: relative;
    padding: 0; /* 让 trigger 填满 */
}

.vibe-custom-select {
    padding: 8px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}

.vibe-custom-select .selected-text {
    font-size: 13px;
    font-weight: 600;
}

.vibe-custom-select .chevron {
    color: #64748B;
    transition: transform 0.3s;
}

.vibe-custom-select .chevron.open {
    transform: rotate(180deg);
}

.vibe-select-options {
    position: absolute;
    bottom: calc(100% + 4px); /* 改为向上展开 */
    left: 0;
    right: 0;
    background: rgba(23, 35, 46, 0.98);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    margin: 0;
    padding: 6px;
    list-style: none;
    z-index: 2500;
    box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.6);
    max-height: 180px;
    overflow-y: auto;
}

/* 对齐土地流转面板的暗色滚动条 */
.vibe-select-options::-webkit-scrollbar {
    width: 4px;
}

.vibe-select-options::-webkit-scrollbar-track {
    background: transparent;
}

.vibe-select-options::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
}

.vibe-select-options::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

.vibe-select-options li {
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: #94A3B8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.vibe-select-options li:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
}

.vibe-select-options li.active {
    background: rgba(59, 118, 225, 0.15);
    color: #3B76E1;
    font-weight: 700;
}

/* Footer 极限紧凑 */
.vibe-panel-footer {
    padding: 0 16px 12px; /* 移除上内边距，利用 body gap */
}

.vibe-execute-btn {
    width: 100%;
    height: 36px;
    background: linear-gradient(to bottom, #4a85ee, #3B76E1);
    border: none;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 1px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 12px rgba(59, 118, 225, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
}

.vibe-execute-btn::after {
    content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
    background: linear-gradient(120deg, transparent, rgba(255,255,255,0.1), transparent);
    transition: all 0.5s;
}
.vibe-execute-btn:hover::after { left: 100%; }

.vibe-execute-btn.vibe-warn {
    background: rgba(245, 108, 108, 0.1);
    border: 1px solid rgba(245, 108, 108, 0.3);
    color: #F56C6C;
    box-shadow: none;
}

.vibe-execute-btn.vibe-warn:hover {
    background: rgba(245, 108, 108, 0.2);
    border-color: rgba(245, 108, 108, 0.5);
    transform: translateY(-1px);
}

.vibe-execute-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.1);
}

.vibe-execute-btn:active {
    transform: translateY(0);
}

/* 进场动画修正：从下方弹出并缩放 */
.bubble-pop-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.bubble-pop-leave-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.bubble-pop-enter-from,
.bubble-pop-leave-to {
    transform: translate(-50%, 20px) scale(0.9);
    opacity: 0;
}
</style>
