<template>
  <div class="panel-shell">
    <div class="panel-head">
      <span class="head-mark"></span>
      <div class="head-title">重心轨迹监测</div>
    </div>

    <div class="step-list">
      <div class="step-title">关键迁移段（按距离）</div>
      <div v-if="topSteps.length === 0" class="step-empty">暂无可用迁移段</div>
      <div v-for="(item, idx) in topSteps" :key="`${item.from}-${item.to}-${idx}`" class="step-row">
        <span class="s-no">{{ idx + 1 }}</span>
        <span class="s-period">{{ item.from }} → {{ item.to }}</span>
        <span class="s-dir">{{ item.cardinal }}</span>
        <span class="s-dist num-display">{{ fmtKm(item.distanceKm) }} km</span>
        <span class="s-area">{{ item.regionPath }}</span>
      </div>
    </div>

    <div class="route-list">
      <div class="route-title">全周期地区路径（跨地区）</div>
      <div v-if="crossRegionSteps.length === 0" class="route-empty">暂无跨地区迁移</div>
      <div v-for="(item, idx) in crossRegionSteps" :key="`all-${item.from}-${item.to}-${idx}`" class="route-row">
        <span class="r-no">{{ idx + 1 }}</span>
        <span class="r-period">{{ item.from }} → {{ item.to }}</span>
        <span class="r-path">{{ item.regionPath }}</span>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><span>累计迁移</span><strong class="num-display">{{ fmtKm(derived.center_total_migration_km) }} km</strong></div>
      <div class="kpi"><span>平均步长</span><strong class="num-display">{{ fmtKm(derived.center_avg_step_km) }} km</strong></div>
      <div class="kpi"><span>最大步长</span><strong class="num-display">{{ fmtKm(derived.center_max_step_km) }} km</strong></div>
      <div class="kpi"><span>主迁移方向</span><strong>{{ directionCardinal }}</strong></div>
    </div>

    <div class="snapshot">
      <div class="snap-head">
        <span>轨迹局部放大</span>
        <small>自动聚焦重心迁移范围</small>
      </div>
      <div class="snap-body">
        <svg v-if="scaledPoints.length >= 2" viewBox="0 0 360 210" class="snap-svg" aria-label="重心迁移快照">
          <defs>
            <marker id="snapArrow" markerWidth="5.2" markerHeight="5.2" refX="4.8" refY="2.6" orient="auto">
              <path d="M0,0 L0,5.2 L4.8,2.6 z" fill="context-stroke" />
            </marker>
          </defs>
          <rect x="0" y="0" width="360" height="210" rx="10" ry="10" class="snap-bg" />
          <g v-if="boundaryPaths.length > 0" class="snap-boundary">
            <polyline
              v-for="(line, idx) in boundaryPaths"
              :key="`boundary-${idx}`"
              :points="line"
              class="snap-boundary-line"
            />
          </g>
          <g v-if="labelPoints.length > 0" class="snap-place-labels">
            <text
              v-for="(label, idx) in labelPoints"
              :key="`lbl-${idx}-${label.name}`"
              :x="label.x"
              :y="label.y"
              class="snap-place-label"
            >{{ label.name }}</text>
          </g>
          <polyline :points="snapPathLine" class="snap-path-underlay" />
          <g class="snap-segments">
            <line
              v-for="(seg, idx) in segmentLines"
              :key="`seg-${idx}`"
              :x1="seg.x1"
              :y1="seg.y1"
              :x2="seg.x2"
              :y2="seg.y2"
              class="snap-seg-line"
              :marker-end="seg.withArrow ? 'url(#snapArrow)' : null"
              :style="{ stroke: seg.color }"
            />
          </g>
          <g v-for="(p, idx) in scaledPoints" :key="`${p.x}-${p.y}-${idx}`">
            <circle
              :cx="p.x"
              :cy="p.y"
              :r="idx === 0 || idx === scaledPoints.length - 1 ? 4.6 : 3.6"
              class="snap-dot"
              :style="{ stroke: pointColor(idx) }"
            />
          </g>
          <text :x="scaledPoints[0].x + 5" :y="scaledPoints[0].y - 6" class="snap-end-label">起</text>
          <text :x="scaledPoints[scaledPoints.length - 1].x + 5" :y="scaledPoints[scaledPoints.length - 1].y - 6" class="snap-end-label">止</text>
        </svg>
        <div v-else class="snap-empty">暂无轨迹快照</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useGlobalStore } from '../../stores/global';

