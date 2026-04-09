<template>
  <div class="workspace-page">
    <!-- Yeni proje akışı: çizim + chat -->
    <div v-if="isNewMode" class="workspace-content">
      <div class="workspace-panels">
        <!-- Drawing Panel -->
        <div
          ref="drawingPanel"
          class="drawing-panel"
          :style="{ flexBasis: `${drawingWidth}px`, maxWidth: `${drawingWidth}px` }"
        >
          <WorkspaceDrawingCanvas @export="handleSketchExport" />
        </div>

        <!-- Resizer -->
        <div class="panel-resizer" @mousedown="startResize($event)" />

        <!-- Chat Panel -->
        <div class="chat-panel">
          <WorkspaceChatPanel />
        </div>
      </div>
    </div>

    <!-- Açık proje akışı: canvas + chat (proje aktif) -->
    <div v-else-if="activeProject" class="workspace-content">
      <div class="workspace-panels">
        <!-- Sol Panel (Canvas veya Advanced Options) -->
        <div
          ref="drawingPanel"
          class="drawing-panel"
          :style="{ flexBasis: `${drawingWidth}px`, maxWidth: `${drawingWidth}px` }"
        >
          <div class="left-panel-content">
            <WorkspaceDrawingCanvas v-if="leftView === 'canvas'" @export="handleSketchExport" />
            <WorkspaceAdvancedOptions v-else-if="leftView === 'advanced'" />
            <WorkspaceModel3DPreview v-else-if="leftView === '3d'" />

            <!-- Floating View Toggle -->
            <div class="view-toggle floating">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: leftView === 'canvas' }"
                title="Canvas"
                @click="leftView = 'canvas'"
              >
                <Icon name="lucide:pen-tool" />
              </button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: leftView === 'advanced' }"
                title="Gelişmiş Analizler"
                @click="leftView = 'advanced'"
              >
                <Icon name="lucide:sliders-horizontal" />
              </button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: leftView === '3d' }"
                title="3D Önizleme"
                @click="leftView = '3d'"
              >
                <Icon name="lucide:box" />
              </button>
            </div>
          </div>
        </div>

        <!-- Resizer -->
        <div class="panel-resizer" @mousedown="startResize($event)" />

        <!-- Chat Panel -->
        <div class="chat-panel">
          <WorkspaceChatPanel />
        </div>
      </div>
    </div>

    <!-- Aktif proje yok ve yeni mode da değil → boş state -->
    <div v-else class="empty-state">
      <div class="empty-content">
        <Icon name="lucide:folder-open" class="empty-icon" />
        <h2 class="empty-title">Aktif proje yok</h2>
        <p class="empty-text">
          Bir proje açın veya yeni bir tane oluşturun.
        </p>
        <div class="empty-actions">
          <NuxtLink to="/projects" class="btn btn-primary">
            <Icon name="lucide:folder" />
            Projelere Git
          </NuxtLink>
          <button class="btn btn-secondary" @click="startNewProject">
            <Icon name="lucide:plus" />
            Yeni Proje
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '~/stores/chat'
import { useProjectStore } from '~/stores/project'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Workspace - StructAI',
  description: 'Yapısal model oluşturma workspace',
})

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()
const projectStore = useProjectStore()

const isNewMode = computed(() => route.query.mode === 'new')
const activeProject = computed(() => projectStore.activeProject)
const leftView = ref<'canvas' | 'advanced' | '3d'>('canvas')

// Panel widths
const drawingWidth = ref(700)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

const MIN_LEFT = 280
const MIN_CHAT = 320
const RESIZER_WIDTH = 4
const SIDEBAR_WIDTH = 240

// Aktif proje değişince ilgili chat session'a geç
watch(
  () => projectStore.activeProjectId,
  (id) => {
    if (id) chatStore.ensureSessionForProject(id)
  },
  { immediate: false },
)

