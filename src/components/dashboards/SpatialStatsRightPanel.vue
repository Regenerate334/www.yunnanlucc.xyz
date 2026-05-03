<template>
  <div class="panel-shell">
    <div class="panel-head">
      <span class="head-mark"></span>
      <div class="head-title">标准差椭圆监测</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span>监测时段</span><strong>{{ periodText }}</strong></div>
      <div class="meta-item"><span>有效期数</span><strong>{{ sortedPeriods.length }} 期</strong></div>
      <div class="meta-item"><span>椭圆覆盖率</span><strong>{{ fmtPct(derived.sde_coverage) }}%</strong></div>
      <div class="meta-item"><span>监测等级</span><strong>{{ monitorLevel }}</strong></div>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><span>最新椭圆面积</span><strong class="num-display">{{ fmtKm2(latest.areaKm2) }} km²</strong></div>
      <div class="kpi"><span>面积年均变化</span><strong class="num-display">{{ fmtSignedPct(areaAnnualRate) }}%</strong></div>

      <div class="kpi"><span>面积波动系数</span><strong class="num-display">{{ fmtPct(areaCv) }}%</strong></div>
      <div class="kpi"><span>面积振幅</span><strong class="num-display">{{ fmtPct(areaRangePct) }}%</strong></div>

      <div class="kpi"><span>最新长短轴比</span><strong class="num-display">{{ fmtIdx(latest.axisRatio) }}</strong></div>
      <div class="kpi"><span>平均长短轴比</span><strong class="num-display">{{ fmtIdx(axisMean) }}</strong></div>

      <div class="kpi"><span>最新主轴方位</span><strong class="num-display">{{ fmtAngle(latest.angleDeg) }}°</strong></div>
      <div class="kpi"><span>主方向类型</span><strong>{{ orientationBand }}</strong></div>

      <div class="kpi"><span>方向波动</span><strong class="num-display">{{ fmtAngle(rotationAvgDelta) }}°</strong></div>
      <div class="kpi"><span>方向漂移</span><strong class="num-display">{{ fmtAngle(orientationDrift) }}°</strong></div>
    </div>

    <div class="period-list">
      <div class="list-title">轨迹年份图例清单</div>
      <div v-if="trajectoryLegendItems.length === 0" class="list-empty">暂无可用轨迹图例</div>
      <div v-for="(row, idx) in trajectoryLegendItems" :key="`${row.label}-${idx}`" class="list-row">
        <span class="p-order">{{ idx + 1 }}</span>
        <span class="p-arrow" :style="{ '--legend-color': row.color }"></span>
        <span class="p-name">{{ row.label }}</span>
        <span class="p-val num-display">{{ row.cardinal }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();

defineProps({
  year: { type: Number, default: 2023 }
});
defineEmits(['update:year']);

const ctx = computed(() => globalStore.themeContext?.spatial_stats || null);
const params = computed(() => ctx.value?.params || {});
const derived = computed(() => ctx.value?.derived_metrics || {});
const sdePeriods = computed(() => Array.isArray(ctx.value?.sde_period_metrics) ? ctx.value.sde_period_metrics : []);
const trajectoryPoints = computed(() => Array.isArray(ctx.value?.trajectory_points) ? ctx.value.trajectory_points : []);
const TRAJECTORY_COLORS = ['#e53e3e', '#f06b2a', '#d85ca6', '#4d88c8', '#64b86c', '#a86ac6', '#d2be35', '#d77f2f'];

const sortedPeriods = computed(() => {
  return sdePeriods.value
    .slice()
    .sort((a, b) => {
      const aStart = Number(a?.yearStart);
      const bStart = Number(b?.yearStart);
      if (Number.isFinite(aStart) && Number.isFinite(bStart) && aStart !== bStart) return aStart - bStart;
      const aEnd = Number(a?.yearEnd);
      const bEnd = Number(b?.yearEnd);
      if (Number.isFinite(aEnd) && Number.isFinite(bEnd) && aEnd !== bEnd) return aEnd - bEnd;
      return String(a?.period || '').localeCompare(String(b?.period || ''));
    });
});

const latest = computed(() => {
  const row = sortedPeriods.value[sortedPeriods.value.length - 1] || {};
  return {
    period: String(row?.period || ''),
    areaKm2: Number(row?.areaKm2 || 0),
    axisRatio: Number(row?.axisRatio || 0),
    angleDeg: Number(row?.angleDeg || 0)
  };
});

const first = computed(() => {
  const row = sortedPeriods.value[0] || {};
  return {
    areaKm2: Number(row?.areaKm2 || 0),
    angleDeg: Number(row?.angleDeg || 0)
  };
});

const periodText = computed(() => {
  const y1 = Number(params.value?.yearStart);
  const y2 = Number(params.value?.yearEnd);
  if (Number.isFinite(y1) && Number.isFinite(y2)) return `${y1}-${y2}`;
  return '—';
});

const areaValues = computed(() => sortedPeriods.value
  .map((r) => Number(r?.areaKm2))
  .filter((v) => Number.isFinite(v) && v > 0));

const axisValues = computed(() => sortedPeriods.value
  .map((r) => Number(r?.axisRatio))
  .filter((v) => Number.isFinite(v) && v > 0));

const areaMean = computed(() => {
  if (!areaValues.value.length) return 0;
  return areaValues.value.reduce((s, v) => s + v, 0) / areaValues.value.length;
});

const axisMean = computed(() => {
  if (!axisValues.value.length) return 0;
  return axisValues.value.reduce((s, v) => s + v, 0) / axisValues.value.length;
});

const areaStd = computed(() => {
  if (!areaValues.value.length) return 0;
  const m = areaMean.value;
  const variance = areaValues.value.reduce((s, v) => s + (v - m) * (v - m), 0) / areaValues.value.length;
  return Math.sqrt(Math.max(variance, 0));
});

const areaCv = computed(() => {
  const m = areaMean.value;
  if (!Number.isFinite(m) || m <= 0) return 0;
  return areaStd.value / m;
});

const areaRangePct = computed(() => {
  if (!areaValues.value.length) return 0;
  const max = Math.max(...areaValues.value);
  const min = Math.min(...areaValues.value);
  const m = areaMean.value;
  if (!Number.isFinite(m) || m <= 0) return 0;
  return (max - min) / m;
});

const areaAnnualRate = computed(() => {
  const rows = sortedPeriods.value;
  if (rows.length < 2) return 0;
  const a0 = Number(rows[0]?.areaKm2);
  const a1 = Number(rows[rows.length - 1]?.areaKm2);
  const y0 = Number(rows[0]?.yearStart);
  const y1 = Number(rows[rows.length - 1]?.yearEnd);
  if (!Number.isFinite(a0) || !Number.isFinite(a1) || a0 <= 0) return 0;
  const yearSpan = Number.isFinite(y0) && Number.isFinite(y1) && y1 > y0 ? (y1 - y0) : (rows.length - 1);
  if (yearSpan <= 0) return 0;
  return Math.pow(a1 / a0, 1 / yearSpan) - 1;
});

const rotationAvgDelta = computed(() => Number(derived.value?.rotation_avg_delta_deg || 0));

const orientationDrift = computed(() => {
  const a = Number(first.value?.angleDeg);
  const b = Number(latest.value?.angleDeg);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  let delta = Math.abs(b - a) % 180;
  if (delta > 90) delta = 180 - delta;
  return delta;
});

const orientationBand = computed(() => angleBand(latest.value?.angleDeg));

const trajectoryLegendItems = computed(() => {
  const pts = trajectoryPoints.value;
  if (!Array.isArray(pts) || pts.length < 2) return [];
  const rows = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const from = a?.period || `${a?.yearStart || ''}-${a?.yearEnd || ''}`;
    const to = b?.period || `${b?.yearStart || ''}-${b?.yearEnd || ''}`;
    const az = calcAzimuth(a?.lon, a?.lat, b?.lon, b?.lat);
    rows.push({
      label: `${from} → ${to}`,
      cardinal: azimuthToCardinal(az),
      color: TRAJECTORY_COLORS[i % TRAJECTORY_COLORS.length]
    });
  }
  return rows;
});