const globalStore = useGlobalStore();

defineProps({
  year: { type: Number, default: 2023 }
});
defineEmits(['update:year']);

const ctx = computed(() => globalStore.themeContext?.spatial_stats || null);
const derived = computed(() => ctx.value?.derived_metrics || {});
const trajectoryPoints = computed(() => Array.isArray(ctx.value?.trajectory_points) ? ctx.value.trajectory_points : []);
const countyGeoJson = ref(null);

const SNAP_WIDTH = 360;
const SNAP_HEIGHT = 210;
const SNAP_PAD = 4;
const SNAP_EXTEND_RATIO = 0.06;
const SNAP_COLORS = ['#e34f4f', '#e68539', '#d067bb', '#5d8ed0', '#66b873', '#9774d2', '#c9b63c'];

const directionCardinal = computed(() => azimuthToCardinal(derived.value?.center_move_azimuth_deg));

const countyAreas = computed(() => {
  const features = countyGeoJson.value?.features;
  if (!Array.isArray(features) || features.length === 0) return [];
  const rows = [];
  for (const feature of features) {
    const name = getCountyName(feature?.properties);
    const polygons = extractCountyPolygons(feature?.geometry);
    if (!name || polygons.length === 0) continue;
    const centroid = ringCentroid(polygons[0]?.outer || []);
    rows.push({
      name,
      polygons,
      centroid
    });
  }
  return rows;
});

const trajectoryRegionPoints = computed(() => {
  const pts = trajectoryPoints.value;
  if (!Array.isArray(pts) || pts.length === 0) return [];
  const areas = countyAreas.value;
  return pts.map((p) => {
    const lon = Number(p?.lon);
    const lat = Number(p?.lat);
    const direct = String(
      p?.countyName ?? p?.county ?? p?.regionName ?? p?.region ?? p?.district ?? ''
    ).trim();
    if (direct) {
      return { ...p, regionName: direct };
    }
    const regionName = Number.isFinite(lon) && Number.isFinite(lat)
      ? findCountyByPoint(lon, lat, areas)
      : '';
    return { ...p, regionName: regionName || '未知区域' };
  });
});

const stepSegments = computed(() => {
  const pts = trajectoryRegionPoints.value;
  if (pts.length < 2) return [];
  const segments = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const d = calcDistanceKm(a.lon, a.lat, b.lon, b.lat);
    const az = calcAzimuth(a.lon, a.lat, b.lon, b.lat);
    segments.push({
      from: a.period || `${a.yearStart || ''}-${a.yearEnd || ''}`,
      to: b.period || `${b.yearStart || ''}-${b.yearEnd || ''}`,
      fromRegion: String(a.regionName || '未知区域'),
      toRegion: String(b.regionName || '未知区域'),
      regionPath: `${String(a.regionName || '未知区域')} → ${String(b.regionName || '未知区域')}`,
      distanceKm: d,
      azimuth: az,
      cardinal: azimuthToCardinal(az)
    });
  }
  return segments;
});

const topSteps = computed(() => {
  return stepSegments.value
    .slice()
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, 4);
});

const crossRegionSteps = computed(() => {
  return stepSegments.value.filter((s) => String(s.fromRegion || '') !== String(s.toRegion || ''));
});

const validTrajectoryPoints = computed(() => {
  return trajectoryPoints.value
    .map((p) => ({ lon: Number(p?.lon), lat: Number(p?.lat) }))
    .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat));
});

const snapshotBounds = computed(() => {
  const pts = validTrajectoryPoints.value;
  if (pts.length < 2) return null;

  let sumLat = 0;
  pts.forEach((p) => { sumLat += p.lat; });
  const refLat = sumLat / pts.length;
  const cosLat = Math.max(Math.cos((refLat * Math.PI) / 180), 1e-6);

  let minX = Infinity;
  let maxX = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  pts.forEach((p) => {
    const x = p.lon * cosLat;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  });

  const rawXSpan = Math.max(maxX - minX, 1e-6);
  const rawLatSpan = Math.max(maxLat - minLat, 1e-6);
  let xSpan = rawXSpan * (1 + SNAP_EXTEND_RATIO * 2);
  let latSpan = rawLatSpan * (1 + SNAP_EXTEND_RATIO * 2);
  const drawW = SNAP_WIDTH - SNAP_PAD * 2;
  const drawH = SNAP_HEIGHT - SNAP_PAD * 2;
  const targetAspect = drawW / drawH;
  const spanAspect = xSpan / latSpan;
  if (spanAspect > targetAspect) {
    latSpan = xSpan / targetAspect;
  } else {
    xSpan = latSpan * targetAspect;
  }

  const centerX = (minX + maxX) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const minProjectedX = centerX - xSpan / 2;
  const maxProjectedX = centerX + xSpan / 2;
  const minProjectedLat = centerLat - latSpan / 2;
  const maxProjectedLat = centerLat + latSpan / 2;

  const minLon = minProjectedX / cosLat;
  const maxLon = maxProjectedX / cosLat;

  return {
    minLon,
    maxLon,
    minLat: minProjectedLat,
    maxLat: maxProjectedLat,
    minProjectedX,
    maxProjectedX,
    cosLat
  };
});

