<template>
    <div class="dashboard-overlay">
        <!-- 顶部 Header -->
        <DashboardHeader @close="$emit('close')" />

        <!-- 左翼：监测与预警 -->
        <div class="dashboard-wing left-wing">
            <DashboardLeftPanel :year="year" />
        </div>

        <!-- 右翼：评估与洞察 -->
        <div class="dashboard-wing right-wing">
            <DashboardRightPanel :year="year" />
        </div>

        <!-- 底部装饰与控制栏 -->
        <DashboardFooter :year="year" @update:year="onYearUpdate" />
    </div>
</template>

<script setup>
import DashboardHeader from '../components/dashboard/DashboardHeader.vue';
import DashboardFooter from '../components/dashboard/DashboardFooter.vue';
import DashboardLeftPanel from '../components/dashboard/DashboardLeftPanel.vue';
import DashboardRightPanel from '../components/dashboard/DashboardRightPanel.vue';

const props = defineProps({
    year: { type: Number, default: 2023 }
});

const emit = defineEmits(['close', 'update:year']);

function onYearUpdate(newYear) {
    emit('update:year', newYear);
}
</script>

<style scoped>
.dashboard-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2000;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: radial-gradient(circle at center, transparent 30%, rgba(0, 0, 0, 0.9) 100%);
    font-family: 'Microsoft YaHei', sans-serif;
    color: #fff;
}

/* Wings */
.dashboard-wing {
    position: absolute;
    top: 90px;
    bottom: 40px;
    width: 25vw;
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 0 10px;
    pointer-events: auto;
}

.left-wing {
    left: 0;
    background: linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0));
}

.right-wing {
    right: 0;
    background: linear-gradient(to left, rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0));
}
</style>