const monitorLevel = computed(() => {
  const cov = Number(derived.value?.sde_coverage || 0);
  if (cov < 0.75) return '样本不足';
  const vol = Number(areaCv.value || 0);
  const drift = Number(orientationDrift.value || 0);
  const axis = Number(latest.value?.axisRatio || 0);
  if (vol >= 0.22 || drift >= 24) return '高波动';
  if (axis >= 1.35 || vol >= 0.12 || drift >= 12) return '中波动';
  return '低波动';
});

function angleBand(angleDeg) {
  const a = Number(angleDeg);
  if (!Number.isFinite(a)) return '方向未知';
  const n = ((a % 180) + 180) % 180;
  if (n < 22.5 || n >= 157.5) return '南北向';
  if (n < 67.5) return '东北-西南';
  if (n < 112.5) return '东西向';
  return '西北-东南';
}

function calcAzimuth(lon1, lat1, lon2, lat2) {
  if (![lon1, lat1, lon2, lat2].every((v) => Number.isFinite(Number(v)))) return null;
  const dLon = Number(lon2) - Number(lon1);
  const dLat = Number(lat2) - Number(lat1);
  if (Math.abs(dLon) < 1e-10 && Math.abs(dLat) < 1e-10) return null;
  let az = Math.atan2(dLon, dLat) * 180 / Math.PI;
  if (az < 0) az += 360;
  return az;
}