const scaledPoints = computed(() => {
  const pts = validTrajectoryPoints.value;
  const bounds = snapshotBounds.value;
  if (pts.length < 2 || !bounds) return [];

  return pts.map((p) => ({
    x: projectLonToSnapX(p.lon, bounds),
    y: projectLatToSnapY(p.lat, bounds)
  }));
});

const boundaryPaths = computed(() => {
  const bounds = snapshotBounds.value;
  const features = countyGeoJson.value?.features;
  if (!bounds || !Array.isArray(features) || features.length === 0) return [];

  const lines = [];
  for (const feature of features) {
    const rings = extractCountyRings(feature?.geometry);
    for (const ring of rings) {
      if (!ringIntersectsBounds(ring, bounds)) continue;
      const points = ring
        .map((coord) => {
          const lon = Number(coord?.[0]);
          const lat = Number(coord?.[1]);
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
          const x = projectLonToSnapX(lon, bounds);
          const y = projectLatToSnapY(lat, bounds);
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .filter(Boolean);
      if (points.length >= 3) lines.push(points.join(' '));
      if (lines.length >= 120) return lines;
    }
  }
  return lines;
});

const segmentLines = computed(() => {
  const pts = scaledPoints.value;
  if (pts.length < 2) return [];
  const lines = [];
  const arrowThresholdPx = 16;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const lengthPx = Math.hypot(b.x - a.x, b.y - a.y);
    lines.push({
      x1: a.x.toFixed(2),
      y1: a.y.toFixed(2),
      x2: b.x.toFixed(2),
      y2: b.y.toFixed(2),
      color: SNAP_COLORS[i % SNAP_COLORS.length],
      withArrow: lengthPx >= arrowThresholdPx
    });
  }
  return lines;
});

const snapPathLine = computed(() => {
  const pts = scaledPoints.value;
  if (pts.length < 2) return '';
  return pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
});

const labelPoints = computed(() => {
  const bounds = snapshotBounds.value;
  const features = countyGeoJson.value?.features;
  if (!bounds || !Array.isArray(features) || features.length === 0) return [];

  const candidates = [];
  for (const feature of features) {
    const name = getCountyName(feature?.properties);
    if (!name) continue;
    const rings = extractCountyRings(feature?.geometry);
    if (rings.length === 0) continue;
    const ring = rings[0];
    if (!ringIntersectsBounds(ring, bounds)) continue;
    const center = ringCentroid(ring);
    if (!center) continue;
    const x = projectLonToSnapX(center.lon, bounds);
    const y = projectLatToSnapY(center.lat, bounds);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 14 || x > SNAP_WIDTH - 14 || y < 16 || y > SNAP_HEIGHT - 10) continue;
    const box = ringBBox(ring);
    const weight = box ? (box.maxLon - box.minLon) * (box.maxLat - box.minLat) : 0;
    candidates.push({ name, x, y, weight });
  }

  candidates.sort((a, b) => b.weight - a.weight);
  const selected = [];
  for (const item of candidates) {
    const overlap = selected.some((s) => Math.hypot(s.x - item.x, s.y - item.y) < 34);
    if (overlap) continue;
    selected.push(item);
    if (selected.length >= 8) break;
  }
  return selected;
});

onMounted(async () => {
  try {
    const resp = await fetch('/data/yunnan_all_counties.geojson', { cache: 'force-cache' });
    if (!resp.ok) return;
    const gj = await resp.json();
    if (gj && Array.isArray(gj.features)) {
      countyGeoJson.value = gj;
    }
  } catch {
    countyGeoJson.value = null;
  }
});

