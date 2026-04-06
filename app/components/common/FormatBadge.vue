<template>
  <span class="format-badge" :class="`badge-${variant}`">
    <span class="format-icon">{{ icon }}</span>
    <span class="format-text">{{ format }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  format: string
  showIcon?: boolean
}>()

const formatInfo = computed(() => {
  const formats: Record<string, { icon: string; variant: string; name: string }> = {
    '.s2k': { icon: '📐', variant: 'blue', name: 'SAP2000' },
    '.e2k': { icon: '🏢', variant: 'purple', name: 'ETABS' },
    '.r3d': { icon: '🌉', variant: 'green', name: 'RISA-3D' },
    '.std': { icon: '⚙️', variant: 'amber', name: 'STAAD Pro' },
    '.tcl': { icon: '🔬', variant: 'red', name: 'OpenSees' },
    '.inp': { icon: '🔧', variant: 'green', name: 'ANSYS' },
  }
  return formats[props.format] || { icon: '📄', variant: 'default', name: props.format }
})

const icon = computed(() => (props.showIcon !== false ? formatInfo.value.icon : ''))
const variant = computed(() => formatInfo.value.variant)
</script>

<style scoped>
.format-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 500;
  border: 1px solid;
}

.badge-default {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.badge-blue {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--accent-blue);
  border-color: rgba(59, 130, 246, 0.2);
}

.badge-purple {
  background-color: rgba(139, 92, 246, 0.1);
  color: var(--accent-purple);
  border-color: rgba(139, 92, 246, 0.2);
}

.badge-green {
  background-color: rgba(0, 255, 136, 0.1);
  color: var(--accent-green);
  border-color: rgba(0, 255, 136, 0.2);
}

.badge-amber {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--accent-amber);
  border-color: rgba(245, 158, 11, 0.2);
}

.badge-red {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--accent-red);
  border-color: rgba(239, 68, 68, 0.2);
}
</style>
