<script lang="ts" setup>
import { onMounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Point } from "geojson";
type Position = number[];
import CesiumNavigation from "cesium-navigation-es6";
import type { NavigationOptions } from "cesium-navigation-es6";

let viewer: Cesium.Viewer;
let handler: Cesium.ScreenSpaceEventHandler;
const isDrawing = ref(false);

const polygonPoints = ref<Cesium.Cartesian3[]>([]);
const startPoint = ref<Cesium.Cartesian3 | null>(null);
const flightPath = ref<Cesium.Entity | null>(null);
const polygonEntity = ref<Cesium.Entity | null>(null);
const startPointEntity = ref<Cesium.Entity | null>(null);

const spacing = ref(10);
const direction = ref(90);
onMounted(() => {
  initMap();
  initDrawingTools();
});

function initMap() {
  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjZDNhNDE3Yy1mYjkxLTQ2YzMtYTczNy1hODA4OGVlNTMxOGIiLCJpZCI6MTMyMzI5LCJpYXQiOjE3NDkxMDc3MDF9.vlEXqaZLyWOZ6_XhdkCJr0NqqoqmuOryn2IHX3CV1z4";

  viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    skyAtmosphere: false,
    shouldAnimate: true,
    terrain: Cesium.Terrain.fromWorldTerrain(),
  });

  (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const navOptions: NavigationOptions = {
      defaultResetView: Cesium.Rectangle.fromDegrees(115.0, 39.0, 117.0, 41.0),
      enableCompass: true,
      enableZoomControls: true,
      enableDistanceLegend: true,
      enableCompassOuterRing: true,
  };
  new CesiumNavigation(viewer, navOptions);
  
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.39, 39.9, 20000),
    orientation: {
      heading: Cesium.Math.toRadians(0.0),
      pitch: Cesium.Math.toRadians(-90.0),
    },
  });
}