function calcDistanceKm(lon1, lat1, lon2, lat2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
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

function fmtKm(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00';
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function projectLonToSnapX(lon, bounds) {
  const projectedX = lon * bounds.cosLat;
  const span = Math.max(bounds.maxProjectedX - bounds.minProjectedX, 1e-6);
  const drawW = SNAP_WIDTH - SNAP_PAD * 2;
  return SNAP_PAD + ((projectedX - bounds.minProjectedX) / span) * drawW;
}

function projectLatToSnapY(lat, bounds) {
  const span = Math.max(bounds.maxLat - bounds.minLat, 1e-6);
  const drawH = SNAP_HEIGHT - SNAP_PAD * 2;
  return SNAP_HEIGHT - SNAP_PAD - ((lat - bounds.minLat) / span) * drawH;
}

function extractCountyRings(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return Array.isArray(ring) ? [ring] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => (Array.isArray(polygon) ? polygon[0] : null))
      .filter((ring) => Array.isArray(ring));
  }
  return [];
}

function extractCountyPolygons(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates[0])) return [];
    return [{
      outer: geometry.coordinates[0],
      holes: Array.isArray(geometry.coordinates.slice(1)) ? geometry.coordinates.slice(1) : []
    }];
  }
  if (geometry.type === 'MultiPolygon') {
    const rows = [];
    for (const polygon of geometry.coordinates) {
      if (!Array.isArray(polygon) || !Array.isArray(polygon[0])) continue;
      rows.push({
        outer: polygon[0],
        holes: Array.isArray(polygon.slice(1)) ? polygon.slice(1) : []
      });
    }
    return rows;
  }
  return [];
}

function ringIntersectsBounds(ring, bounds) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const coord of ring) {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return false;
  return !(maxLon < bounds.minLon || minLon > bounds.maxLon || maxLat < bounds.minLat || minLat > bounds.maxLat);
}

function pointColor(idx) {
  return SNAP_COLORS[idx % SNAP_COLORS.length];
}

function getCountyName(props) {
  if (!props || typeof props !== 'object') return '';
  return String(
    props.NAME ?? props.name ?? props.县 ?? props.县名 ?? props.区县 ?? props.市县 ?? props.NAME_CHN ?? ''
  ).trim();
}

function ringCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let sumLon = 0;
  let sumLat = 0;
  let count = 0;
  for (const coord of ring) {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    sumLon += lon;
    sumLat += lat;
    count += 1;
  }
  if (!count) return null;
  return { lon: sumLon / count, lat: sumLat / count };
}

function ringBBox(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return null;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const coord of ring) {
    const lon = Number(coord?.[0]);
    const lat = Number(coord?.[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return null;
  return { minLon, maxLon, minLat, maxLat };
}

function findCountyByPoint(lon, lat, areas) {
  if (!Array.isArray(areas) || areas.length === 0) return '';
  for (const area of areas) {
    if (!Array.isArray(area.polygons)) continue;
    for (const polygon of area.polygons) {
      if (pointInPolygon(lon, lat, polygon)) return area.name;
    }
  }
  let nearest = '';
  let nearestD = Infinity;
  for (const area of areas) {
    const c = area.centroid;
    if (!c || !Number.isFinite(c.lon) || !Number.isFinite(c.lat)) continue;
    const d = (c.lon - lon) * (c.lon - lon) + (c.lat - lat) * (c.lat - lat);
    if (d < nearestD) {
      nearestD = d;
      nearest = area.name;
    }
  }
  return nearest;
}

function pointInPolygon(lon, lat, polygon) {
  if (!polygon || !Array.isArray(polygon.outer)) return false;
  if (!pointInRing(lon, lat, polygon.outer)) return false;
  if (Array.isArray(polygon.holes)) {
    for (const hole of polygon.holes) {
      if (pointInRing(lon, lat, hole)) return false;
    }
  }
  return true;
}

function pointInRing(lon, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
</script>

<style scoped>
.panel-shell {
  width: 480px;
  height: 820px;
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
  min-height: 0;
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
  background: #ffb345;
}

.head-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 1px;
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
  font-size: 17px;
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

.step-list {
  border: 1px solid rgba(139, 184, 255, 0.24);
  border-radius: 12px;
  background: rgba(8, 18, 44, 0.52);
  padding: 10px;
  max-height: 160px;
  overflow-y: auto;
  min-height: 0;
}

.step-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(107, 152, 219, 0.72) rgba(16, 34, 68, 0.42);
}

.step-list::-webkit-scrollbar {
  width: 8px;
}

.step-list::-webkit-scrollbar-track {
  background: rgba(16, 34, 68, 0.42);
  border-radius: 8px;
}

.step-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(116, 170, 247, 0.82), rgba(82, 132, 212, 0.72));
  border-radius: 8px;
  border: 1px solid rgba(202, 225, 255, 0.22);
}

