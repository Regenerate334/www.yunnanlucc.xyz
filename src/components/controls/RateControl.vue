<!-- RateControl: 垦殖与转换率分析的入口组件，负责弹出对应的分析面板 -->
<!--
  @component RateControl
  @description 综合变化率分析控制面板，整合了复垦率与未利用地率的交互逻辑
  @props 无
  @emits close (关闭面板)
  @dependencies LandRateControl, useGlobalStore
-->
<template>
    <div class="rate-control">
        <!-- 侧边栏入口按钮 -->
        <button @click="toggleModal" class="control-btn" :class="{ active: isVisible }" title="垦殖与转换率分析">
            <img :src="rateIcon" class="rate-icon" alt="图标" />
            <span class="btn-label">垦殖转换</span>
        </button>

        <transition name="bubble-pop">
            <LandRateControl
                ref="innerControlRef"
                v-if="isVisible"
                @close="closeModal"
                @rate-query="$emit('rate-query', $event)"
                @reset="$emit('reset-map')"
            />
        </transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import rateIcon from '@/assets/icons/business/land-rate.png';
import LandRateControl from './LandRateControl.vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'rate';

const emit = defineEmits(['rate-query', 'reset-map']);
const isVisible = computed(() => globalStore.activePanel === panelName);
const innerControlRef = ref(null);

function toggleModal() {
    if (globalStore.activePanel === panelName) {
        globalStore.setActivePanel(null);
    } else {
        globalStore.setActivePanel(panelName);
    }
}

function closeModal() {
    globalStore.setActivePanel(null);
}

const setLoading = (val) => {
    if (innerControlRef.value) innerControlRef.value.setLoading(val);
};

const setError = (msg) => {
    if (innerControlRef.value) innerControlRef.value.setError(msg);
};

defineExpose({ setLoading, setError });
</script>

<style scoped>
/* 根容器不再需要 position: relative，以便子面板相对于主工具栏容器对齐 */

.control-btn {
    position: relative;
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
    color: #a5ccff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    flex-direction: column;
    gap: 2px;
    pointer-events: auto;
}

.control-btn.active {
    background: #3B76E1 !important;
    border-color: #3B76E1;
    color: #ffffff;
    box-shadow: 0 4px 10px rgba(59, 118, 225, 0.3);
}

.control-btn:hover {
    background: rgba(30, 58, 138, 0.6);
    border-color: rgba(59, 130, 246, 0.5);
    transform: translateY(-2px);
    color: #ffffff;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

.control-btn .rate-icon {
    width: 28px;
    height: 28px;
    transition: transform 0.3s ease;
    pointer-events: none;
    filter: brightness(0) invert(1); /* 保持白色图标风格 */
}

.control-btn:hover .rate-icon {
    transform: scale(1.1);
}

.btn-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
    pointer-events: none;
}

/* 入场/离场动画修正：从下方弹出并缩放 */
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
