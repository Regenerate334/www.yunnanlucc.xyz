<template>
  <div class="chart-widget" :class="{ compact: compact }">
    <div class="widget-header">
      <h4 class="widget-title">{{ title }}</h4>
      <div class="widget-actions" v-if="showActions">
        <button 
          v-if="maximizable" 
          @click="$emit('maximize')" 
          class="action-btn"
          title="最大化"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
          </svg>
        </button>
        <button 
          v-if="closable" 
          @click="$emit('close')" 
          class="action-btn"
          title="关闭"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="widget-content" :style="{ height: contentHeight }">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  maximizable: {
    type: Boolean,
    default: false
  },
  closable: {
    type: Boolean,
    default: false
  },
  showActions: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: null
  }
})

defineEmits(['maximize', 'close'])

const contentHeight = computed(() => {
  if (props.height) return props.height
  return props.compact ? '280px' : '400px'
})
</script>

<style scoped>
.chart-widget {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
}

.chart-widget:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.chart-widget.compact {
  margin-bottom: 0;
}

.widget-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.widget-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.widget-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.action-btn svg {
  width: 16px;
  height: 16px;
  color: white;
}

.widget-content {
  padding: 12px;
  overflow: hidden;
}
</style>
