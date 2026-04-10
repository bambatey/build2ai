<template>
  <div class="dashboard-page">
    <!-- Welcome Section -->

      <div class="welcome-content">
        <h1 class="welcome-title">Hoş geldin</h1>
        <p class="welcome-subtitle">Yapısal modellerinizi AI ile dönüştürün</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Toplam Proje</span>
          <div class="stat-icon">
            <Icon name="lucide:folder" />
          </div>
        </div>
        <div class="stat-value">{{ stats.totalProjects }}</div>
        <div class="stat-footer">
          <span class="stat-period">kayıtlı proje</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Sohbet Oturumu</span>
          <div class="stat-icon">
            <Icon name="lucide:message-square" />
          </div>
        </div>
        <div class="stat-value">{{ stats.activeSessions }}</div>
        <div class="stat-footer">
          <span class="stat-period">toplam oturum</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">AI Mesaj</span>
          <div class="stat-icon">
            <Icon name="lucide:sparkles" />
          </div>
        </div>
        <div class="stat-value">{{ stats.aiOperations }}</div>
        <div class="stat-footer">
          <span class="stat-period">toplam mesaj</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-header">
          <span class="stat-label">Agent Durumu</span>
          <div class="stat-icon">
            <Icon name="lucide:zap" />
          </div>
        </div>
        <div class="stat-value agent-status">
          <span class="status-indicator" :class="agentStore.status" />
          <span>{{ agentStore.statusText }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Recent Projects -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">Son Projeler</h2>
          <NuxtLink to="/projects" class="section-link">
            Tümünü Gör
            <Icon name="lucide:arrow-right" />
          </NuxtLink>
        </div>

        <div class="projects-list">
          <button
            v-for="project in recentProjects"
            :key="project.id"
            type="button"
            @click="handleOpenProject(project.id)"
            class="project-item"
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
            <div class="project-action">
              <Icon name="lucide:chevron-right" />
            </div>
          </button>

          <div v-if="recentProjects.length === 0" class="empty-state">
            <Icon name="lucide:inbox" />
            <span>Henüz proje yok</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">Hızlı Başlat</h2>
        </div>

        <div class="actions-list">
          <button type="button" @click="openUpload" class="action-item">
            <div class="action-icon">
              <Icon name="lucide:upload" />
            </div>
            <div class="action-content">
              <div class="action-title">Dosya Yükle</div>
              <div class="action-desc">SAP2000, ETABS veya diğer formatlar</div>
            </div>
          </button>

          <button type="button" @click="startNewProject" class="action-item">
            <div class="action-icon">
              <Icon name="lucide:plus-circle" />
            </div>
            <div class="action-content">
              <div class="action-title">Yeni Proje</div>
              <div class="action-desc">AI asistan ile yeni proje başlat</div>
            </div>
          </button>

          <button type="button" @click="showTemplateWizard = true" class="action-item">
            <div class="action-icon">
              <Icon name="lucide:layout-template" />
            </div>
            <div class="action-content">
              <div class="action-title">Şablon Seç</div>
              <div class="action-desc">Hazır model şablonları</div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Supported Programs -->
    <div class="section-card">
      <div class="section-header">
        <h2 class="section-title">Desteklenen Formatlar</h2>
      </div>

      <div class="programs-grid">
        <div v-for="program in programs" :key="program.id" class="program-card" :class="{ disabled: program.status === 'coming-soon' }">
          <div class="program-header">
            <div class="program-name">{{ program.name }}</div>
            <span v-if="program.status === 'coming-soon'" class="program-badge">Yakında</span>
            <span v-else class="program-badge active">Aktif</span>
          </div>
          <div class="program-format">{{ program.format }}</div>
        </div>
      </div>
    </div>

    <!-- Template Wizard -->
    <DashboardTemplateWizardModal v-model="showTemplateWizard" />

    <!-- Upload Modal -->
    <Teleport to="body">
      <div v-if="showUpload" class="upload-modal-overlay" @click.self="closeUpload">
        <div class="upload-modal">
          <div class="upload-modal-header">
            <h3 class="upload-modal-title">Dosya Yükle</h3>
            <button type="button" class="upload-close" @click="closeUpload">
              <Icon name="lucide:x" />
            </button>
          </div>
          <div class="upload-modal-body">
            <CommonFileDropZone
              @file-selected="handleFileSelected"
              @error="handleUploadError"
            />
            <p v-if="uploadError" class="upload-error">{{ uploadError }}</p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { mockSupportedPrograms, formatTimeAgo } from '~/utils/mockData'
import { useAgentStore } from '~/stores/agent'
import { useProjectStore } from '~/stores/project'
import { useChatStore } from '~/stores/chat'
import { useAgent } from '~/composables/useAgent'
import { createProjectFromUpload } from '~/utils/projectFromUpload'

definePageMeta({
  layout: 'default',
})

useSeoMeta({
  title: 'Dashboard - StructAI',
  description: 'Yapısal mühendislik AI asistanı',
})

const router = useRouter()
const agentStore = useAgentStore()
const projectStore = useProjectStore()
const chatStore = useChatStore()
const agent = useAgent()

const stats = computed(() => ({
  totalProjects: projectStore.projects.length,
  activeSessions: chatStore.sessions.length,
  aiOperations: chatStore.totalMessageCount,
}))

const recentProjects = computed(() => projectStore.recentProjects.slice(0, 5))
const programs = mockSupportedPrograms

onMounted(async () => {
  await projectStore.hydrate()
  await chatStore.hydrate()
})

const handleOpenProject = (id: string) => {
  projectStore.openProject(id)
  router.push('/workspace')
}

const showUpload = ref(false)
const showTemplateWizard = ref(false)
const uploadError = ref('')

const openUpload = () => {
  uploadError.value = ''
  showUpload.value = true
}

const closeUpload = () => {
  showUpload.value = false
  uploadError.value = ''
}

const startNewProject = () => {
  projectStore.requestNewProject()
}

const handleUploadError = (msg: string) => {
  uploadError.value = msg
}

const handleFileSelected = async (file: File) => {
  try {
    await createProjectFromUpload(file, { projectStore, agent, router })
    closeUpload()
  } catch (err: any) {
    uploadError.value = err?.message ?? 'Dosya işlenemedi'
  }
}
</script>

<style scoped>
.dashboard-page {
  padding: 1rem 2rem 2rem 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

/* Welcome Section */
.welcome-content {
  margin-bottom: 1.5rem;
  padding-top: 0;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.welcome-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
  margin-top: 0;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: var(--border-active);
  transform: translateY(-2px);
}

.stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.stat-value {
  font-size: 2rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
  font-family: 'JetBrains Mono', monospace;
}

.stat-value.agent-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-green);
}

