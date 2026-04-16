<template>
  <div class="projects-page">
    <!-- Header -->
    <header class="page-header">
      <div>
        <h1 class="page-title">Projeler</h1>
        <p class="page-subtitle">
          {{ projectStore.projects.length }} proje · modelini aç, yeniden adlandır ya da sil
        </p>
      </div>
      <button class="btn-primary" @click="handleNewProject">
        <Icon name="lucide:plus" />
        Yeni Proje
      </button>
    </header>

    <!-- Filters -->
    <div class="filters">
      <div class="search-box">
        <Icon name="lucide:search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Proje ara..."
          class="search-input"
        />
      </div>
      <select v-model="filterFormat" class="filter-select">
        <option value="">Tüm formatlar</option>
        <option value=".s2k">SAP2000 (.s2k)</option>
        <option value=".e2k">ETABS (.e2k)</option>
        <option value=".r3d">RISA-3D (.r3d)</option>
        <option value=".std">STAAD Pro (.std)</option>
      </select>
      <select v-model="sortBy" class="filter-select">
        <option value="recent">Son güncellenme</option>
        <option value="name">İsim (A-Z)</option>
      </select>
    </div>

    <!-- Grid -->
    <div v-if="filteredProjects.length > 0" class="project-grid">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="project-card"
      >
        <!-- Thumbnail: 3D preview -->
        <button
          type="button"
          class="card-thumb"
          @click="handleOpenProject(project.id)"
        >
          <DashboardProjectThumbnail :project-id="project.id" />
          <span class="card-format">{{ project.format || 'model' }}</span>
          <span class="card-overlay">
            <Icon name="lucide:arrow-up-right" />
          </span>
        </button>

        <!-- Body -->
        <div class="card-body">
          <input
            v-if="renamingId === project.id"
            ref="renameInputRef"
            v-model="renameValue"
            class="card-name-input"
            :placeholder="project.name"
            @keydown.enter="commitRename(project.id)"
            @keydown.esc="cancelRename"
            @blur="commitRename(project.id)"
          />
          <button
            v-else
            type="button"
            class="card-name"
            @click="handleOpenProject(project.id)"
          >
            {{ project.name }}
          </button>
          <div class="card-meta">
            <span>{{ project.fileCount }} dosya</span>
            <span class="sep">·</span>
            <span>{{ formatTimeAgo(project.lastModified) }}</span>
          </div>
        </div>

        <!-- Actions -->
        <div class="card-actions">
          <button
            type="button"
            class="icon-btn"
            title="Yeniden adlandır"
            @click.stop="startRename(project)"
          >
            <Icon name="lucide:pencil" />
          </button>
          <button
            type="button"
            class="icon-btn danger"
            title="Projeyi sil"
            @click.stop="handleDelete(project)"
          >
            <Icon name="lucide:trash-2" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="empty">
      <Icon name="lucide:folder-search" class="empty-icon" />
      <h3>{{ searchQuery || filterFormat ? 'Eşleşen proje yok' : 'Henüz proje yok' }}</h3>
      <p>
        {{ searchQuery || filterFormat
          ? 'Arama/filtre kriterlerini değiştir.'
          : 'Yeni bir proje başlatarak devam et.' }}
      </p>
      <button v-if="!searchQuery && !filterFormat" class="btn-primary" @click="handleNewProject">
        <Icon name="lucide:plus" />
        Yeni Proje
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useProjectStore } from '~/stores/project'
import { formatTimeAgo } from '~/utils/mockData'

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Projeler - Build2AI',
  description: 'Yapısal analiz projelerinizi yönetin',
})

const projectStore = useProjectStore()
const router = useRouter()

const searchQuery = ref('')
const filterFormat = ref('')
const sortBy = ref<'recent' | 'name'>('recent')

// --- Inline rename
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement[] | HTMLInputElement | null>(null)

const filteredProjects = computed(() => {
  let result = [...projectStore.projects]

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q)
      || (p.tags || []).some(t => t.toLowerCase().includes(q)),
    )
  }

  if (filterFormat.value) {
    result = result.filter(p => p.format === filterFormat.value)
  }

  result.sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    return b.lastModified.getTime() - a.lastModified.getTime()
  })

  return result
})

