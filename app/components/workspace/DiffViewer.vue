<template>
  <div class="diff-viewer font-mono text-xs">
    <div
      v-for="(diff, index) in diffs"
      :key="index"
      class="diff-line flex items-start gap-2 p-2 rounded"
      :class="diffClass(diff)"
    >
      <span class="line-number text-muted min-w-[40px]">{{ diff.lineNumber }}</span>
      <div class="diff-content flex-1 space-y-1">
        <div v-if="diff.oldValue" class="old-value">
          <span class="text-[var(--accent-red)]">- </span>
          <span>{{ diff.oldValue }}</span>
        </div>
        <div v-if="diff.newValue" class="new-value">
          <span class="text-[var(--accent-green)]">+ </span>
          <span>{{ diff.newValue }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Diff {
  lineNumber: number
  oldValue?: string
  newValue?: string
}

defineProps<{
  diffs: Diff[]
}>()

const diffClass = (diff: Diff) => {
  if (diff.oldValue && diff.newValue) {
    return 'diff-modified bg-[var(--accent-amber)]/5 border-l-2 border-[var(--accent-amber)]'
  } else if (diff.oldValue) {
    return 'diff-deleted bg-[var(--accent-red)]/5 border-l-2 border-[var(--accent-red)]'
  } else if (diff.newValue) {
    return 'diff-added bg-[var(--accent-green)]/5 border-l-2 border-[var(--accent-green)]'
  }
  return ''
}
</script>

<style scoped>
.diff-viewer {
  max-height: 300px;
  overflow-y: auto;
}

.diff-line {
  transition: background-color 150ms ease;
}

.diff-line:hover {
  background-color: var(--bg-elevated);
}

.old-value {
  color: var(--text-secondary);
  text-decoration: line-through;
}

.new-value {
  color: var(--text-primary);
}
</style>
