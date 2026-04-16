<template>
  <div class="workspace-page">
    <!-- Aktif proje: canvas/advanced/3d + chat -->
    <div v-if="activeProject" class="workspace-content">
      <div class="workspace-panels">
        <!-- Sol Panel (Canvas veya Advanced Options) -->
        <div class="drawing-panel full-width">
          <div class="left-panel-content">
            <WorkspaceDrawingCanvas v-if="leftView === 'canvas'" @export="handleSketchExport" />
            <WorkspaceAdvancedOptions v-else-if="leftView === 'advanced'" />
            <WorkspaceModel3DPreview v-else-if="leftView === '3d'" />

          </div>
        </div>

      </div>

      <!-- Sağ alt köşe: toggle bar + chat FAB yan yana -->
      <div class="bottom-right-bar">
        <div class="view-toggle">
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
          <button
            type="button"
            class="toggle-btn "
            :disabled="!canOpenAnalysis"
            title="Yapısal Analiz (ayrı sayfa)"
            @click="goToAnalysis"
          >
            <Icon name="lucide:bar-chart-3" />
          </button>
        </div>

        <AnalysisChatPopup />
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
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '~/stores/chat'
import { useProjectStore } from '~/stores/project'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Workspace - Build2AI',
  description: 'Yapısal model oluşturma workspace',
})

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()
const projectStore = useProjectStore()

const isNewMode = computed(() => route.query.mode === 'new')
const activeProject = computed(() => projectStore.activeProject)
const leftView = ref<'canvas' | 'advanced' | '3d'>('3d')

const canOpenAnalysis = computed(() => {
  const f = projectStore.currentFile
  return !!projectStore.activeProjectId && !!f && f.format === '.s2k'
})

function goToAnalysis() {
  if (!canOpenAnalysis.value) return
  const pid = projectStore.activeProjectId
  const fid = projectStore.currentFile?.id
  if (pid && fid) {
    router.push(`/analysis/${pid}/${fid}`)
  }
}


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

onMounted(() => {
  if (isNewMode.value || projectStore.pendingNewProjectName) {
    chatStore.activeSessionId = null
    chatStore.messages = []
  } else if (projectStore.activeProjectId) {
    chatStore.ensureSessionForProject(projectStore.activeProjectId)
  }
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
.drawing-panel.full-width {
  flex: 1;
  max-width: 100%;
}

.bottom-right-bar {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-toggle {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Chat FAB'ı parent flow'a al (fixed yerine) */
.bottom-right-bar :deep(.chat-fab) {
  position: relative;
  right: auto;
  bottom: auto;
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
