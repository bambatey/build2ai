<template>
  <header class="top-bar">
    <!-- Page Info -->
    <div class="page-info">
      <template v-if="isWorkspace && workspaceProjectName">
        <input
          v-if="renaming"
          ref="renameInputRef"
          v-model="renameValue"
          class="page-title rename-input"
          :placeholder="workspaceProjectName"
          @keydown.enter="commitRename"
          @keydown.esc="cancelRename"
          @blur="commitRename"
        />
        <button
          v-else
          type="button"
          class="page-title editable"
          title="Yeniden adlandırmak için tıkla"
          @click="startRename"
        >
          {{ workspaceProjectName }}
          <Icon name="lucide:pencil" class="rename-icon" />
        </button>
        <span v-if="projectStore.currentFile" class="page-subtitle">
          {{ projectStore.currentFile.name }}
        </span>
      </template>
      <template v-else>
        <h1 class="page-title">{{ pageTitle }}</h1>
        <span v-if="subtitle" class="page-subtitle">{{ subtitle }}</span>
      </template>
    </div>

    <!-- Actions -->
    <div class="top-actions">
      <!-- Model Selector (workspace only) -->
      <select
        v-if="showModelSelector"
        v-model="selectedModel"
        class="model-select"
      >
        <option value="claude-opus-4-6">Claude Opus 4.6</option>
        <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
        <option value="claude-haiku-4">Claude Haiku 4</option>
      </select>

      <!-- Action Buttons -->
      <button
        v-for="action in actions"
        :key="action.id"
        @click="action.onClick"
        class="action-btn"
        :title="action.label"
      >
        <Icon :name="action.icon" />
        <span v-if="action.showLabel">{{ action.label }}</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '~/stores/chat'
import { useProjectStore } from '~/stores/project'

const route = useRoute()
const chatStore = useChatStore()
const projectStore = useProjectStore()

const isWorkspace = computed(() => route.path === '/workspace')

// Workspace'te gösterilecek ad: aktif proje varsa onun adı; yoksa pending draft
const workspaceProjectName = computed<string | null>(() => {
  return projectStore.activeProject?.name
    ?? projectStore.pendingNewProjectName
    ?? null
})

// --- Inline rename
const renaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

async function startRename() {
  const current = workspaceProjectName.value
  if (!current) return
  renameValue.value = current
  renaming.value = true
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

async function commitRename() {
  if (!renaming.value) return
  const newName = renameValue.value.trim()
  const current = workspaceProjectName.value
  renaming.value = false
  if (!newName || newName === current) return
  // Aktif proje varsa backend'e yaz; yoksa pending draft adını güncelle
  if (projectStore.activeProject) {
    await projectStore.renameProject(projectStore.activeProject.id, newName)
  } else if (projectStore.pendingNewProjectName !== null) {
    projectStore.pendingNewProjectName = newName
  }
}

function cancelRename() {
  renaming.value = false
}

const selectedModel = computed({
  get: () => chatStore.model,
  set: (value) => chatStore.setModel(value),
})

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/workspace': 'Workspace',
    '/projects': 'Projeler',
    '/settings': 'Ayarlar',
  }
  return titles[route.path] || 'Build2AI'
})

const subtitle = computed(() => {
  if (route.path === '/workspace') {
    return 'Bina_Model_v3.s2k'
  }
  return null
})

const showModelSelector = computed(() => route.path === '/workspace')

const actions = computed(() => {
  const baseActions = []

  if (route.path === '/workspace') {
    baseActions.push(
      {
        id: 'save',
        label: 'Kaydet',
        icon: 'lucide:save',
        showLabel: false,
        onClick: () => console.log('Kaydet'),
      },
      {
        id: 'export',
        label: 'Dışa Aktar',
        icon: 'lucide:download',
        showLabel: false,
        onClick: () => console.log('Dışa aktar'),
      }
    )
  }

  return baseActions
})
</script>

<style scoped>
.top-bar {
  height: 60px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 40;
}

.page-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.page-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.page-title.editable {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 8px;
  margin: -4px -8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.15s, border-color 0.15s;
}
.page-title.editable:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-default);
}
.page-title.editable .rename-icon {
  opacity: 0;
  transition: opacity 0.15s;
}
.page-title.editable .rename-icon :deep(svg) { width: 13px; height: 13px; }
.page-title.editable:hover .rename-icon { opacity: 0.6; }

.page-title.rename-input {
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-blue);
  border-radius: 6px;
  padding: 4px 8px;
  margin: -4px -8px;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
  min-width: 200px;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.model-select {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.model-select:hover {
  border-color: var(--border-active);
}

.model-select:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: transparent;
  border: 1px solid transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.action-btn:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--border-default);
}
</style>
