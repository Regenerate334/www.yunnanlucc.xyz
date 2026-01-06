<template>
    <div class="dashboard-footer">
        <div class="footer-bar"></div>
        <div class="playback-controls">
            <button class="control-btn" @click="prevYear" title="上一年">
                <img :src="prevIcon" class="control-icon" alt="Prev" />
            </button>
            <button class="control-btn" @click="togglePlayback" :title="isPlaying ? '暂停' : '播放'">
                <img :src="isPlaying ? pauseIcon : playIcon" class="control-icon" alt="Play/Pause" />
            </button>
            <button class="control-btn" @click="nextYear" title="下一年">
                <img :src="nextIcon" class="control-icon" alt="Next" />
            </button>
            <input type="range" min="1985" max="2023" :value="year" @input="onYearChange" class="year-slider">
            <span class="year-display">{{ year }}</span>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import playIcon from '../../assets/icons/play.png';
import pauseIcon from '../../assets/icons/pause.png';
import prevIcon from '../../assets/icons/prev.png';
import nextIcon from '../../assets/icons/next.png';

const props = defineProps({
    year: { type: Number, default: 2023 }
});

const emit = defineEmits(['update:year']);

const isPlaying = ref(true);
const playbackSpeed = ref(10000); // 10 seconds per year
let playbackTimer = null;

const validYears = [1985, ...Array.from({ length: 34 }, (_, i) => 1990 + i)]; // 1985, 1990-2023

function startPlayback() {
    if (playbackTimer) return;
    isPlaying.value = true;
    playbackTimer = setInterval(() => {
        const currentIndex = validYears.indexOf(props.year);
        let nextIndex = currentIndex + 1;

        if (nextIndex >= validYears.length) {
            nextIndex = 0; // Loop back to start
        }

        emit('update:year', validYears[nextIndex]);
    }, playbackSpeed.value);
}

function pausePlayback() {
    isPlaying.value = false;
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
}

function togglePlayback() {
    if (isPlaying.value) {
        pausePlayback();
    } else {
        startPlayback();
    }
}

function nextYear() {
    pausePlayback();
    const currentIndex = validYears.indexOf(props.year);
    if (currentIndex < validYears.length - 1) {
        emit('update:year', validYears[currentIndex + 1]);
    }
}

function prevYear() {
    pausePlayback();
    const currentIndex = validYears.indexOf(props.year);
    if (currentIndex > 0) {
        emit('update:year', validYears[currentIndex - 1]);
    }
}

function onYearChange(event) {
    pausePlayback();
    let val = Number(event.target.value);
    if (!validYears.includes(val)) {
        const closest = validYears.reduce((prev, curr) => {
            return (Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
        });
        val = closest;
    }
    emit('update:year', val);
}

onMounted(() => {
    startPlayback();
});

onUnmounted(() => {
    if (playbackTimer) clearInterval(playbackTimer);
});
</script>

<style scoped>
.dashboard-footer {
    height: 40px;
    background: linear-gradient(to top, #0f172a 0%, rgba(15, 23, 42, 0) 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    pointer-events: auto;
}

.footer-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #3b82f6, transparent);
}

.playback-controls {
    display: flex;
    align-items: center;
    gap: 15px;
    background: rgba(15, 23, 42, 0.8);
    padding: 5px 20px;
    border-radius: 20px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    backdrop-filter: blur(5px);
    z-index: 10;
}

.control-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s;
}

.control-btn:hover {
    transform: scale(1.2);
}

.control-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: drop-shadow(0 0 2px rgba(59, 130, 246, 0.5));
}

.year-slider {
    width: 300px;
    accent-color: #3b82f6;
    cursor: pointer;
}

.year-display {
    font-family: 'Courier New', monospace;
    font-size: 18px;
    font-weight: bold;
    color: #fff;
    text-shadow: 0 0 10px #3b82f6;
}
</style>