.status-indicator.connecting {
  background: var(--accent-amber);
}

.status-indicator.disconnected {
  background: var(--accent-red);
}

.stat-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 500;
}

.stat-trend.positive {
  color: var(--accent-green);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

/* Section Card */
.section-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.section-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--accent-blue);
  text-decoration: none;
  transition: color 0.2s;
}

.section-link:hover {
  color: var(--text-primary);
}

/* Projects List */
.projects-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid transparent;
  text-decoration: none;
  transition: all 0.2s;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  width: 100%;
  cursor: pointer;
}

.project-item:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-default);
}

.project-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 0.9375rem;
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
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.format-badge {
  padding: 0.125rem 0.5rem;
  background: var(--bg-elevated);
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

.separator {
  color: var(--text-muted);
}

.project-action {
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.2s;
}

.project-item:hover .project-action {
  opacity: 1;
}

/* Actions List */
.actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.action-item:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-blue);
}

.action-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--accent-blue);
  flex-shrink: 0;
}

.action-content {
  flex: 1;
}

.action-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.action-desc {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Programs Grid */
.programs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.program-card {
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  transition: all 0.2s;
}

.program-card:hover:not(.disabled) {
  border-color: var(--accent-blue);
  background: var(--bg-tertiary);
}

.program-card.disabled {
  opacity: 0.5;
}

.program-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.program-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
}

.program-badge {
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.program-badge.active {
  background: rgba(0, 255, 136, 0.1);
  color: var(--accent-green);
}

.program-format {
  font-size: 0.8125rem;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-page {
    padding: 1rem;
  }

  .content-grid {
    grid-template-columns: 1fr;
  }

  .programs-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}

/* Upload Modal */
.upload-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 1rem;
}

.upload-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.upload-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-default);
}

.upload-modal-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.upload-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.upload-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.upload-modal-body {
  padding: 1.25rem;
}

.upload-error {
  margin-top: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  color: var(--accent-red);
  font-size: 0.8125rem;
}
</style>
