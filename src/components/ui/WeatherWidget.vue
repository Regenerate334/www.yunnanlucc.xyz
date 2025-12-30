<template>
  <div class="weather-widget" :class="{ loading: isLoading, error: hasError }">
    <div class="weather-icon">{{ weatherInfo.icon }}</div>
    <div class="weather-details">
      <div class="temp">{{ weatherInfo.temp }}°C</div>
      <div class="desc">{{ weatherInfo.text }} | {{ weatherInfo.city }}</div>
      <div class="extra" v-if="weatherInfo.humidity">
        {{ weatherInfo.winddirection }}风 {{ weatherInfo.windpower }}级 · 湿度 {{ weatherInfo.humidity }}%
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const isLoading = ref(true);
const hasError = ref(false);

const weatherInfo = ref({
  temp: '--',
  text: '加载中...',
  icon: '🌡️',
  city: '云南',
  winddirection: '',
  windpower: '',
  humidity: ''
});

let refreshTimer = null;

// 使用昆明作为云南省的代表数据
const KUNMING_ADCODE = '530100';

async function fetchWeather() {
  try {
    isLoading.value = true;
    hasError.value = false;

    const response = await fetch(`/api/weather?city=${KUNMING_ADCODE}`);
    const data = await response.json();

    if (data.lives && data.lives.length > 0) {
      const live = data.lives[0];
      weatherInfo.value = {
        temp: live.temperature,
        text: live.weather,
        icon: live.icon || getWeatherIcon(live.weather),
        city: '云南', // 固定显示为云南
        winddirection: live.winddirection,
        windpower: live.windpower,
        humidity: live.humidity
      };
    }
  } catch (err) {
    console.error('[天气] 请求失败:', err);
    hasError.value = true;
  } finally {
    isLoading.value = false;
  }
}

// 备用图标映射
function getWeatherIcon(weather) {
  const iconMap = {
    '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌧️', '中雨': '🌧️', '大雨': '🌧️',
    '暴雨': '⛈️', '雷阵雨': '⛈️', '雪': '❄️', '小雪': '🌨️', '中雪': '🌨️', '大雪': '❄️',
    '雾': '🌫️', '霾': '😷'
  };
  return iconMap[weather] || '🌡️';
}

onMounted(() => {
  fetchWeather();
  // 每 30 分钟同步一次数据
  refreshTimer = setInterval(fetchWeather, 30 * 60 * 1000);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<style scoped>
.weather-widget {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 15px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a5ccff;
  transition: all 0.3s ease;
}

.weather-widget.loading {
  opacity: 0.7;
}

.weather-widget.error {
  border-color: rgba(239, 68, 68, 0.3);
}

.weather-icon {
  font-size: 28px;
  line-height: 1;
}

.weather-details {
  display: flex;
  flex-direction: column;
}

.temp {
  font-size: 18px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  line-height: 1;
}

.desc {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.extra {
  font-size: 9px;
  color: #64748b;
  margin-top: 2px;
}
</style>
