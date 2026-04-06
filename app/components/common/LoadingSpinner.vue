<template>
  <div class="loading-spinner" :class="sizeClass">
    <div class="spinner" :style="spinnerStyle" />
    <p v-if="text" class="loading-text">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    color?: string
    text?: string
  }>(),
  {
    size: 'md',
    color: 'var(--accent-blue)',
  }
)

const sizeClass = computed(() => `size-${props.size}`)

const spinnerStyle = computed(() => ({
  borderTopColor: props.color,
  borderRightColor: props.color,
}))
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.spinner {
  border: 3px solid var(--border-default);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.size-sm .spinner {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.size-md .spinner {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

.size-lg .spinner {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
