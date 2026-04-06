<template>
  <div class="quick-commands px-4 py-2 border-b border-[var(--border-default)] overflow-x-auto">
    <div class="commands-list flex gap-2">
      <button
        v-for="command in chatStore.quickCommands"
        :key="command.id"
        @click="handleSelectCommand(command)"
        class="command-chip badge badge-blue hover:bg-[var(--accent-blue)]/20 transition-all whitespace-nowrap"
      >
        <Icon v-if="command.icon" :name="`lucide:${command.icon}`" class="w-3 h-3" />
        {{ command.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useChatStore } from '~/stores/chat'
import type { QuickCommand } from '~/stores/chat'

const chatStore = useChatStore()

const emit = defineEmits<{
  select: [command: QuickCommand]
}>()

const handleSelectCommand = (command: QuickCommand) => {
  emit('select', command)
}
</script>

<style scoped>
.quick-commands {
  background-color: var(--bg-primary);
}

.commands-list {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.commands-list::-webkit-scrollbar {
  display: none;
}

.command-chip {
  cursor: pointer;
  user-select: none;
}
</style>
