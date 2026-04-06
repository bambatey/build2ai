<template>
  <div class="stat-card card" :style="{ borderLeftColor: accentColor }">
    <div class="stat-header flex items-start justify-between mb-3">
      <div class="stat-icon" :style="{ backgroundColor: `${accentColor}20` }">
        <Icon :name="icon" class="w-5 h-5" :style="{ color: accentColor }" />
      </div>
      <div v-if="trend" class="stat-trend" :class="trend > 0 ? 'trend-up' : 'trend-down'">
        <Icon :name="trend > 0 ? 'lucide:trending-up' : 'lucide:trending-down'" class="w-3 h-3" />
        <span class="text-xs">{{ Math.abs(trend) }}%</span>
      </div>
    </div>

    <div class="stat-content">
      <p class="stat-label text-sm text-secondary mb-1">{{ label }}</p>
      <p class="stat-value font-['JetBrains_Mono'] text-3xl font-bold text-primary count-up">
        {{ formattedValue }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: number | string
  icon: string
  accentColor: string
  trend?: number
  suffix?: string
}>()

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString('tr-TR') + (props.suffix || '')
  }
  return props.value
})
</script>

<style scoped>
.stat-card {
  border-left-width: 3px;
  border-left-style: solid;
  position: relative;
  overflow: hidden;
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.trend-up {
  background-color: var(--accent-green);
  color: var(--bg-primary);
}

.trend-down {
  background-color: var(--accent-red);
  color: white;
}

.stat-value {
  letter-spacing: -0.02em;
}
</style>
