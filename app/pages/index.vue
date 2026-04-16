<template>
  <div class="dashboard">
    <!-- Hero: greeting + AI prompt input -->
    <section class="hero">
      <div class="hero-greeting">
        <h1 class="hero-title">Hoş geldin, {{ firstName }}</h1>
        <p class="hero-subtitle">Yapısal modelini AI ile oluştur, analiz et, düzenle.</p>
      </div>

      <form class="hero-prompt" @submit.prevent="submitPrompt">
        <Icon name="lucide:sparkles" class="prompt-icon" />
        <textarea
          ref="promptRef"
          v-model="promptText"
          class="prompt-input"
          placeholder="Yapmak istediğin modeli anlat… (örn: 5 katlı RC çerçeve, 4x3 açıklık, TBDY 2018)"
          rows="1"
          @keydown="onKey"
        />
        <button
          type="submit"
          class="prompt-submit"
          :disabled="!promptText.trim()"
          title="Yeni proje oluştur"
        >
          <Icon name="lucide:arrow-up" />
        </button>
      </form>

      <div class="hero-actions">
        <button type="button" class="mini-btn" @click="openUpload">
          <Icon name="lucide:upload" />
          Dosya Yükle
        </button>
        <button type="button" class="mini-btn" @click="showTemplateWizard = true">
          <Icon name="lucide:layout-template" />
          Şablon
        </button>
        <span class="agent-pill" :class="agentStore.status">
          <span class="dot" />
          Agent: {{ agentStore.statusText }}
        </span>
      </div>
    </section>

    <!-- Recent projects: visual cards -->
    <section v-if="recentProjects.length > 0" class="section">
      <div class="section-header">
        <h2 class="section-title">
          <Icon name="lucide:clock" />
          Kaldığın yerden devam et
        </h2>
        <NuxtLink to="/projects" class="section-link">
          Tümünü Gör <Icon name="lucide:arrow-right" />
        </NuxtLink>
      </div>

      <div class="project-grid">
        <button
          v-for="project in recentProjects"
          :key="project.id"
          type="button"
          class="project-card"
          @click="handleOpenProject(project.id)"
        >
          <div class="card-thumb">
            <DashboardProjectThumbnail :project-id="project.id" />
            <span class="card-format">{{ project.format || 'model' }}</span>
          </div>
          <div class="card-body">
            <div class="card-name">{{ project.name }}</div>
            <div class="card-meta">{{ formatTimeAgo(project.lastModified) }}</div>
          </div>
        </button>
      </div>
    </section>

    <!-- Empty state (no projects) -->
    <section v-else class="section">
      <div class="empty-block">
        <Icon name="lucide:inbox" class="empty-icon" />
        <h3>Henüz proje yok</h3>
        <p>Yukarıdan bir prompt yaz, dosya yükle ya da şablon seç.</p>
      </div>
    </section>

    <!-- Supported formats (compact) -->
    <section class="section compact">
      <div class="section-header">
        <h2 class="section-title">
          <Icon name="lucide:circle-check" />
          Desteklenen formatlar
        </h2>
      </div>
      <div class="format-row">
        <div
          v-for="program in programs"
          :key="program.id"
          class="format-chip"
          :class="{ disabled: program.status === 'coming-soon' }"
          :title="program.status === 'coming-soon' ? 'Yakında' : 'Aktif'"
        >
          <span class="chip-name">{{ program.name }}</span>
          <span class="chip-format">{{ program.format }}</span>
        </div>
      </div>
    </section>

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
import { getAuth } from 'firebase/auth'

import { mockSupportedPrograms, formatTimeAgo } from '~/utils/mockData'
import { useAgentStore } from '~/stores/agent'
import { useProjectStore } from '~/stores/project'
import { useChatStore } from '~/stores/chat'
import { useAgent } from '~/composables/useAgent'
import { createProjectFromUpload } from '~/utils/projectFromUpload'

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Dashboard - Build2AI',
  description: 'Yapısal mühendislik AI asistanı',
})

const router = useRouter()
const agentStore = useAgentStore()
const projectStore = useProjectStore()
const chatStore = useChatStore()
const agent = useAgent()

const promptText = ref('')
const promptRef = ref<HTMLTextAreaElement | null>(null)
const showUpload = ref(false)
const showTemplateWizard = ref(false)
const uploadError = ref('')

const firstName = computed(() => {
  const u = getAuth().currentUser
  const d = u?.displayName
  if (d) return d.split(' ')[0]
  const email = u?.email
  if (email) return email.split('@')[0]
  return 'mühendis'
})

