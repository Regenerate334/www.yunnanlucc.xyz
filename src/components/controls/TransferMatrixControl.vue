<!-- TransferMatrixControl: 土地利用转移矩阵入口组件，负责弹出对应的转移矩阵分析面板 -->
<!--
  @component TransferMatrixControl
  @description 土地转移矩阵控制中心，负责协调年度间的地类转移数据计算与可视化展示
  @props 无
  @emits close (关闭面板)
  @dependencies LandTransferControl, useGlobalStore
-->
<template>
    <div class="transfer-matrix-control">
        <button @click="toggleModal" class="control-btn" :class="{ active: isLayerActive || isVisible }" title="土地利用转移分析">
            <img :src="matrixIcon" class="matrix-icon" alt="图标" />
            <span class="btn-label">土地流转</span>
        </button>

        <transition name="bubble-pop">
            <LandTransferControl 
                ref="innerControlRef"
                v-if="isVisible" 
                @close="closeModal" 
                @transfer-query="$emit('transfer-query', $event)"
                @reset="$emit('reset-map')"
            />
        </transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import matrixIcon from '@/assets/icons/business/land-transfer.png';
import LandTransferControl from './LandTransferControl.vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();
const panelName = 'transfer';

const emit = defineEmits(['transfer-query', 'reset-map']);
const isVisible = computed(() => globalStore.activePanel === panelName);
const isLayerActive = computed(() => globalStore.activeLayer === 'land_transfer');
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

// 透传方法给 Workbench 调用
const setLoading = (val) => {
    if (innerControlRef.value) innerControlRef.value.setLoading(val);
};

const setError = (msg) => {
    if (innerControlRef.value) innerControlRef.value.setError(msg);
};

defineExpose({ setLoading, setError });
</script>

<style scoped>

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

.control-btn .matrix-icon {
    width: 28px;
    height: 28px;
    transition: transform 0.3s ease;
    pointer-events: none;
    filter: brightness(0) invert(1);
}

.control-btn:hover .matrix-icon {
    transform: scale(1.1);
}

.btn-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
    pointer-events: none;
}

.transfer-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 85vw;
    height: 80vh;
    background: rgba(13, 25, 48, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(24px);
    z-index: 3000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.modal-header {
    padding: 20px 30px;
    background: rgba(30, 58, 138, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
}

.modal-title {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 2px;
    text-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.close-btn {
    position: absolute;
    right: 30px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 24px;
    cursor: pointer;
    padding: 10px;
    transition: color 0.2s;
}

.close-btn:hover {
    color: #fff;
}

.modal-body {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
}

.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 1999;
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

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
