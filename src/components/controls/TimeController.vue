<template>
  <div class="tc">
    <div class="label">年份</div>
    <div class="row">
      <button @click="step(-1)">-1</button>
      <button @click="togglePlay">{{ playing ? '暂停' : '播放' }}</button>
      <button @click="step(1)">+1</button>
      <label class="checkbox-label"><input type="checkbox" v-model="isRange" /> 区间模式</label>
    </div>
    <div v-if="!isRange" class="row">
      <input type="range" :min="years[0]" :max="years[years.length - 1]" v-model.number="year" @input="onYear" />
      <span>{{ year }}</span>
    </div>
    <div v-else class="row">
      <input type="range" :min="years[0]" :max="years[years.length - 1]" v-model.number="start" @input="onRange" />
      <input type="range" :min="years[0]" :max="years[years.length - 1]" v-model.number="end" @input="onRange" />
      <span>{{ start }} - {{ end }}</span>
    </div>
    <div class="row presets">
      <button @click="preset(5)">近5年</button>
      <button @click="preset(10)">近10年</button>
      <button @click="presetAll">全时段</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useGlobalStore } from '../../stores/index.ts';

const store = useGlobalStore();
const years = computed(() => store.yearsAll);

const isRange = ref(store.timeMode === 'range');
const year = ref(store.currentYear);
const start = ref(store.range[0]);
const end = ref(store.range[1]);
const playing = ref(false);
let timer = null;

function onYear() { store.timeMode = 'single'; store.setYear(year.value); }
function onRange() {
  store.timeMode = 'range';
  if (start.value > end.value) { const t = start.value; start.value = end.value; end.value = t; }
  store.setRange([start.value, end.value]);
}
function step(delta) {
  if (isRange.value) { start.value += delta; end.value += delta; onRange(); }
  else { year.value += delta; onYear(); }
}
function togglePlay() {
  playing.value = !playing.value;
  if (playing.value) {
    timer = setInterval(() => {
      const maxY = years.value[years.value.length - 1];
      if (year.value >= maxY) { year.value = years.value[0]; } else { year.value++; }
      onYear();
    }, 1000);
  } else { clearInterval(timer); timer = null; }
}
function preset(n) {
  const ys = years.value; const maxY = ys[ys.length - 1]; const minY = Math.max(ys[0], maxY - n + 1);
  isRange.value = true; start.value = minY; end.value = maxY; onRange();
}
function presetAll() { isRange.value = true; start.value = years.value[0]; end.value = years.value[years.value.length - 1]; onRange(); }

onMounted(() => { /* sync from store if needed */ });
onBeforeUnmount(() => { if (timer) clearInterval(timer); })
</script>

<style scoped>
.tc {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(13, 25, 48, 0.4);
  backdrop-filter: blur(16px);
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.label {
  font-weight: 600;
  color: #a5ccff;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

button {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 13px;
}

button:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #a5ccff;
}

.checkbox-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

input[type="range"] {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  appearance: none;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  transition: all 0.2s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  background: #60a5fa;
}

span {
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  min-width: 40px;
  text-align: center;
}

.presets button {
  font-size: 11px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.03);
}
</style>
