<template>
  <div class="right-panel-container">
    <!-- 1. 耦合协调度 (CCDM) -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#10b981">
        <div class="panel-title">耦合协调度 (CCDM)</div>
        <div class="chart-wrapper">
          <CouplingCoordinationChart />
        </div>
      </TechBorder>
    </div>

    <!-- 2. 土地流转 (Transition Flow) -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#8b5cf6">
        <div class="panel-title">土地流转 (Transition Flow)</div>
        <div class="chart-wrapper">
          <LandUseChordChart />
        </div>
      </TechBorder>
    </div>

    <!-- 3. 景观格局 (Landscape Pattern) -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#10b981">
        <div class="panel-title">景观格局 (Landscape Pattern)</div>
        <div class="chart-wrapper">
          <LandscapeMetricsHeatmap />
        </div>
      </TechBorder>
    </div>
  </div>
</template>

<script setup>
import TechBorder from '../ui/TechBorder.vue';
import CouplingCoordinationChart from '../charts/sci/CouplingCoordinationChart.vue';
import LandUseChordChart from '../charts/sci/LandUseChordChart.vue';
import LandscapeMetricsHeatmap from '../charts/sci/LandscapeMetricsHeatmap.vue';

defineProps({
  year: { type: Number, default: 2023 }
});
</script>

<style scoped>
.right-panel-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.section-container {
  width: 100%;
  min-height: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: bold;
  color: #e2e8f0;
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid currentColor;
  display: flex;
  align-items: center;
}

.chart-wrapper {
  width: 100%;
  height: calc(100% - 25px);
}
</style>
