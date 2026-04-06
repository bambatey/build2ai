<template>
  <div class="chat-input">
    <!-- Textarea -->
    <div class="input-wrapper">
      <textarea
        ref="textareaRef"
        v-model="message"
        placeholder="Mesajınızı yazın... (Shift+Enter ile yeni satır)"
        class="message-input"
        rows="1"
        @keydown.enter="handleKeyDown"
        @input="adjustHeight"
      />

      <!-- Send Button -->
      <button
        @click="handleSend"
        :disabled="!canSend"
        class="send-btn"
        title="Gönder"
      >
        <Icon name="lucide:send" />
      </button>
    </div>

    <!-- Actions Row -->
    <div class="actions-row">
      <button
        v-for="action in actions"
        :key="action.id"
        @click="action.onClick"
        class="action-btn"
        :title="action.tooltip"
      >
        <Icon :name="action.icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  send: [message: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const message = ref('')

const canSend = computed(() => message.value.trim().length > 0)

const actions = [
  {
    id: 'attach',
    icon: 'lucide:paperclip',
    tooltip: 'Dosya ekle',
    onClick: () => console.log('Dosya ekle'),
  },
  {
    id: 'analyze',
    icon: 'lucide:scan-search',
    tooltip: 'Model analiz et',
    onClick: () => {
      message.value = 'Bu modeli detaylı analiz et ve bir rapor çıkar.'
    },
  },
]

const handleSend = () => {
  if (canSend.value) {
    emit('send', message.value)
    message.value = ''
    adjustHeight()
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const adjustHeight = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = `${Math.min(textareaRef.value.scrollHeight, 120)}px`
  }
}
</script>

<style scoped>
.chat-input {
  padding: 1rem;
  border-top: 1px solid var(--border-default);
  background: var(--bg-primary);
}

.input-wrapper {
  position: relative;
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  resize: none;
  max-height: 120px;
  overflow-y: auto;
  transition: all 0.2s;
  font-family: inherit;
  line-height: 1.5;
}

.message-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  background: var(--bg-elevated);
}

.message-input::placeholder {
  color: var(--text-muted);
}

.send-btn {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: var(--accent-blue);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #2563EB;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn :deep(svg) {
  width: 18px;
  height: 18px;
}

.actions-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.action-btn :deep(svg) {
  width: 16px;
  height: 16px;
}
</style>
