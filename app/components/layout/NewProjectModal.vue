<template>
  <Teleport to="body">
    <div
      v-if="projectStore.isNewProjectModalOpen"
      class="np-overlay"
      @click.self="cancel"
    >
      <div class="np-modal">
        <div class="np-header">
          <h3 class="np-title">Yeni Proje</h3>
          <button type="button" class="np-close" @click="cancel">
            <Icon name="lucide:x" />
          </button>
        </div>
        <div class="np-body">
          <label class="np-label">Proje adı</label>
          <input
            ref="inputEl"
            v-model="name"
            type="text"
            class="np-input"
            placeholder="örn. Bina_Model_v4"
            @keydown.enter="confirm"
            @keydown.escape="cancel"
          />
          <p v-if="agent.connected.value && agent.root.value" class="np-hint">
            Boş bir <code>{{ name.trim() || '...' }}.s2k</code> dosyası
            <strong>{{ agent.root.value }}</strong> içine yazılacak.
          </p>
          <p v-else class="np-hint">
            Agent bağlı değil — proje sadece tarayıcıda tutulacak.
          </p>
          <p v-if="writeError" class="np-error">{{ writeError }}</p>
        </div>
        <div class="np-footer">
          <button type="button" class="btn btn-secondary" @click="cancel">İptal</button>
          <button type="button" class="btn btn-primary" :disabled="!name.trim()" @click="confirm">
            Devam et
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '~/stores/project'
import { useChatStore } from '~/stores/chat'
import { useAgent } from '~/composables/useAgent'

const router = useRouter()
const projectStore = useProjectStore()
const chatStore = useChatStore()
const agent = useAgent()

const writeError = ref('')

const name = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => projectStore.isNewProjectModalOpen,
  async (open) => {
    if (open) {
      name.value = ''
      await nextTick()
      inputEl.value?.focus()
    }
  },
)

const cancel = () => {
  projectStore.cancelNewProject()
}

const confirm = async () => {
  const cleanName = name.value.trim()
  if (!cleanName) return
  writeError.value = ''
  projectStore.startNewProjectDraft(cleanName)

  // Eğer agent bağlı ve klasör seçili ise dosyayı diske yaz.
  let storedAt: string | undefined
  if (agent.connected.value && agent.root.value) {
    const fileName = `${cleanName}.s2k`
    try {
      // Boş şablon içerik — store ile aynı format.
      const content = [
        `$ File: ${fileName}`,
        '$ Program: SAP2000',
        '$ Version: 26.0.0',
        '$ Units: kN, m, C',
        '',
        'TABLE:  "PROGRAM INFORMATION"',
        '   ProgramName=SAP2000   Version=26.0.0',
        '',
        'TABLE:  "JOINT COORDINATES"',
        '',
        'TABLE:  "CONNECTIVITY - FRAME"',
        '',
        'TABLE:  "CONNECTIVITY - AREA"',
        '',
        'END TABLE DATA',
        '',
      ].join('\n')
      const written = await agent.writeFile(fileName, content)
      storedAt = written.path
      await agent.refreshFiles()
    } catch (err: any) {
      writeError.value = err?.message ?? 'Agent yazma hatası'
      // Bu durumda projeyi yine de in-memory oluşturalım, sadece hata göster.
    }
  }

  const project = await projectStore.commitPendingProject({ storedAt })
  chatStore.activeSessionId = null
  chatStore.messages = []
  if (project) {
    await chatStore.createChat(project.id)
  }
  // Modal'ı en son kapat — async işlemler bittikten sonra
  projectStore.isNewProjectModalOpen = false
  router.push('/workspace')
}
</script>

<style scoped>
.np-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 1rem;
}

.np-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.np-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-default);
}

.np-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.np-close {
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

.np-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.np-body {
  padding: 1.25rem;
}

.np-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.np-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
}

.np-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.np-hint {
  margin-top: 0.625rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.5;
  word-break: break-word;
}

.np-hint code {
  background: var(--bg-tertiary);
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.np-hint strong {
  color: var(--text-secondary);
  font-weight: 500;
}

.np-error {
  margin-top: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--accent-red);
  border-radius: 6px;
  color: var(--accent-red);
  font-size: 0.75rem;
}

.np-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--border-default);
  background: var(--bg-primary);
}

.np-footer .btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}

.np-footer .btn-primary {
  background: var(--accent-blue);
  color: white;
}

.np-footer .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.np-footer .btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.np-footer .btn-secondary:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
</style>
