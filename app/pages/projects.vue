<template>
  <div class="projects-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Projeler</h1>
        <p class="page-subtitle">Tüm yapısal analiz projeleriniz</p>
      </div>

      <button @click="handleNewProject" class="btn btn-primary">
        <Icon name="lucide:plus" />
        Yeni Proje
      </button>
    </div>

    <!-- Search and Filters -->
    <div class="filters-section">
      <div class="search-box">
        <Icon name="lucide:search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Proje ara..."
          class="search-input"
        />
      </div>

      <div class="filter-group">
        <select v-model="filterFormat" class="filter-select">
          <option value="">Tüm Formatlar</option>
          <option value=".s2k">SAP2000</option>
          <option value=".e2k">ETABS</option>
          <option value=".r3d">RISA-3D</option>
          <option value=".std">STAAD Pro</option>
        </select>

        <select v-model="sortBy" class="filter-select">
          <option value="recent">Son Güncellenme</option>
          <option value="name">İsim</option>
          <option value="progress">İlerleme</option>
        </select>
      </div>
    </div>

    <!-- Projects Grid -->
    <div v-if="filteredProjects.length > 0" class="projects-grid">
      <div v-for="project in filteredProjects" :key="project.id" class="project-card">
        <NuxtLink :to="`/projects/${project.id}`" class="card-link">
          <div class="card-header">
            <div class="project-icon">
              <Icon name="lucide:folder" />
            </div>
            <div class="project-info">
              <h3 class="project-name">{{ project.name }}</h3>
              <div class="project-meta">
                <span class="meta-badge">{{ project.format }}</span>
                <span class="meta-separator">·</span>
                <span class="meta-text">{{ project.fileCount }} dosya</span>
              </div>
            </div>
          </div>

          <div class="card-body">
            <div class="progress-section">
              <div class="progress-header">
                <span class="progress-label">İlerleme</span>
                <span class="progress-value">{{ project.progress }}%</span>
              </div>
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: `${project.progress}%`,
                    backgroundColor: getProgressColor(project.progress),
                  }"
                />
              </div>
            </div>

            <div class="tags-section">
              <span v-for="tag in project.tags" :key="tag" class="tag">
                {{ tag }}
              </span>
            </div>
          </div>

          <div class="card-footer">
            <span class="footer-time">{{ formatTimeAgo(project.lastModified) }}</span>
            <Icon name="lucide:chevron-right" class="footer-icon" />
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">
        <Icon name="lucide:folder-search" />
      </div>
      <h3 class="empty-title">Proje bulunamadı</h3>
      <p class="empty-text">Arama kriterlerinize uygun proje bulunamadı</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProjectStore } from '~/stores/project'
import { mockProjects, formatTimeAgo } from '~/utils/mockData'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Projeler - StructAI',
  description: 'Yapısal analiz projelerinizi yönetin',
})

const projectStore = useProjectStore()
const router = useRouter()

const searchQuery = ref('')
const filterFormat = ref('')
const sortBy = ref('recent')

const filteredProjects = computed(() => {
  let result = [...projectStore.projects]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  if (filterFormat.value) {
    result = result.filter(p => p.format === filterFormat.value)
  }

  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'progress':
        return b.progress - a.progress
      case 'recent':
      default:
        return b.lastModified.getTime() - a.lastModified.getTime()
    }
  })

  return result
})

const getProgressColor = (progress: number) => {
  if (progress >= 80) return 'var(--accent-green)'
  if (progress >= 50) return 'var(--accent-blue)'
  if (progress >= 25) return 'var(--accent-amber)'
  return 'var(--accent-red)'
}

onMounted(() => {
  mockProjects.forEach(project => {
    projectStore.addProject(project)
  })
})

const handleNewProject = () => {
  router.push('/workspace')
}
</script>

<style scoped>
.projects-page {
  padding: 1rem 2rem 2rem 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

/* Header */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.header-content {
  flex: 1;
  margin-bottom: 0;
  padding-top: 0;
}

.page-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Filters */
.filters-section {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem 1rem 0.75rem 3rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.filter-group {
  display: flex;
  gap: 0.75rem;
}

.filter-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-select:hover {
  border-color: var(--border-active);
}

.filter-select:focus {
  outline: none;
  border-color: var(--accent-blue);
}

/* Projects Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.project-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: var(--accent-blue);
  transform: translateY(-2px);
}

.card-link {
  display: block;
  text-decoration: none;
  color: inherit;
}

/* Card Header */
.card-header {
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid var(--border-default);
}

.project-icon {
  width: 48px;
  height: 48px;
  background: var(--bg-tertiary);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.project-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.375rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.meta-badge {
  padding: 0.125rem 0.5rem;
  background: var(--bg-elevated);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

.meta-separator {
  color: var(--text-muted);
}

/* Card Body */
.card-body {
  padding: 1.25rem;
}

.progress-section {
  margin-bottom: 1rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.progress-label {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 500;
}

.progress-value {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.5s ease;
  border-radius: 3px;
}

.tags-section {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  padding: 0.25rem 0.625rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* Card Footer */
.card-footer {
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border-default);
  background: var(--bg-primary);
}

.footer-time {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.footer-icon {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.2s;
}

.project-card:hover .footer-icon {
  opacity: 1;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  width: 4rem;
  height: 4rem;
  background: var(--bg-secondary);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.empty-icon :deep(svg) {
  width: 2rem;
  height: 2rem;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-text {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  max-width: 400px;
}

/* Responsive */
@media (max-width: 768px) {
  .projects-page {
    padding: 1rem;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .filters-section {
    flex-direction: column;
  }

  .search-box {
    max-width: 100%;
  }

  .projects-grid {
    grid-template-columns: 1fr;
  }
}
</style>