// Yeni proje akışına girince chat panelini temizle
watch(
  () => isNewMode.value,
  (newVal) => {
    if (newVal) {
      chatStore.activeSessionId = null
      chatStore.messages = []
    }
  },
  { immediate: true },
)

const startNewProject = () => {
  projectStore.requestNewProject()
}

const handleSketchExport = (data: { image: string; shapes: any; prompt: string }) => {
  chatStore.sendMessage(`${data.prompt}\n\n[Taslak çizim eklendi - ${Object.values(data.shapes).flat().length} şekil]`)
}

const getMaxLeftWidth = () => {
  if (typeof window === 'undefined') return 1000
  return Math.max(MIN_LEFT, window.innerWidth - SIDEBAR_WIDTH - RESIZER_WIDTH - MIN_CHAT)
}

const clampLeftWidth = () => {
  const max = getMaxLeftWidth()
  if (drawingWidth.value > max) drawingWidth.value = max
  if (drawingWidth.value < MIN_LEFT) drawingWidth.value = MIN_LEFT
}

const startResize = (event: MouseEvent) => {
  isResizing.value = true
  startX.value = event.clientX
  startWidth.value = drawingWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isResizing.value) return
  const delta = event.clientX - startX.value
  const maxAllowed = getMaxLeftWidth()
  drawingWidth.value = Math.max(MIN_LEFT, Math.min(maxAllowed, startWidth.value + delta))
}

const stopResize = () => {
  isResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

const handleWindowResize = () => {
  clampLeftWidth()
}

onMounted(() => {
  // Yeni proje akışındaysak chat'i temiz tut, hydrate etme
  if (isNewMode.value || projectStore.pendingNewProjectName) {
    chatStore.activeSessionId = null
    chatStore.messages = []
  } else if (projectStore.activeProjectId) {
    chatStore.ensureSessionForProject(projectStore.activeProjectId)
  }

  // Canvas ve chat'i ortadan ikiye böl
  if (typeof window !== 'undefined') {
    const available = window.innerWidth - SIDEBAR_WIDTH - RESIZER_WIDTH
    drawingWidth.value = Math.max(MIN_LEFT, Math.floor(available / 2))
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopResize)
  window.addEventListener('resize', handleWindowResize)
  clampLeftWidth()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopResize)
  window.removeEventListener('resize', handleWindowResize)
})
</script>

<style scoped>
.workspace-page {
  height: 100%;
  background: var(--bg-primary);
  position: relative;
}

.workspace-content {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-panels {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  min-width: 0;
}

.drawing-panel {
  overflow: hidden;
  min-width: 280px;
  height: 100%;
  flex-grow: 0;
  flex-shrink: 1;
  position: relative;
}

.view-toggle {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}

.view-toggle.floating {
  position: absolute;
  bottom: 82px;
  right: 8px;
  z-index: 20;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.left-panel-content {
  position: relative;
  height: 100%;
}

.toggle-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--accent-blue);
  color: white;
}

.toggle-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

.left-panel-content {
  height: 100%;
  overflow: hidden;
}

.chat-panel {
  flex: 1 1 0;
  overflow: hidden;
  min-width: 320px;
  height: 100%;
}

.panel-resizer {
  width: 4px;
  background: var(--border-default);
  cursor: col-resize;
  transition: background 0.2s;
  flex-shrink: 0;
}

.panel-resizer:hover {
  background: var(--accent-blue);
}

/* Empty state */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 60px);
  padding: 2rem;
}

.empty-content {
  text-align: center;
  max-width: 480px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.empty-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.empty-text {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.empty-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .workspace-panels {
    flex-direction: column;
  }
  .drawing-panel {
    max-width: 100% !important;
    flex-basis: auto !important;
    width: 100% !important;
    height: 50%;
    min-width: 0;
  }
  .chat-panel {
    width: 100%;
    height: 50%;
    min-width: 0;
  }
  .panel-resizer {
    display: none;
  }
}
</style>
