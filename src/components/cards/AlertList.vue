<!--
  @component AlertList
  @description 监测预警动态列表，基于地类动态度模型自动识别耕地流失、建设扩张等预警事件
  @props year (当前年份), data (可选的外部预警数据)
  @emits 无
  @dependencies clcdApi (数据接口), indices (动态度计算工具)
-->
<template>
  <div class="alert-list-container">
    <div class="alert-header">
      <span class="header-title">监测预警动态</span>
      <span class="header-badge">{{ alerts.length }}</span>
    </div>
    <div class="alert-scroll-area">
      <div v-if="alerts.length === 0" class="no-alerts">
        暂无预警信息
      </div>
      <div v-else class="alert-items">
        <div v-for="(alert, index) in alerts" :key="index" class="alert-item" :class="alert.level">
          <div class="alert-icon">
            <span v-if="alert.level === 'critical'">⚠️</span>
            <span v-else-if="alert.level === 'warning'">⚡</span>
            <span v-else>ℹ️</span>
          </div>
          <div class="alert-content">
            <div class="alert-title">{{ alert.title }}</div>
            <div class="alert-desc">{{ alert.message }}</div>
            <div class="alert-time">{{ alert.time }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { clcdApi } from '../../api/index.js';
import { calculateSingleDynamicDegree, transformDataForCalculation } from '../../utils/indices.ts';

const props = defineProps({
  year: { type: Number, default: 2023 },
  data: { type: Array, default: null }
});

const alerts = ref([]);

async function generateAlerts() {
  if (props.data) {
    alerts.value = props.data.map(a => ({
        level: a.type === 'danger' ? 'critical' : (a.type === 'warning' ? 'warning' : 'info'),
        title: a.title,
        message: a.content,
        time: a.time ? new Date(a.time).toLocaleTimeString() : ''
    }));
    return;
  }
  try {
    const currentYearData = await clcdApi.getYearSummary(props.year);
    // 对比前一年
    const prevYear = props.year - 1;
    const prevYearData = await clcdApi.getYearSummary(prevYear);

    const newAlerts = [];

    if (currentYearData && prevYearData) {
      const current = transformDataForCalculation(currentYearData);
      const prev = transformDataForCalculation(prevYearData);

      // 1. 耕地减少预警
      const croplandChange = calculateSingleDynamicDegree(prev['Cropland'], current['Cropland'], 1);
      if (croplandChange < -0.5) { // 减少超过 0.5%
        newAlerts.push({
          level: 'critical',
          title: '耕地面积显著减少',
          message: `较上年减少 ${Math.abs(croplandChange).toFixed(2)}%，需重点关注。`,
          time: `${props.year}年`
        });
      } else if (croplandChange < 0) {
        newAlerts.push({
          level: 'warning',
          title: '耕地面积小幅减少',
          message: `较上年减少 ${Math.abs(croplandChange).toFixed(2)}%。`,
          time: `${props.year}年`
        });
      }

      // 2. 建设用地扩张预警
      const imperviousChange = calculateSingleDynamicDegree(prev['Impervious'], current['Impervious'], 1);
      if (imperviousChange > 5) { // 增加超过 5%
        newAlerts.push({
          level: 'warning',
          title: '建设用地快速扩张',
          message: `较上年增加 ${imperviousChange.toFixed(2)}%，扩张速度较快。`,
          time: `${props.year}年`
        });
      }

      // 3. 生态用地流失 (林地+草地+水域+湿地)
      const ecoTypes = ['Forest', 'Grassland', 'Water', 'Wetland'];
      let prevEco = 0;
      let currEco = 0;
      ecoTypes.forEach(t => {
        prevEco += prev[t] || 0;
        currEco += current[t] || 0;
      });
      const ecoChange = calculateSingleDynamicDegree(prevEco, currEco, 1);
      if (ecoChange < -1) {
        newAlerts.push({
          level: 'critical',
          title: '生态用地流失',
          message: `生态功能用地较上年减少 ${Math.abs(ecoChange).toFixed(2)}%。`,
          time: `${props.year}年`
        });
      }
    }

    // 模拟一些区域性预警 (实际应基于区域数据)
    if (props.year > 2010) {
       newAlerts.push({
          level: 'info',
          title: '区域监测更新',
          message: '昆明市、曲靖市土地利用数据已更新。',
          time: `${props.year}-12-31`
       });
    }

    alerts.value = newAlerts;

  } catch (e) {
    console.error('生成预警信息失败:', e);
  }
}

onMounted(() => {
  generateAlerts();
});

watch(() => props.year, () => {
  generateAlerts();
});

watch(() => props.data, (newData) => {
  if (newData) generateAlerts();
}, { immediate: true });
</script>

<style scoped>
.alert-list-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: "Microsoft YaHei", sans-serif;
}

.alert-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 10px;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: #a5ccff;
}

.header-badge {
  background: #ef4444;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
}

.alert-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
}

.alert-scroll-area::-webkit-scrollbar {
  width: 4px;
}

.alert-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.no-alerts {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 20px 0;
  font-size: 13px;
}

.alert-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.alert-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.alert-item.critical {
  border-left-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.alert-item.warning {
  border-left-color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.alert-item.info {
  border-left-color: #3b82f6;
}

.alert-icon {
  font-size: 16px;
  padding-top: 2px;
}

.alert-content {
  flex: 1;
}

.alert-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #e2e8f0;
}

.alert-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
  margin-bottom: 4px;
}

.alert-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  text-align: right;
}
</style>