onMounted(() => {
  projectStore.hydrate()
})

function handleNewProject() {
  projectStore.requestNewProject()
}

function handleOpenProject(id: string) {
  if (renamingId.value) return  // rename aktifken tıklamayı yoksay
  projectStore.openProject(id)
  router.push('/workspace')
}

async function startRename(project: { id: string; name: string }) {
  renamingId.value = project.id
  renameValue.value = project.name
  await nextTick()
  const el = Array.isArray(renameInputRef.value)
    ? renameInputRef.value[0]
    : renameInputRef.value
  el?.focus()
  el?.select()
}

async function commitRename(projectId: string) {
  if (renamingId.value !== projectId) return
  const newName = renameValue.value.trim()
  const current = projectStore.projects.find(p => p.id === projectId)?.name
  renamingId.value = null
  if (!newName || newName === current) return
  await projectStore.renameProject(projectId, newName)
}

function cancelRename() {
  renamingId.value = null
}

async function handleDelete(project: { id: string; name: string }) {
  if (!confirm(`"${project.name}" projesi kalıcı olarak silinecek. Emin misin?`)) return
  await projectStore.deleteProject(project.id)
}
</script>

<style scoped>
.projects-page {
  padding: 2rem 2rem 3rem;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
}
.page-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.625rem 1rem;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}
.btn-primary:hover { transform: translateY(-1px); }
.btn-primary :deep(svg) { width: 16px; height: 16px; }

/* Filters */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}
.search-box {
  position: relative;
  flex: 1 1 280px;
  max-width: 420px;
}
.search-icon {
  position: absolute;
  left: 12px;
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.625rem 0.875rem 0.625rem 2.375rem;
  font-size: 0.875rem;
  color: var(--text-primary);
}
.search-input:focus { outline: none; border-color: var(--accent-blue); }
.search-input::placeholder { color: var(--text-muted); }

.filter-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  cursor: pointer;
}
.filter-select:focus { outline: none; border-color: var(--accent-blue); }

/* Grid */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.project-card {
  position: relative;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  overflow: hidden;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.project-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-blue);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.project-card:hover .card-actions { opacity: 1; }
.project-card:hover .card-overlay { opacity: 1; }

.card-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  border-bottom: 1px solid var(--border-default);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  background: transparent;
}

.card-format {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  color: #fff;
  z-index: 2;
}

.card-overlay {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-blue);
  color: #fff;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s;
}
.card-overlay :deep(svg) { width: 15px; height: 15px; }

/* Body */
.card-body {
  padding: 0.75rem 0.875rem;
}
.card-name {
  display: block;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
  font-family: inherit;
}
.card-name:hover { color: var(--accent-blue); }

.card-name-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-elevated);
  border: 1px solid var(--accent-blue);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  outline: none;
  margin-bottom: 3px;
  font-family: inherit;
}

.card-meta {
  display: flex;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.sep { opacity: 0.6; }

/* Actions (top-right) */
.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 3;
  opacity: 0.55;
  transition: opacity 0.15s;
}
.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.icon-btn:hover {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}
.icon-btn.danger:hover {
  background: #ef4444;
  border-color: #ef4444;
}
.icon-btn :deep(svg) { width: 14px; height: 14px; }

/* Empty */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 0.75rem;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-default);
  border-radius: 12px;
  color: var(--text-secondary);
}
.empty-icon { color: var(--text-muted); }
.empty-icon :deep(svg) { width: 40px; height: 40px; }
.empty h3 { margin: 0; font-size: 1.0625rem; color: var(--text-primary); }
.empty p { margin: 0 0 0.5rem; font-size: 0.875rem; }

/* Responsive */
@media (max-width: 640px) {
  .projects-page { padding: 1rem; }
  .page-title { font-size: 1.5rem; }
  .filters { flex-direction: column; align-items: stretch; }
  .search-box { max-width: 100%; }
  .project-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
