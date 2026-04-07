<template>
  <div class="workspace-page">
    <!-- Mode Selection (if no project selected) -->
    <div v-if="!currentMode" class="mode-selection">
      <div class="mode-container">
        <h1 class="mode-title">Workspace</h1>
        <p class="mode-subtitle">Yeni bir proje oluşturun veya mevcut projeyi açın</p>

        <div class="mode-cards">
          <button @click="selectMode('new')" class="mode-card">
            <div class="card-icon new">
              <Icon name="lucide:plus-circle" />
            </div>
            <h3 class="card-title">Yeni Proje</h3>
            <p class="card-description">
              Taslak çizim yapın ve AI ile yeni bir yapısal model oluşturun
            </p>
            <div class="card-action">
              <span>Başlayın</span>
              <Icon name="lucide:arrow-right" />
            </div>
          </button>

          <button @click="selectMode('open')" class="mode-card">
            <div class="card-icon open">
              <Icon name="lucide:folder-open" />
            </div>
            <h3 class="card-title">Proje Aç</h3>
            <p class="card-description">
              Mevcut bir projeyi açın ve AI ile geliştirmeye devam edin
            </p>
            <div class="card-action">
              <span>Seçin</span>
              <Icon name="lucide:arrow-right" />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- New Project Mode -->
    <div v-else-if="currentMode === 'new'" class="workspace-content">
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
        <div
          class="panel-resizer"
          @mousedown="startResize($event)"
        />

        <!-- Chat Panel -->
        <div class="chat-panel">
          <WorkspaceChatPanel />
        </div>
      </div>
    </div>

    <!-- Open Project Mode -->
    <div v-else-if="currentMode === 'open'" class="workspace-content">
      <div class="workspace-panels">
        <!-- Project Info Panel -->
        <div
          ref="projectPanel"
          class="project-panel"
          :style="{ flexBasis: `${projectWidth}px`, maxWidth: `${projectWidth}px` }"
        >
          <div class="project-selector">
            <h3 class="section-title">Proje Seçin</h3>

            <div class="projects-list">
              <button
                v-for="project in recentProjects"
                :key="project.id"
                @click="selectProject(project)"
                :class="['project-item', { active: selectedProject?.id === project.id }]"
              >
                <div class="project-icon">
                  <Icon name="lucide:folder" />
                </div>
                <div class="project-info">
                  <div class="project-name">{{ project.name }}</div>
                  <div class="project-meta">
                    <span class="format-badge">{{ project.format }}</span>
                    <span class="separator">·</span>
                    <span>{{ formatTimeAgo(project.lastModified) }}</span>
                  </div>
                </div>
                <Icon v-if="selectedProject?.id === project.id" name="lucide:check" class="check-icon" />
              </button>
            </div>
          </div>

          <!-- Selected Project Details -->
          <div v-if="selectedProject" class="project-details">
            <h3 class="section-title">Proje Bilgileri</h3>

            <div class="details-grid">
              <div class="detail-item">
                <span class="detail-label">Format</span>
                <span class="detail-value">{{ selectedProject.format }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Dosya Sayısı</span>
                <span class="detail-value">{{ selectedProject.fileCount }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">İlerleme</span>
                <span class="detail-value">{{ selectedProject.progress }}%</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Etiketler</span>
                <div class="tags-list">
                  <span v-for="tag in selectedProject.tags" :key="tag" class="tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Resizer -->
        <div
          class="panel-resizer"
          @mousedown="startResize($event)"
        />

        <!-- Chat Panel -->
        <div class="chat-panel">
          <WorkspaceChatPanel />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '~/stores/chat'
import { mockProjects, formatTimeAgo } from '~/utils/mockData'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Workspace - StructAI',
  description: 'Yapısal model oluşturma workspace',
})

const chatStore = useChatStore()

// Mode state
const currentMode = ref<'new' | 'open' | null>(null)
const selectedProject = ref<any>(null)
const recentProjects = mockProjects.slice(0, 5)

// Panel widths
const drawingWidth = ref(700)
const projectWidth = ref(400)
const isResizing = ref(false)
const startX = ref(0)
const startWidth = ref(0)

// Layout constraints
const MIN_LEFT = 280
const MIN_CHAT = 320
const RESIZER_WIDTH = 4
const SIDEBAR_WIDTH = 220 // sol nav genişliği (yaklaşık)

const router = useRouter()
const route = useRoute()

// Route'tan mode'u al
watch(() => route.query.mode, (newMode) => {
  if (newMode === 'new' || newMode === 'open') {
    currentMode.value = newMode
  } else {
    currentMode.value = null
  }
}, { immediate: true })