function azimuthToCardinal(azimuth) {
  const az = Number(azimuth);
  if (!Number.isFinite(az)) return '—';
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const idx = Math.round(az / 45) % 8;
  return `${labels[idx]} (${az.toFixed(1)}°)`;
}

function fmtIdx(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.000';
  return n.toFixed(3);
}

function fmtKm2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  return n.toFixed(2);
}

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  return (n * 100).toFixed(2);
}

function fmtSignedPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  const p = (n * 100).toFixed(2);
  return n > 0 ? `+${p}` : p;
}

function fmtAngle(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.0';
  return n.toFixed(1);
}
</script>

<style scoped>
.panel-shell {
  width: 480px;
  height: 760px;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(148, 191, 255, 0.28);
  background: linear-gradient(145deg, rgba(9, 24, 62, 0.78), rgba(18, 42, 88, 0.62));
  backdrop-filter: blur(18px) saturate(140%);
  color: #edf4ff;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  overflow: hidden;
  max-width: 100%;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.head-mark {
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: #44d0ff;
}

.head-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.meta-item {
  border: 1px solid rgba(168, 202, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item span {
  font-size: 12px;
  color: rgba(212, 228, 255, 0.74);
}

.meta-item strong {
  font-size: 14px;
  color: #f5f9ff;
}

.kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.kpi {
  border-radius: 10px;
  border: 1px solid rgba(113, 170, 255, 0.28);
  background: rgba(9, 24, 52, 0.66);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi span {
  font-size: 12px;
  color: rgba(205, 222, 247, 0.8);
}

.kpi strong {
  font-size: 16px;
  color: #fdfefe;
  font-weight: 700;
}

.num-display {
  font-family: 'YouSheBiaoTiHei', 'Impact', 'Arial Black', sans-serif;
  font-style: italic;
  display: inline-block;
  padding-right: 8px;
  letter-spacing: 0.4px;
  background: linear-gradient(180deg, #ffffff 0%, #d1e8ff 40%, #7dbfff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0px 2px 6px rgba(125, 191, 255, 0.5));
}

.period-list {
  border: 1px solid rgba(139, 184, 255, 0.24);
  border-radius: 12px;
  background: rgba(8, 18, 44, 0.52);
  padding: 10px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.period-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(107, 152, 219, 0.72) rgba(16, 34, 68, 0.42);
}

.period-list::-webkit-scrollbar {
  width: 8px;
}

.period-list::-webkit-scrollbar-track {
  background: rgba(16, 34, 68, 0.42);
  border-radius: 8px;
}

.period-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(116, 170, 247, 0.82), rgba(82, 132, 212, 0.72));
  border-radius: 8px;
  border: 1px solid rgba(202, 225, 255, 0.22);
}

.period-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(139, 189, 255, 0.9), rgba(94, 147, 230, 0.82));
}

.list-title {
  font-size: 13px;
  color: rgba(220, 236, 255, 0.92);
  margin-bottom: 8px;
}

.list-row {
  display: grid;
  grid-template-columns: 22px 34px minmax(0, 1fr) 88px;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  max-width: 100%;
}

.list-row:first-of-type {
  border-top: none;
}

.p-order {
  color: rgba(154, 193, 250, 0.95);
  font-weight: 700;
  text-align: right;
}

.p-arrow {
  height: 0;
  border-top: 2px solid var(--legend-color);
  position: relative;
}

.p-arrow::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -4px;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 7px solid var(--legend-color);
}

.p-name {
  color: #f5f9ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.p-val {
  color: #c7dcff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  min-width: 0;
}

.list-empty {
  color: rgba(201, 219, 244, 0.68);
  font-size: 12px;
}
</style>
