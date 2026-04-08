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
          <p class="np-hint">İlk mesajınızı gönderdiğinizde proje kaydedilir.</p>
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

const router = useRouter()
const projectStore = useProjectStore()
const chatStore = useChatStore()

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

const confirm = () => {
  if (!name.value.trim()) return
  projectStore.startNewProjectDraft(name.value)
  // Chat panelini sıfırla
  chatStore.activeSessionId = null
  chatStore.messages = []
  router.push({ path: '/workspace', query: { mode: 'new' } })
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
