<!--
  @component AreaMeasureButton
  @description 地图测面工具组件，支持多边形绘制、实时面积计算及单位换算展示
  @props 无
  @emits 无
  @dependencies useMeasurement (测绘逻辑), useGlobalStore (全局状态控制)
-->
<template>
    <div class="vibe-area-measure" ref="containerRef">
        <button @click="toggleMeasure" class="measure-btn" :class="{ active: isMeasuring }" title="测面积">
            <img src="@/assets/icons/map/measure-area.png" class="measure-icon" alt="测面积" />
            <span class="btn-label">测面积</span>
        </button>

        <!-- 右侧弹出结果面板 -->
        <transition name="bubble-pop">
            <div v-if="globalStore.activePanel === 'area'" class="result-popover vibe-panel">
                <!-- 面板头部: 居中标题 + 关闭按钮 -->
                <div class="vibe-panel-header">
                    <h1 class="vibe-panel-title">测面结果</h1>
                    <button class="vibe-close-btn" @click="globalStore.setActivePanel(null)" title="关闭面板">
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div class="vibe-panel-body">
                    <div class="vibe-section">
                        <div class="vibe-section-label">显示单位</div>
                        <div class="vibe-inset-card unit-selector-card" ref="unitDropdownRef">
                            <div class="vibe-custom-select" @click.stop="toggleUnitDropdown">
                                <span class="selected-text">{{ unitLabels[areaUnit] }}</span>
                                <svg class="chevron" :class="{ open: isUnitDropdownOpen }" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none">
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </div>
                            <transition name="dropdown-fade">
                                <ul v-if="isUnitDropdownOpen" class="vibe-select-options">
                                    <li v-for="(label, value) in unitLabels" :key="value" 
                                        :class="{ active: areaUnit === value }" @click.stop="selectUnit(value)">
                                        {{ label }}
                                        <svg v-if="areaUnit === value" viewBox="0 0 24 24" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none">
                                            <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                    </li>
                                </ul>
                            </transition>
                        </div>
                    </div>

                    <!-- 结果数值模块 -->
                    <div class="vibe-section">
                        <div class="vibe-section-label">测量结果</div>
                        <div class="vibe-inset-card data-card">
                            <span class="vibe-data-value">{{ formattedArea }}</span>
                        </div>
                    </div>
                </div>

                <!-- 面板底部: 全宽主按钮 -->
                <div class="vibe-panel-footer">
                    <button class="vibe-execute-btn vibe-warn" @click="clearMeasurement">
                        <span>清除测量</span>
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
    areaUnit,
    distanceUnit,
    results,
    activateTool,
    clearMeasurement: _clearMeasurement, // Rename to avoid conflict
    formatDistance,
    formatArea
} = useMeasurement();

const isMeasuring = computed(() => activeTool.value === 'area');

const containerRef = ref(null);

// 监听全局面板状态，如果是 area 则激活测量工具，否则取消激活
watch(() => globalStore.activePanel, (newVal) => {
    if (newVal === 'area') {
        if (activeTool.value !== 'area') {
            activateTool('area');
        }
    } else if (activeTool.value === 'area') {
        activateTool(null);
    }
});

function toggleMeasure() {
    if (globalStore.activePanel === 'area') {
        globalStore.setActivePanel(null);
    } else {
        globalStore.setActivePanel('area');
    }
}

const isUnitDropdownOpen = ref(false);
const unitDropdownRef = ref(null);

const unitLabels = {
    sq_meter: '平方米',
    sq_kilometer: '平方千米',
    sq_inch: '平方英寸',
    sq_foot: '平方英尺',
    sq_yard: '平方码',
    sq_mile: '平方英里',
    acre: '英亩',
    are: '公亩',
    hectare: '公顷'
};

function toggleUnitDropdown() {
    isUnitDropdownOpen.value = !isUnitDropdownOpen.value;
}

function selectUnit(value) {
    areaUnit.value = value;
    isUnitDropdownOpen.value = false;
}

const formattedArea = computed(() => formatArea(results.area));

const clearMeasurement = () => {
    _clearMeasurement(); // Call the original clearMeasurement from useMeasurement
    // Optionally, if you need to reset local state specific to this component:
    // areaResult.value = 0; // This line was in the instruction but `areaResult` is not defined here.
    // emit('clear'); // This line was in the instruction but `emit` is not defined here.
};

// 处理点击外部关闭面板
const handleClickOutside = (event) => {
    if (!containerRef.value) return;
    const path = event.composedPath();
    const isInside = path.includes(containerRef.value);
    
    // 关键修正：只有在点击既不在按钮容器内，也不在地图区域内时，才关闭面板
    const isMapClick = path.some(el => el.id === 'cesiumContainer' || (el.classList && el.classList.contains('cesium-viewer')));
    
    if (!isInside && !isMapClick && globalStore.activePanel === 'area') {
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
    setTimeout(() => window.addEventListener('click', handleClickOutside), 0);
});

onUnmounted(() => {
    window.removeEventListener('click', handleClickOutside);
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
    filter: brightness(0) invert(1);
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
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    border-radius: 50%;
}

.vibe-close-btn:hover {
    color: #F56C6C; /* 悬停变红 */
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-50%) rotate(90deg);
}

/* Body: 间距舒适的模块化布局 */
/* Body: 极限压缩间距 */
.vibe-panel-body {
    padding: 10px 14px; 
    display: flex;
    flex-direction: column;
    gap: 10px; 
}

/* 二级标题简洁化 */
.vibe-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    padding: 6px 12px;
    transition: all 0.2s;
}

.vibe-inset-card.data-card {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
}

.vibe-data-value {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    font-family: 'Inter', system-ui, sans-serif;
    letter-spacing: 0.5px;
}

/* 下拉框深度定制 (Vibe Select) */
.unit-selector-card {
    position: relative;
    padding: 0;
}

.vibe-custom-select {
    padding: 8px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}

.vibe-custom-select .selected-text {
    font-size: 12px;
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
    top: calc(100% + 4px); /* 适应极致压缩后的间距 */
    left: 0;
    right: 0;
    background: rgba(23, 35, 46, 0.98);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    margin: 0;
    padding: 6px;
    list-style: none;
    z-index: 2500; /* 确保层级高于一切，突破容器限制 */
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    max-height: 180px;
    overflow-y: auto;
}

/* 统一暗色滚动条样式 */
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
    padding: 0 16px 12px;
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
