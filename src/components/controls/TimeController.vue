<template>
  <div class="tc">
    <div class="label">年份</div>
    <div class="row">
      <button @click="step(-1)">-1</button>
      <button @click="togglePlay">{{ playing ? '暂停' : '播放' }}</button>
      <button @click="step(1)">+1</button>
      <label><input type="checkbox" v-model="isRange" /> 区间模式</label>
    </div>
    <div v-if="!isRange" class="row">
      <input type="range" :min="years[0]" :max="years[years.length-1]" v-model.number="year" @input="onYear" />
      <span>{{ year }}</span>
    </div>
    <div v-else class="row">
      <input type="range" :min="years[0]" :max="years[years.length-1]" v-model.number="start" @input="onRange" />
      <input type="range" :min="years[0]" :max="years[years.length-1]" v-model.number="end" @input="onRange" />
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
import { useGlobalStore } from '../../store/index.js';

const store = useGlobalStore();
const years = computed(() => store.yearsAll);

const isRange = ref(store.timeMode === 'range');
const year = ref(store.currentYear);
const start = ref(store.range[0]);
const end = ref(store.range[1]);
const playing = ref(false);
let timer = null;

function onYear(){ store.timeMode='single'; store.setYear(year.value); }
function onRange(){
  store.timeMode='range';
  if(start.value > end.value){ const t = start.value; start.value = end.value; end.value = t; }
  store.setRange([start.value, end.value]);
}
function step(delta){
  if(isRange.value){ start.value += delta; end.value += delta; onRange(); }
  else { year.value += delta; onYear(); }
}
function togglePlay(){
  playing.value = !playing.value;
  if(playing.value){
    timer = setInterval(()=>{
      const maxY = years.value[years.value.length-1];
      if(year.value >= maxY){ year.value = years.value[0]; } else { year.value++; }
      onYear();
    }, 1000);
  } else { clearInterval(timer); timer = null; }
}
function preset(n){
  const ys = years.value; const maxY = ys[ys.length-1]; const minY = Math.max(ys[0], maxY - n + 1);
  isRange.value = true; start.value = minY; end.value = maxY; onRange();
}
function presetAll(){ isRange.value = true; start.value = years.value[0]; end.value = years.value[years.value.length-1]; onRange(); }

onMounted(()=>{ /* sync from store if needed */ });
onBeforeUnmount(()=>{ if(timer) clearInterval(timer); })
</script>

<style scoped>
.tc { display:flex; flex-direction:column; gap:6px; background:#f7f9fc; padding:8px; border:1px solid #e5e9f0; border-radius:6px; }
.row { display:flex; align-items:center; gap:6px; }
.label { font-weight:600; color:#334155; }
.presets button { font-size:12px; }
</style>


