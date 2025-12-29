<template>
    <div class="distance-measure-control">
        <button @click="toggleMeasure" class="measure-btn" :class="{ active: isMeasuring }" title="测距">
            <img src="../../assets/icons/ceju.png" class="measure-icon" alt="测距" />
        </button>

        <!-- 右侧弹出结果面板 -->
        <transition name="slide-fade">
            <div v-if="activeTool === 'distance'" class="result-popover">
                <div class="popover-header">
                    <span class="popover-title">测距结果</span>
                    <div class="custom-unit-dropdown" ref="unitDropdownRef">
                        <div class="unit-trigger" @click="toggleUnitDropdown">
                            <span>{{ unitLabels[distanceUnit] }}</span>
                            <span class="arrow" :class="{ open: isUnitDropdownOpen }">▼</span>
                        </div>
                        <transition name="dropdown-fade">
                            <div v-if="isUnitDropdownOpen" class="unit-options">
                                <div v-for="(label, value) in unitLabels" :key="value" class="unit-option"
                                    :class="{ active: distanceUnit === value }" @click="selectUnit(value)">
                                    {{ label }}
                                </div>
                            </div>
                        </transition>
                    </div>
                </div>
                <div class="popover-content">
                    <div class="result-item">
                        <span class="label">直线距离</span>
                        <span class="value">{{ formatDistance(results.straight) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">水平距离</span>
                        <span class="value">{{ formatDistance(results.horizontal) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">垂直高度</span>
                        <span class="value">{{ formatDistance(results.vertical) }}</span>
                    </div>
                </div>
                <div class="popover-footer">
                    <button class="clear-btn" @click="clearMeasurement">清除</button>
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useMeasurement } from '../../composables/useMeasurement';

const {
    activeTool,
    distanceUnit,
    results,
    activateTool,
    clearMeasurement,
    formatDistance
} = useMeasurement();

function toggleMeasure() {
    if (activeTool.value === 'distance') {
        activateTool(null);
    } else {
        activateTool('distance');
    }
}

const isUnitDropdownOpen = ref(false);
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

function handleClickOutside(event) {
    if (unitDropdownRef.value && !unitDropdownRef.value.contains(event.target)) {
        isUnitDropdownOpen.value = false;
    }
}

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
});

const isMeasuring = computed(() => activeTool.value === 'distance');
</script>

<style scoped>
.distance-measure-control {
    position: relative;
}

.measure-btn {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(13, 25, 48, 0.4);
    backdrop-filter: blur(12px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 2;
    color: #a5ccff;
}

.measure-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.measure-btn.active {
    background: #3b82f6;
    border-color: #60a5fa;
    color: #ffffff;
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

.measure-btn:active {
    transform: translateY(0);
}

.measure-icon {
    width: 50px;
    height: 50px;
    object-fit: contain;
    opacity: 0.8;
    transition: all 0.3s ease;
}

.measure-btn:hover .measure-icon {
    opacity: 1;
}

.measure-btn.active .measure-icon {
    opacity: 1;
}

/* 弹出面板样式 */
.result-popover {
    position: absolute;
    left: 80px;
    bottom: 0;
    width: 220px;
    background: rgba(13, 25, 48, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(20px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    color: #fff;
    z-index: 1000;
}

.popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(30, 58, 138, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px 12px 0 0;
}

.popover-title {
    font-size: 13px;
    font-weight: 600;
    color: #a5ccff;
}

.custom-unit-dropdown {
    position: relative;
    pointer-events: auto;
}

.unit-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #fff;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 80px;
    justify-content: space-between;
}

.unit-trigger span {
    pointer-events: none;
}

.unit-trigger:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
}

.arrow {
    font-size: 8px;
    color: #a5ccff;
    transition: transform 0.3s;
}

.arrow.open {
    transform: rotate(180deg);
}

.unit-options {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background: linear-gradient(135deg, rgba(13, 25, 48, 0.8) 0%, rgba(13, 25, 48, 0.5) 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    margin-top: 8px;
    padding: 6px;
    z-index: 1001;
    backdrop-filter: blur(24px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.unit-option {
    padding: 10px 16px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 8px;
    text-align: left;
    position: relative;
    display: flex;
    align-items: center;
}

.unit-option:hover {
    background: rgba(59, 130, 246, 0.12);
    color: #ffffff;
    padding-left: 20px;
}

.unit-option.active {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
    font-weight: 600;
}

.unit-option.active::before {
    content: '';
    position: absolute;
    left: 8px;
    width: 3px;
    height: 14px;
    background: #3b82f6;
    border-radius: 2px;
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
    transition: all 0.2s ease;
}

.popover-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.result-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.result-item .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
}

.result-item .value {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    font-family: 'JetBrains Mono', monospace;
}

.popover-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    text-align: right;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 0 0 12px 12px;
}

.clear-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #a5ccff;
    font-size: 12px;
    padding: 6px 16px;
    cursor: pointer;
    transition: all 0.2s;
}

.clear-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #fca5a5;
}

/* 动画 */
.slide-fade-enter-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateX(-15px);
    opacity: 0;
}
</style>
