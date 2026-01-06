<template>
  <div class="right-panel-container">
    <!-- 1. 耦合协调度 (CCDM) -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#10b981">
        <div class="panel-title centered-title">耦合协调度</div>
        <div class="chart-wrapper">
          <CouplingCoordinationChart :year="year" />
        </div>
      </TechBorder>
    </div>

    <!-- 2. 土地流转 (Transition Flow) -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#8b5cf6">
        <div class="panel-title centered-title">土地流转</div>
        <div class="chart-wrapper">
          <LandUseSankeyChart :year="year" />
        </div>
      </TechBorder>
    </div>

    <!-- 3. 景观格局 (Landscape Pattern) -->
    <div class="section-container" style="flex: 1;">
      <TechBorder color="#10b981">
        <div class="panel-title centered-title">景观格局</div>
        <div class="chart-wrapper">
          <LandscapeMetricsHeatmap :year="year" />
        </div>
      </TechBorder>
    </div>
  </div>
</template>

<script setup>
import TechBorder from '../ui/TechBorder.vue';
import CouplingCoordinationChart from '../charts/sci/CouplingCoordinationChart.vue';
import LandUseSankeyChart from '../charts/sci/LandUseSankeyChart.vue';
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
  font-size: 16px;
  font-weight: bold;
  color: #a5ccff;
  margin-bottom: 15px;
  padding-left: 12px;
  border-left: 4px solid #10b981;
  display: flex;
  align-items: center;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  letter-spacing: 1px;
}

.panel-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(16, 185, 129, 0.5), transparent);
  margin-left: 15px;
}

.centered-title {
  justify-content: center;
  padding-left: 0;
  border-left: none;
}

.centered-title::after {
  display: block;
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, rgba(16, 185, 129, 0.5), transparent);
  margin-left: 15px;
}

.centered-title::before {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(to left, rgba(16, 185, 129, 0.5), transparent);
  margin-right: 15px;
}

.chart-wrapper {
  width: 100%;
  height: calc(100% - 25px);
}
</style>