const recentProjects = computed(() => projectStore.recentProjects.slice(0, 10))
const programs = mockSupportedPrograms

onMounted(async () => {
  await projectStore.hydrate()
  // chatStore.hydrate() tek istek (stats) — başka yerden zaten tetiklendi
})

function handleOpenProject(id: string) {
  projectStore.openProject(id)
  router.push('/workspace')
}

async function submitPrompt() {
  const txt = promptText.value.trim()
  if (!txt) return
  await projectStore.startNewProjectWithPrompt(txt)
  chatStore.activeSessionId = null
  chatStore.messages = []
  promptText.value = ''
  router.push('/workspace?mode=new')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submitPrompt()
  }
}

function openUpload() {
  uploadError.value = ''
  showUpload.value = true
}
function closeUpload() {
  showUpload.value = false
  uploadError.value = ''
}
function handleUploadError(msg: string) {
  uploadError.value = msg
}
async function handleFileSelected(file: File) {
  try {
    await createProjectFromUpload(file, { projectStore, agent, router })
    closeUpload()
  } catch (err: any) {
    uploadError.value = err?.message ?? 'Dosya işlenemedi'
  }
}
</script>

<style scoped>
.dashboard {
  padding: 2rem 2rem 3rem;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

/* -------- Hero -------- */
.hero {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.hero-greeting { display: flex; flex-direction: column; gap: 0.25rem; }

.hero-title {
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin: 0;
}

.hero-subtitle {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
}

.hero-prompt {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem 0.625rem 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.hero-prompt:focus-within {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.prompt-icon {
  color: var(--accent-purple, #8b5cf6);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.prompt-icon :deep(svg) { width: 20px; height: 20px; }

.prompt-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--text-primary);
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.4;
  padding: 0;
  height: 24px;
  max-height: 120px;
  overflow-y: auto;
}
.prompt-input::placeholder {
  color: var(--text-muted);
}

.prompt-submit {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s, opacity 0.15s;
}
.prompt-submit:hover:not(:disabled) { transform: translateY(-1px); }
.prompt-submit:disabled { opacity: 0.3; cursor: not-allowed; }
.prompt-submit :deep(svg) { width: 18px; height: 18px; }

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}
.mini-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}
.mini-btn :deep(svg) { width: 15px; height: 15px; }

.agent-pill {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.375rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 999px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.agent-pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-green);
}
.agent-pill.connecting .dot { background: var(--accent-amber, #f59e0b); }
.agent-pill.disconnected .dot { background: var(--accent-red, #ef4444); }

/* -------- Sections -------- */
.section { display: flex; flex-direction: column; gap: 1rem; }
.section.compact { gap: 0.5rem; }

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.section-title :deep(svg) {
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}
.section-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  color: var(--accent-blue);
  text-decoration: none;
}
.section-link:hover { color: var(--text-primary); }
.section-link :deep(svg) { width: 14px; height: 14px; }

/* -------- Project cards -------- */
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.875rem;
}

.project-card {
  display: flex;
  flex-direction: column;
  padding: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.project-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-blue);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}

.card-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  border-bottom: 1px solid var(--border-default);
  overflow: hidden;
}

.card-format {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  color: #fff;
}

.card-body { padding: 0.75rem 0.875rem; }
.card-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}
.card-meta { font-size: 0.75rem; color: var(--text-muted); }

/* -------- Empty block -------- */
.empty-block {
  padding: 3rem 2rem;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px dashed var(--border-default);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.empty-icon { color: var(--text-muted); }
.empty-icon :deep(svg) { width: 36px; height: 36px; }
.empty-block h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text-primary); }
.empty-block p { margin: 0; font-size: 0.875rem; }

/* -------- Format chips -------- */
.format-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.format-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-size: 0.75rem;
}
.format-chip.disabled { opacity: 0.45; }
.chip-name { color: var(--text-primary); font-weight: 500; }
.chip-format {
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--text-muted);
}

/* -------- Upload modal (mevcutla uyumlu) -------- */
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
.upload-modal-body { padding: 1.25rem; }
.upload-error {
  margin-top: 0.75rem;
  padding: 0.625rem 0.875rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  color: var(--accent-red);
  font-size: 0.8125rem;
}

@media (max-width: 640px) {
  .dashboard { padding: 1rem; gap: 2rem; }
  .hero-title { font-size: 1.5rem; }
  .project-grid { grid-template-columns: repeat(2, 1fr); }
  .agent-pill { margin-left: 0; }
}
</style>
