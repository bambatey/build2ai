<template>
  <div class="project-switcher" :class="{ collapsed }">
    <div class="switcher-row" :class="{ open: isOpen }">
      <button
        type="button"
        class="switcher-trigger"
        :class="{ open: isOpen }"
        @click="toggleOpen"
      >
        <div class="trigger-icon">
          <Icon name="lucide:folder" />
        </div>
        <div v-if="!collapsed" class="trigger-info">
          <div class="trigger-label">PROJE</div>
          <div v-if="!renaming" class="trigger-name">{{ triggerName }}</div>
          <input
            v-else
            ref="renameInputRef"
            v-model="renameValue"
            class="trigger-rename-input"
            :placeholder="triggerName"
            @click.stop
            @keydown.enter="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
        </div>
        <Icon
          v-if="!collapsed && !renaming"
          name="lucide:chevrons-up-down"
          class="trigger-chevron"
        />
      </button>
      <button
        v-if="!collapsed && !renaming"
        type="button"
        class="trigger-action rename-btn"
        title="Yeniden adlandır"
        @click.stop="startRename"
      >
        <Icon name="lucide:pencil" />
      </button>
    </div>

    <!-- Popover -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        ref="popoverEl"
        class="switcher-popover"
        :style="popoverStyle"
      >
        <div class="popover-search">
          <Icon name="lucide:search" class="search-icon" />
          <input
            ref="searchInput"
            v-model="search"
            type="text"
            placeholder="Proje ara..."
            class="search-input"
            @keydown.escape="close"
          />
        </div>

        <div class="popover-list">
          <div
            v-for="project in filteredProjects"
            :key="project.id"
            class="popover-row"
            :class="{ active: project.id === projectStore.activeProjectId }"
          >
            <button
              type="button"
              class="popover-item"
              @click="selectProject(project.id)"
            >
              <Icon name="lucide:folder" class="item-icon" />
              <div class="item-info">
                <div class="item-name">{{ project.name }}</div>
                <div class="item-meta">{{ project.format }} · {{ project.fileCount }} dosya</div>
              </div>
              <Icon
                v-if="project.id === projectStore.activeProjectId"
                name="lucide:check"
                class="item-check"
              />
            </button>
            <button
              type="button"
              class="popover-delete"
              title="Projeyi sil"
              @click="handleDelete(project.id, project.name, $event)"
            >
              <Icon name="lucide:trash-2" />
            </button>
          </div>

          <div v-if="filteredProjects.length === 0" class="popover-empty">
            Sonuç bulunamadı
          </div>
        </div>

        <div class="popover-footer">
          <button type="button" class="footer-btn" @click="goToAllProjects">
            <Icon name="lucide:layout-grid" />
            Tüm projeler
          </button>
          <button type="button" class="footer-btn" @click="closeProject">
            <Icon name="lucide:log-out" />
            Kapat
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '~/stores/project'

const props = defineProps<{ collapsed?: boolean }>()

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()

const isNewFlow = computed(
  () => route.path === '/workspace' && route.query.mode === 'new',
)

const isOpen = ref(false)
const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const popoverEl = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

// --- Inline rename
const renaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

async function startRename() {
  const current = activeProject.value?.name ?? projectStore.pendingNewProjectName
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
  const current = activeProject.value?.name ?? projectStore.pendingNewProjectName
  renaming.value = false
  if (!newName || newName === current) return
  if (activeProject.value) {
    await projectStore.renameProject(activeProject.value.id, newName)
  } else if (projectStore.pendingNewProjectName !== null) {
    projectStore.pendingNewProjectName = newName
  }
}

function cancelRename() {
  renaming.value = false
}

async function handleDelete(projectId: string, projectName: string, e: MouseEvent) {
  e.stopPropagation()
  if (!confirm(`"${projectName}" projesi kalıcı olarak silinecek. Emin misin?`)) return
  await projectStore.deleteProject(projectId)
  close()
  // Aktif projeyi sildiysek, projeler sayfasına at
  if (!projectStore.activeProjectId) {
    router.push('/projects')
  }
}

