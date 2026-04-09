<template>
  <div class="quick-start card">
    <h3 class="text-lg font-semibold mb-4">Hızlı Başla</h3>

    <div class="actions space-y-3">
      <button
        v-for="action in quickActions"
        :key="action.id"
        @click="action.onClick"
        class="action-btn w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] transition-all group"
      >
        <div class="action-icon" :style="{ backgroundColor: `${action.color}20` }">
          <Icon :name="action.icon" class="w-5 h-5" :style="{ color: action.color }" />
        </div>

        <div class="action-content flex-1 text-left">
          <p class="action-title text-sm font-medium text-primary">{{ action.title }}</p>
          <p class="action-desc text-xs text-secondary mt-0.5">{{ action.description }}</p>
        </div>

        <Icon name="lucide:chevron-right" class="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
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
import { ref } from 'vue'
import { useProjectStore } from '~/stores/project'
import type { Project } from '~/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

const showUpload = ref(false)
const showTemplateWizard = ref(false)
const uploadError = ref('')

const startNew = () => {
  projectStore.closeProject()
  router.push({ path: '/workspace', query: { mode: 'new' } })
}

const openUpload = () => {
  uploadError.value = ''
  showUpload.value = true
}

const closeUpload = () => {
  showUpload.value = false
  uploadError.value = ''
}

const handleUploadError = (msg: string) => {
  uploadError.value = msg
}

const handleFileSelected = async (file: File) => {
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const baseName = file.name.replace(/\.[^.]+$/, '')
  const id = crypto.randomUUID()

  let content = ''
  try {
    content = await file.text()
  } catch {
    uploadError.value = 'Dosya okunamadı'
    return
  }

  const project: Project = {
    id,
    name: baseName,
    format: ext,
    fileCount: 1,
    lastModified: new Date(),
    progress: 0,
    tags: [],
    files: [
      {
        id: crypto.randomUUID(),
        name: file.name,
        type: 'file',
        path: `/${baseName}/${file.name}`,
        format: ext,
        size: file.size,
        lastModified: new Date(),
        content,
      },
    ],
  }

  projectStore.addProject(project)
  projectStore.openProject(id)
  closeUpload()
  router.push('/workspace')
}

const quickActions = [
  {
    id: 'upload',
    title: 'Dosya Yükle',
    description: 'SAP2000, ETABS veya diğer analiz dosyalarını yükle',
    icon: 'lucide:upload',
    color: 'var(--accent-blue)',
    onClick: openUpload,
  },
  {
    id: 'new-session',
    title: 'Yeni Proje',
    description: 'AI asistan ile yeni bir analiz oturumu başlat',
    icon: 'lucide:plus-circle',
    color: 'var(--accent-purple)',
    onClick: startNew,
  },
  {
    id: 'template',
    title: 'Şablon Seç',
    description: 'Hazır model şablonlarından birini seç ve düzenle',
    icon: 'lucide:layout-template',
    color: 'var(--accent-green)',
    onClick: () => {
      showTemplateWizard.value = true
    },
  },
]
</script>

<style scoped>
.action-btn {
  cursor: pointer;
  border: 1px solid transparent;
  text-align: left;
}

.action-btn:hover {
  border-color: var(--border-active);
}

.action-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