function initDrawingTools() {
  handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  const dynamicHintPoint = viewer.entities.add({
    point: {
      pixelSize: 10,
      color: Cesium.Color.GREY.withAlpha(0.5),
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
    },
  });

  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    const cartesian = viewer.scene.pickPosition(movement.endPosition);
    if (Cesium.defined(cartesian)) {
      dynamicHintPoint.position = new Cesium.ConstantPositionProperty(cartesian);
      if (isDrawing.value && polygonPoints.value.length > 0) {
        drawPolygon([...polygonPoints.value, cartesian]);
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const cartesian = viewer.scene.pickPosition(click.position);
    if (!Cesium.defined(cartesian)) return;
    
    if (isDrawing.value) {
      polygonPoints.value.push(cartesian.clone());
      drawPolygon(polygonPoints.value);
    } 
    else if (polygonPoints.value.length > 2 && !startPoint.value) { // Only set start point if not already set
        const turfPolygon = turf.polygon([
            [...polygonPoints.value.map(p => cartesianToDegrees(p)), cartesianToDegrees(polygonPoints.value[0])]
        ]);
        const clickPoint = turf.point(cartesianToDegrees(cartesian));
        const line = turf.polygonToLine(turfPolygon);

        if(turf.booleanPointOnLine(clickPoint, line, {epsilon: 1e-4})) {
            startPoint.value = cartesian;
            drawStartPoint(cartesian);
            alert("起点设置成功。现在可以修改参数或生成航线。");
        } else {
            alert("请在多边形边界上选择一个点作为起点。");
        }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(() => {
    if (isDrawing.value) {
      if (polygonPoints.value.length < 3) return;
      isDrawing.value = false;
      drawPolygon(polygonPoints.value, true);
      alert("多边形绘制完成。现在请点击边界选择起点。");
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function startOrResetDrawing() {
  polygonPoints.value = [];
  startPoint.value = null;
  if (polygonEntity.value) viewer.entities.remove(polygonEntity.value);
  if (startPointEntity.value) viewer.entities.remove(startPointEntity.value);
  if (flightPath.value) viewer.entities.remove(flightPath.value);
  polygonEntity.value = null;
  startPointEntity.value = null;
  flightPath.value = null;

  isDrawing.value = true;
  alert("开始绘制多边形：左键添加点，右键完成。");
}

function generateSerpentinePath() {
  if (!startPoint.value || polygonPoints.value.length < 3) {
    alert("请先完成多边形绘制并选择起点。");
    return;
  }
  
  if (flightPath.value) {
    viewer.entities.remove(flightPath.value);
  }

  const polygonCoords = polygonPoints.value.map(p => cartesianToDegrees(p));
  polygonCoords.push(polygonCoords[0]);
  const turfPolygon = turf.polygon([polygonCoords]);
  const turfStartPoint = turf.point(cartesianToDegrees(startPoint.value));

  const bbox = turf.bbox(turfPolygon);
  const diagonal = turf.distance(
    turf.point([bbox[0], bbox[1]]),
    turf.point([bbox[2], bbox[3]]),
    { units: "meters" }
  );
  const sweepBearing = direction.value - 90;
  const lineBearing = direction.value;

  const pathSegments: Position[][] = [];
  const sweepStartNode = turf.centerOfMass(turfPolygon);

  for (let d = -diagonal / 2; d < diagonal / 2; d += spacing.value) {
      const lineOrigin = turf.destination(sweepStartNode, d, sweepBearing, {units: "meters"});
      const p1 = turf.destination(lineOrigin, diagonal, lineBearing, {units: "meters"});
      const p2 = turf.destination(lineOrigin, diagonal, lineBearing + 180, {units: "meters"});
      const scanLine = turf.lineString([
        p1.geometry.coordinates,
        p2.geometry.coordinates
      ]);
      const intersection = turf.lineIntersect(scanLine, turfPolygon) as FeatureCollection<Point>;
      if(intersection.features.length >= 2){
          intersection.features.sort((a,b) => turf.distance(p1,a, {units: "meters"}) - turf.distance(p1,b, {units: "meters"}));
          for(let i = 0; i < intersection.features.length; i+=2){
              if(i+1 < intersection.features.length){
                  pathSegments.push([intersection.features[i].geometry.coordinates, intersection.features[i+1].geometry.coordinates]);
              }
          }
      }
  }

  if (pathSegments.length === 0) return;
  
  const finalCoords = assemblePath({ segments: pathSegments, startPt: turfStartPoint });

  const finalPathCartesian = finalCoords.map(coords => Cesium.Cartesian3.fromDegrees(coords[0], coords[1]));

  flightPath.value = viewer.entities.add({
    polyline: {
      positions: finalPathCartesian,
      width: 5,
      material: Cesium.Color.RED, 
      clampToGround: true,
    },
  });
}

/**
 * [REVISED] Assembles a complete, continuous serpentine path with auto-return.
 * This algorithm starts at the user's point, traverses all generated flight
 * lines in a logical nearest-neighbor order, and finally returns to the start point.
 * @param {object} params - The parameters for path assembly.
 * @param {Position[][]} params.segments - An array of all generated path segments.
 * @param {Feature<Point>} params.startPt - The user-defined start/end point for the mission.
 * @returns {Position[]} A single array of coordinates for the complete flight path.
 */
function assemblePath({ segments, startPt }: { segments: Position[][]; startPt: Feature<Point>; }): Position[] {
    if (segments.length === 0) return [];

    const assembled: Position[] = [];
    let toProcess = [...segments]; // Create a mutable copy of all segments

    // 1. Start the final path precisely at the user's start point.
    assembled.push(startPt.geometry.coordinates);
    let lastPoint = startPt.geometry.coordinates;

    // 2. Loop until all segments are processed.
    while (toProcess.length > 0) {
        let nextIndex = -1;
        let minDist = Infinity;
        let reverseNext = false;

        // Find the closest point among all endpoints of all remaining segments.
        toProcess.forEach((seg, i) => {
            const d1 = turf.distance(turf.point(lastPoint), turf.point(seg[0]), { units: 'meters' });
            if (d1 < minDist) {
                minDist = d1;
                nextIndex = i;
                reverseNext = false;
            }

            const d2 = turf.distance(turf.point(lastPoint), turf.point(seg[1]), { units: 'meters' });
            if (d2 < minDist) {
                minDist = d2;
                nextIndex = i;
                reverseNext = true;
            }
        });

        // We've found the next closest segment to connect to.
        let nextSeg = toProcess.splice(nextIndex, 1)[0];

        // Orient this segment so its starting point is the one closer to our last path point.
        if (reverseNext) {
            nextSeg.reverse();
        }

        // Add the points for the turn and the new segment.
        assembled.push(nextSeg[0]);
        assembled.push(nextSeg[1]);

        // Update the last point for the next iteration.
        lastPoint = nextSeg[1];
    }

    // 3. Finally, add the return-to-home leg.
    assembled.push(startPt.geometry.coordinates);

    return assembled;
}

function drawPolygon(positions: Cesium.Cartesian3[], isFinal = false) {
  if (polygonEntity.value) {
    viewer.entities.remove(polygonEntity.value);
  }
  const entityOptions: Cesium.Entity.ConstructorOptions = {
    polyline: {
      positions: [...positions, ...(positions.length > 2 ? [positions[0]] : [])],
      width: 3,
      material: isFinal ? Cesium.Color.YELLOW : Cesium.Color.YELLOW.withAlpha(0.5),
      clampToGround: true,
    },
  };
  if (positions.length > 2) {
    entityOptions.polygon = {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      material: Cesium.Color.GOLD.withAlpha(0.2),
    };
  }
  polygonEntity.value = viewer.entities.add(entityOptions);
}

function drawStartPoint(position: Cesium.Cartesian3) {
    if (startPointEntity.value) {
        viewer.entities.remove(startPointEntity.value);
    }
    startPointEntity.value = viewer.entities.add({
        position: position,
        point: {
            pixelSize: 12,
            color: Cesium.Color.LIME, 
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
    });
}

function cartesianToDegrees(cartesian: Cesium.Cartesian3): Position {
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const lon = Cesium.Math.toDegrees(cartographic.longitude);
  const lat = Cesium.Math.toDegrees(cartographic.latitude);
  return [lon, lat];
}

// Watch for changes in parameters to regenerate the path automatically.
// The crash-on-type bug is fixed by adding a guard clause.
watch([spacing, direction], () => {
    if (startPoint.value && typeof spacing.value === 'number' && spacing.value > 0) {
        generateSerpentinePath();
    }
});
</script>

<template>
  <div class="main-container">
    <div id="cesiumContainer" class="map-container"></div>
    <div class="control-panel">
      <h3>航线规划器</h3>
      <div class="card">
        <p class="instructions">
          1. 点击"开始绘制"并在地图上左键添加点，右键完成多边形。
          <br />
          2. 在多边形边界上点击选择航线<b>起点</b>，飞完后将自动返航。
        </p>
        <button @click="startOrResetDrawing" class="btn-primary">
          {{ polygonPoints.length > 0 ? "重新绘制" : "开始绘制" }}
        </button>
      </div>

      <div class="card" :class="{ disabled: !startPoint }">
        <h4>参数设置</h4>
        <div class="form-group">
          <label for="spacing">航线间隔 (米)</label>
          <!-- The input step is now 1 meter. The v-model.number is safe to use 
               with the guard clause in the watcher. -->
          <input id="spacing" type="number" v-model.number="spacing" min="1" step="1" :disabled="!startPoint" />
        </div>
        <div class="form-group">
          <label for="direction">航向 ({{ direction }}°)</label>
          <input id="direction" type="range" v-model.number="direction" min="0" max="180" :disabled="!startPoint" />
        </div>
      </div>
      
      <div class="card">
       <button @click="generateSerpentinePath" :disabled="!startPoint" class="btn-generate">
         生成航线
       </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.main-container {
  display: flex;
  height: 100vh;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #f0f2f5;
}

.map-container {
  flex-grow: 1;
  height: 100%;
}

.control-panel {
  width: 320px;
  padding: 20px;
  background-color: #ffffff;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  overflow-y: auto;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

h3 {
  margin: 0 0 16px 0;
  font-size: 20px;
  color: #333;
  text-align: center;
}

.card {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  transition: opacity 0.3s ease;
}

.card.disabled {
    opacity: 0.5;
    pointer-events: none;
}

.instructions {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 12px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #555;
  margin-bottom: 6px;
}

input[type="number"],
input[type="range"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

input[type="range"] {
    padding: 0;
}

button {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

button:active {
    transform: scale(0.98);
}

.btn-primary {
  background-color: #007bff;
  color: white;
}
.btn-primary:hover {
  background-color: #0056b3;
}

.btn-generate {
    background-color: #28a745;
    color: white;
}
.btn-generate:hover {
    background-color: #218838;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
</style>