.step-list::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(139, 189, 255, 0.9), rgba(94, 147, 230, 0.82));
}

.step-title {
  font-size: 13px;
  color: rgba(220, 236, 255, 0.92);
  margin-bottom: 8px;
}

.step-row {
  display: grid;
  grid-template-columns: 20px 1fr auto auto;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  padding: 6px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.step-row:first-of-type {
  border-top: none;
}

.s-no {
  color: #8dbfff;
}

.s-period {
  color: #f3f8ff;
}

.s-dir {
  color: #ffd388;
}

.s-dist {
  color: #79f0d2;
  font-weight: 700;
}

.s-area {
  grid-column: 2 / 5;
  color: rgba(211, 228, 250, 0.88);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.route-list {
  border: 1px solid rgba(139, 184, 255, 0.24);
  border-radius: 12px;
  background: rgba(8, 18, 44, 0.52);
  padding: 10px;
  max-height: 120px;
  overflow-y: auto;
  min-height: 0;
}

.route-title {
  font-size: 12px;
  color: rgba(214, 233, 255, 0.9);
  margin-bottom: 6px;
}

.route-row {
  display: grid;
  grid-template-columns: 20px 1fr 1fr;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  padding: 4px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.route-row:first-of-type {
  border-top: none;
}

.r-no {
  color: #8dbfff;
}

.r-period {
  color: rgba(230, 241, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.r-path {
  color: rgba(189, 240, 223, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.route-empty {
  color: rgba(201, 219, 244, 0.68);
  font-size: 12px;
}

.route-list {
  scrollbar-width: thin;
  scrollbar-color: rgba(107, 152, 219, 0.72) rgba(16, 34, 68, 0.42);
}

.route-list::-webkit-scrollbar {
  width: 8px;
}

.route-list::-webkit-scrollbar-track {
  background: rgba(16, 34, 68, 0.42);
  border-radius: 8px;
}

.route-list::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(116, 170, 247, 0.82), rgba(82, 132, 212, 0.72));
  border-radius: 8px;
  border: 1px solid rgba(202, 225, 255, 0.22);
}

.step-empty {
  color: rgba(201, 219, 244, 0.68);
  font-size: 12px;
}

.snapshot {
  margin-top: 0;
  flex-shrink: 0;
  border: 1px solid rgba(133, 180, 255, 0.25);
  border-radius: 12px;
  background: transparent;
  padding: 2px;
  overflow: hidden;
}

.snap-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}

.snap-head span {
  font-size: 13px;
  color: #eaf3ff;
  font-weight: 600;
}

.snap-head small {
  font-size: 11px;
  color: rgba(198, 216, 244, 0.72);
}

.snap-body {
  height: 230px;
  max-height: 230px;
  border-radius: 10px;
  border: 1px solid rgba(181, 191, 208, 0.28);
  background: transparent;
  overflow: hidden;
}

.snap-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.snap-bg {
  fill: #e6e6e6;
  stroke: none;
}

.snap-boundary-line {
  fill: none;
  stroke: rgba(56, 56, 56, 0.84);
  stroke-width: 1.15;
  vector-effect: non-scaling-stroke;
}

.snap-dot {
  fill: #f2f4f7;
  stroke-width: 1.9;
}

.snap-seg-line {
  fill: none;
  stroke-width: 2;
  stroke-opacity: 0.92;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.snap-path-underlay {
  fill: none;
  stroke: rgba(70, 82, 96, 0.5);
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.snap-label {
  font-size: 12px;
  fill: #2f2f2f;
  font-weight: 700;
}

.snap-boundary {
  opacity: 0.95;
}

.snap-place-label {
  fill: rgba(44, 44, 44, 0.78);
  font-size: 9px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
}

.snap-end-label {
  fill: rgba(40, 40, 40, 0.86);
  font-size: 10px;
  font-weight: 700;
  stroke: rgba(255, 255, 255, 0.75);
  stroke-width: 0.9;
  paint-order: stroke fill;
}

.snap-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: rgba(204, 220, 242, 0.72);
}
</style>
