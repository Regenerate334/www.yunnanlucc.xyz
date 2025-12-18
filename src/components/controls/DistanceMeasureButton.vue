<template>
    <div class="distance-measure-control">
        <button @click="toggleTool" class="measure-btn" :class="{ active: isActive }" title="测距">
            <span class="measure-icon">📏</span>
        </button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    isActive: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['toggle']);

function toggleTool() {
    emit('toggle');
}
</script>

<style scoped>
.distance-measure-control {
    position: relative;
}

.measure-btn {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    box-shadow: none;
    backdrop-filter: none;
}

.measure-btn:hover {
    background: rgba(52, 71, 130, 0.4);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.measure-btn.active {
    background: rgba(0, 229, 255, 0.3);
    border-color: rgba(0, 229, 255, 0.6);
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
</style>
