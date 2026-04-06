<template>
  <div class="workspace-page h-screen flex flex-col">
    <!-- 3 Panel Layout -->
    <div class="workspace-content flex flex-1 overflow-hidden">
      <!-- Left Panel - File Explorer -->
      <div
        ref="leftPanel"
        class="left-panel border-r border-[var(--border-default)] overflow-hidden"
        :style="{ width: `${leftWidth}px` }"
      >
        <WorkspaceFileExplorer />
      </div>

      <!-- Resizer 1 -->
      <div
        class="resizer"
        @mousedown="startResize('left', $event)"
      />

      <!-- Middle Panel - Code Editor -->
      <div class="middle-panel flex-1 overflow-hidden">
        <WorkspaceCodeEditor />
      </div>

      <!-- Resizer 2 -->
      <div
        class="resizer"
        @mousedown="startResize('right', $event)"
      />

      <!-- Right Panel - Chat -->
      <div
        ref="rightPanel"
        class="right-panel border-l border-[var(--border-default)] overflow-hidden"
        :style="{ width: `${rightWidth}px` }"
      >
        <WorkspaceChatPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useProjectStore } from '~/stores/project'
import { mockProjects, mockSAP2000Content } from '~/utils/mockData'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Workspace - StructAI',
  description: 'Yapısal model editörü ve AI asistan',
})

const projectStore = useProjectStore()

// Panel widths
const leftWidth = ref(280)
const rightWidth = ref(420)
const minPanelWidth = 200
const maxPanelWidth = 600

// Resizing state
const isResizing = ref(false)
const resizingPanel = ref<'left' | 'right' | null>(null)
const startX = ref(0)
const startWidth = ref(0)

onMounted(() => {
  // Mock proje yükle
  const project = mockProjects[0]
  projectStore.setCurrentProject(project)

  // İlk dosyayı aç
  if (project.files.length > 0) {
    const firstFile = project.files[0]
    if (firstFile.type === 'file') {
      projectStore.openFile(firstFile, mockSAP2000Content)
    }
  }

  // Add global mouse listeners for resizing
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
})

const startResize = (panel: 'left' | 'right', event: MouseEvent) => {
  isResizing.value = true
  resizingPanel.value = panel
  startX.value = event.clientX
  startWidth.value = panel === 'left' ? leftWidth.value : rightWidth.value

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isResizing.value || !resizingPanel.value) return

  const delta = event.clientX - startX.value

  if (resizingPanel.value === 'left') {
    const newWidth = Math.max(minPanelWidth, Math.min(maxPanelWidth, startWidth.value + delta))
    leftWidth.value = newWidth
  } else {
    const newWidth = Math.max(minPanelWidth, Math.min(maxPanelWidth, startWidth.value - delta))
    rightWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  resizingPanel.value = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}
</script>

<style scoped>
.workspace-page {
  background-color: var(--bg-primary);
}

.workspace-content {
  position: relative;
}

.left-panel,
.middle-panel,
.right-panel {
  height: 100%;
  position: relative;
}

.resizer {
  width: 4px;
  background-color: var(--border-default);
  cursor: col-resize;
  transition: background-color 150ms ease;
  position: relative;
  z-index: 10;
}

.resizer:hover {
  background-color: var(--accent-blue);
}

.resizer::before {
  content: '';
  position: absolute;
  top: 0;
  left: -4px;
  right: -4px;
  bottom: 0;
  cursor: col-resize;
}

/* Responsive - Mobile */
@media (max-width: 1024px) {
  .left-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  .right-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    width: 100% !important;
    max-width: 400px;
    transform: translateX(100%);
    transition: transform 300ms ease;
  }

  .right-panel.mobile-open {
    transform: translateX(0);
  }
}
</style>