const selectMode = (mode: 'new' | 'open') => {
  router.push({ path: '/workspace', query: { mode } })
}

const backToSelection = () => {
  router.push('/workspace')
  selectedProject.value = null
}

const selectProject = (project: any) => {
  selectedProject.value = project
}

const handleSketchExport = (data: { image: string; shapes: any; prompt: string }) => {
  console.log('Sketch exported:', data)

  // Send to AI with prompt
  // TODO: API integration - send image and shapes data
  chatStore.sendMessage(`${data.prompt}\n\n[Taslak çizim eklendi - ${Object.values(data.shapes).flat().length} şekil]`)

  console.log('Çizim ve prompt AI\'ya gönderildi:', {
    prompt: data.prompt,
    hasImage: !!data.image,
    shapeCount: Object.values(data.shapes).flat().length,
  })
}

// Maksimum sol panel genişliğini hesapla (chat'e yer kalsın diye)
const getMaxLeftWidth = () => {
  if (typeof window === 'undefined') return 1000
  return Math.max(MIN_LEFT, window.innerWidth - SIDEBAR_WIDTH - RESIZER_WIDTH - MIN_CHAT)
}

// Pencere boyutu değişince sol paneli sınırla
const clampLeftWidth = () => {
  const max = getMaxLeftWidth()
  if (drawingWidth.value > max) drawingWidth.value = max
  if (projectWidth.value > max) projectWidth.value = max
  if (drawingWidth.value < MIN_LEFT) drawingWidth.value = MIN_LEFT
  if (projectWidth.value < MIN_LEFT) projectWidth.value = MIN_LEFT
}

// Panel resize
const startResize = (event: MouseEvent) => {
  isResizing.value = true
  startX.value = event.clientX
  startWidth.value = currentMode.value === 'new' ? drawingWidth.value : projectWidth.value

  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isResizing.value) return

  const delta = event.clientX - startX.value
  const maxAllowed = getMaxLeftWidth()
  const newWidth = Math.max(MIN_LEFT, Math.min(maxAllowed, startWidth.value + delta))

  if (currentMode.value === 'new') {
    drawingWidth.value = newWidth
  } else {
    projectWidth.value = newWidth
  }
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

/* Mode Selection */
.mode-selection {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  min-height: calc(100vh - 60px);
  width: 100%;
  padding: 5rem 2rem 2rem 2rem;
}

.mode-container {
  max-width: 900px;
  width: 100%;
  text-align: center;
}

.mode-title {
  font-size: 2.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.mode-subtitle {
  font-size: 1.125rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.mode-cards {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.mode-card {
  background: var(--bg-secondary);
  border: 2px solid var(--border-default);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  width: 350px;
  max-width: 100%;
}

.mode-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-green));
  transform: scaleX(0);
  transition: transform 0.3s;
}

.mode-card:hover {
  border-color: var(--accent-blue);
  transform: translateY(-4px);
}

.mode-card:hover::before {
  transform: scaleX(1);
}

.card-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-icon.new {
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-blue);
}

.card-icon.open {
  background: rgba(16, 185, 129, 0.1);
  color: var(--accent-green);
}

.card-icon :deep(svg) {
  width: 40px;
  height: 40px;
}

.card-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.card-description {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 2rem;
}

.card-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--accent-blue);
  font-weight: 500;
}

/* Workspace Content */
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
  gap: 0;
  min-width: 0;
}

.drawing-panel,
.project-panel {
  overflow: hidden;
  min-width: 280px;
  height: 100%;
  flex-grow: 0;
  flex-shrink: 1;
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

/* Project Panel */
.project-panel {
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
}

.project-selector {
  flex: 1;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-default);
  overflow-y: auto;
  max-height: calc(100vh - 200px);
}

.section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.project-item:hover {
  background: var(--bg-elevated);
  border-color: var(--border-default);
}

.project-item.active {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.1);
}

.project-icon {
  width: 36px;
  height: 36px;
  background: var(--bg-elevated);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.format-badge {
  padding: 0.125rem 0.375rem;
  background: var(--bg-elevated);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
}

.separator {
  color: var(--text-muted);
}

.check-icon {
  width: 18px;
  height: 18px;
  color: var(--accent-blue);
  flex-shrink: 0;
}

/* Project Details */
.project-details {
  padding: 1.5rem;
  background: var(--bg-primary);
}

.details-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 500;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.tag {
  padding: 0.25rem 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Responsive: dar ekranlarda panelleri alt alta ko */
@media (max-width: 900px) {
  .workspace-panels {
    flex-direction: column;
  }

  .drawing-panel,
  .project-panel {
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