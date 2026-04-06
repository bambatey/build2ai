<template>
  <div class="file-tree-node">
    <div
      class="node-content flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all"
      :class="{ 'active': isSelected, 'is-folder': node.type === 'folder' }"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
      @click="handleClick"
    >
      <!-- Expand Icon (for folders) -->
      <Icon
        v-if="node.type === 'folder'"
        :name="isExpanded ? 'lucide:chevron-down' : 'lucide:chevron-right'"
        class="w-3 h-3 text-muted"
      />

      <!-- File/Folder Icon -->
      <Icon
        :name="node.type === 'folder' ? 'lucide:folder' : 'lucide:file-text'"
        class="w-4 h-4"
        :class="node.type === 'folder' ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)]'"
      />

      <!-- Name -->
      <span class="node-name text-sm text-primary flex-1 truncate">{{ node.name }}</span>

      <!-- Badge (for files) -->
      <span v-if="node.type === 'file' && node.format" class="text-[10px] font-mono text-muted">
        {{ node.format }}
      </span>
    </div>

    <!-- Children (for folders) -->
    <div v-if="node.type === 'folder' && isExpanded && node.children" class="node-children">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-id="selectedId"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FileNode } from '~/stores/project'

const props = withDefaults(
  defineProps<{
    node: FileNode
    depth?: number
    selectedId?: string
  }>(),
  {
    depth: 0,
  }
)

const emit = defineEmits<{
  select: [node: FileNode]
}>()

const isExpanded = ref(true)
const isSelected = computed(() => props.node.id === props.selectedId)

const handleClick = () => {
  if (props.node.type === 'folder') {
    isExpanded.value = !isExpanded.value
  } else {
    emit('select', props.node)
  }
}
</script>

<style scoped>
.node-content.active {
  background-color: var(--bg-tertiary);
  border-left: 2px solid var(--accent-green);
}

.node-content:hover {
  background-color: var(--bg-elevated);
}
</style>
