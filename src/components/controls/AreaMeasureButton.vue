<template>
    <div class="area-measure-control">
        <button @click="handleToggle" class="measure-btn" :class="{ active: activeTool === 'area' }" title="测面积">
            <span class="measure-icon">📐</span>
        </button>

        <!-- 右侧弹出结果面板 -->
        <transition name="slide-fade">
            <div v-if="activeTool === 'area'" class="result-popover">
                <div class="popover-header">
                    <span class="popover-title">测面结果</span>
                    <select class="unit-select" v-model="areaUnit">
                        <option value="sq_meter">平方米</option>
                        <option value="sq_kilometer">平方千米</option>
                        <option value="sq_inch">平方英寸</option>
                        <option value="sq_foot">平方英尺</option>
                        <option value="sq_yard">平方码</option>
                        <option value="sq_mile">平方英里</option>
                        <option value="acre">英亩</option>
                        <option value="are">公亩</option>
                        <option value="hectare">公顷</option>
                    </select>
                </div>
                <div class="popover-content">
                    <div class="result-item">
                        <span class="label">面积</span>
                        <span class="value">{{ formatArea(results.area) }}</span>
                    </div>
                    <div class="result-item">
                        <span class="label">周长</span>
                        <span class="value">{{ formatDistance(results.perimeter) }}</span>
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
import { useMeasurement } from '../../composables/useMeasurement';

const {
    activeTool,
    areaUnit,
    distanceUnit,
    results,
    activateTool,
    clearMeasurement,
    formatDistance,
    formatArea
} = useMeasurement();

function handleToggle() {
    activateTool('area');
}
</script>

<style scoped>
.area-measure-control {
    position: relative;
}

.measure-btn {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(42, 61, 110, 0.2);
    backdrop-filter: blur(8px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 2;
}

.measure-btn:hover {
    background: rgba(52, 71, 130, 0.4);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.measure-btn.active {
    background: rgba(156, 201, 255, 0.2);
    border-color: #9cc9ff;
    box-shadow: 0 0 0 3px rgba(156, 201, 255, 0.2);
}

.measure-btn:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.measure-icon {
    font-size: 24px;
    opacity: 0.9;
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
    left: 60px;
    bottom: 0;
    width: 220px;
    background: rgba(42, 61, 110, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    backdrop-filter: blur(8px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    color: #fff;
    z-index: 1000;
    overflow: hidden;
}

.popover-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(42, 61, 110, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.popover-title {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
}

.unit-select {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    padding: 4px 8px;
    cursor: pointer;
    outline: none;
}

.unit-select option {
    background: #1a264e;
    color: #fff;
}

.popover-content {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.result-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.result-item .label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
}

.result-item .value {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
}

.popover-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    text-align: right;
}

.clear-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    padding: 6px 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.clear-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
}

/* 动画 */
.slide-fade-enter-active {
    transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateX(-10px);
    opacity: 0;
}
</style>
