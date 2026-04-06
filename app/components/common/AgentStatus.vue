<template>
  <div class="agent-status flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-tertiary)]">
    <!-- Status Indicator -->
    <div class="status-indicator relative">
      <div
        class="w-2.5 h-2.5 rounded-full transition-all"
        :style="{ backgroundColor: agentStore.statusColor }"
        :class="{ 'pulse-glow': agentStore.isConnecting }"
      />
    </div>

    <!-- Status Text (only if not collapsed) -->
    <div v-if="!collapsed" class="status-text flex-1">
      <div class="text-xs font-medium text-primary">Agent</div>
      <div class="text-[10px] text-secondary">{{ agentStore.statusText }}</div>
    </div>

    <!-- Actions -->
    <button
      v-if="!collapsed"
      @click="handleToggleConnection"
      class="status-action-btn p-1 hover:bg-[var(--bg-elevated)] rounded transition-all"
      :title="agentStore.isConnected ? 'Bağlantıyı Kes' : 'Bağlan'"
    >
      <Icon
        :name="agentStore.isConnected ? 'lucide:plug-zap' : 'lucide:plug'"
        class="w-3.5 h-3.5"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useAgentStore } from '~/stores/agent'

defineProps<{
  collapsed?: boolean
}>()

const agentStore = useAgentStore()

const handleToggleConnection = () => {
  if (agentStore.isConnected) {
    agentStore.disconnect()
  } else {
    agentStore.connect()
  }
}

// Auto-connect on mount (simüle)
onMounted(() => {
  // 2 saniye sonra otomatik bağlan
  setTimeout(() => {
    if (agentStore.isDisconnected) {
      agentStore.connect()
    }
  }, 2000)
})
</script>

<style scoped>
.agent-status {
  user-select: none;
}

.status-action-btn {
  color: var(--text-muted);
}

.status-action-btn:hover {
  color: var(--text-primary);
}
</style>