const activeProject = computed(() => projectStore.activeProject)

const triggerName = computed(() => {
  if (activeProject.value) return activeProject.value.name
  if (projectStore.pendingNewProjectName) return projectStore.pendingNewProjectName
  if (isNewFlow.value) return 'Yeni Proje (kayıtsız)'
  return 'Proje seçin'
})

const filteredProjects = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = projectStore.projects
  if (!q) return list
  return list.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.tags.some(t => t.toLowerCase().includes(q)),
  )
})

const updatePosition = () => {
  const trigger = document.querySelector('.project-switcher .switcher-trigger') as HTMLElement
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.right + 8}px`,
    zIndex: '100',
  }
}

const handleOutsideClick = (e: MouseEvent) => {
  const target = e.target as Node
  if (popoverEl.value?.contains(target)) return
  const trigger = document.querySelector('.project-switcher .switcher-trigger')
  if (trigger?.contains(target)) return
  close()
}

const toggleOpen = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await nextTick()
    updatePosition()
    searchInput.value?.focus()
    document.addEventListener('mousedown', handleOutsideClick)
    window.addEventListener('resize', updatePosition)
  } else {
    cleanup()
  }
}

const close = () => {
  isOpen.value = false
  search.value = ''
  cleanup()
}

const cleanup = () => {
  document.removeEventListener('mousedown', handleOutsideClick)
  window.removeEventListener('resize', updatePosition)
}

const selectProject = (id: string) => {
  projectStore.openProject(id)
  close()
  if (router.currentRoute.value.path !== '/workspace') {
    router.push('/workspace')
  }
}

const goToAllProjects = () => {
  close()
  router.push('/projects')
}

const closeProject = () => {
  projectStore.closeProject()
  close()
  router.push('/projects')
}

onBeforeUnmount(cleanup)
</script>

<style scoped>
.project-switcher {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-default);
}

.switcher-row {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.switcher-row:hover .trigger-action { opacity: 1; }

.switcher-trigger {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  color: var(--text-primary);
}

.trigger-action {
  width: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}
.trigger-action:hover {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
  opacity: 1;
}
.trigger-action :deep(svg) { width: 14px; height: 14px; }

.trigger-rename-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-elevated);
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: inherit;
  outline: 1px solid var(--accent-blue);
  outline-offset: -1px;
  margin: 0;
  min-width: 0;
}

.switcher-trigger:hover,
.switcher-trigger.open {
  border-color: var(--accent-blue);
  background: var(--bg-elevated);
}

.trigger-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.project-switcher.collapsed .switcher-trigger {
  justify-content: center;
  padding: 0.5rem;
}

.trigger-info {
  flex: 1;
  min-width: 0;
}

.trigger-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.125rem;
}

.trigger-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trigger-chevron {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* Popover */
.switcher-popover {
  width: 280px;
  box-sizing: border-box;
  max-height: 480px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.popover-search {
  position: relative;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-default);
}

.search-icon {
  position: absolute;
  left: 1.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.popover-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
}

.popover-row {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 2px;
  border-radius: 6px;
}
.popover-row:hover .popover-delete { opacity: 1; }
.popover-row.active .popover-item {
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-blue);
}

.popover-item {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.popover-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.popover-delete {
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}
.popover-delete:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.08);
  opacity: 1;
}
.popover-delete :deep(svg) { width: 14px; height: 14px; }

.item-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-meta {
  font-size: 0.6875rem;
  color: var(--text-muted);
  margin-top: 0.125rem;
}

.item-check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.popover-empty {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.popover-footer {
  display: flex;
  border-top: 1px solid var(--border-default);
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.footer-btn + .footer-btn {
  border-left: 1px solid var(--border-default);
}
</style>
