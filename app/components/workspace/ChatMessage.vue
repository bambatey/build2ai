<template>
  <div class="chat-message" :class="messageClass">
    <!-- Avatar -->
    <div class="message-avatar" :class="message.role">
      <Icon :name="message.role === 'user' ? 'lucide:user' : 'lucide:sparkles'" />
    </div>

    <!-- Content -->
    <div class="message-content">
      <!-- Header -->
      <div class="message-header">
        <span class="message-role">{{ message.role === 'user' ? 'Siz' : 'AI' }}</span>
        <span class="message-time">{{ formatTime(message.timestamp) }}</span>
      </div>

      <!-- Text Content -->
      <div v-if="!message.isLoading" class="message-text" v-html="renderedContent" />

      <!-- Loading Skeleton -->
      <div v-else class="loading-skeleton">
        <div class="skeleton-line" />
        <div class="skeleton-line short" />
      </div>

      <!-- Diff Viewer -->
      <div v-if="message.diff && message.diff.length > 0" class="diff-section">
        <button @click="showDiff = !showDiff" class="diff-toggle">
          <Icon name="lucide:code-2" />
          <span>{{ showDiff ? 'Değişiklikleri Gizle' : 'Değişiklikleri Gör' }}</span>
        </button>

        <div v-if="showDiff" class="diff-content">
          <WorkspaceDiffViewer :diffs="message.diff" />
        </div>

        <!-- Actions -->
        <div v-if="message.role === 'assistant'" class="message-actions">
          <template v-if="!applied">
            <button @click="handleApply" class="action-btn primary">
              <Icon name="lucide:check" />
              Uygula
            </button>
            <button @click="handleReject" class="action-btn secondary">
              <Icon name="lucide:x" />
              Reddet
            </button>
          </template>
          <span v-else class="applied-badge">
            <Icon name="lucide:check-circle" />
            Uygulandı
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import type { ChatMessage } from '~/stores/chat'
import { useProjectStore } from '~/stores/project'

const props = defineProps<{
  message: ChatMessage
}>()

const projectStore = useProjectStore()
const showDiff = ref(false)
const applied = ref(false)

const messageClass = computed(() => ({
  'user-message': props.message.role === 'user',
  'ai-message': props.message.role === 'assistant',
}))

const renderedContent = computed(() => {
  try {
    return marked.parse(props.message.content)
  } catch (error) {
    return props.message.content
  }
})

const formatTime = (date: Date) => {
  return new Date(date).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleApply = async () => {
  if (!props.message.diff || !props.message.diff.length || applied.value) return

  let content = projectStore.modifiedContent || projectStore.originalContent
  if (!content) {
    console.error('[Chat] Uygulama başarısız: dosya içeriği yok')
    return
  }

  console.log('[Chat] Değişiklik uygulanıyor:', props.message.diff.length, 'satır')
  console.log('[Chat] Diff verileri:', JSON.stringify(props.message.diff))

  const lines = content.split('\n')

  // Satır numarasına göre ters sırala (alttan üste uygula, index kaymasını önle)
  const sortedDiffs = [...props.message.diff].sort((a, b) => b.lineNumber - a.lineNumber)

  for (const diff of sortedDiffs) {
    const idx = diff.lineNumber - 1
    if (idx >= 0 && idx < lines.length) {
      console.log(`[Chat] Satır ${diff.lineNumber}: "${lines[idx].trim()}" → "${diff.newValue.trim()}"`)
      lines[idx] = diff.newValue
    } else {
      console.warn(`[Chat] Satır ${diff.lineNumber} dosya dışında (toplam ${lines.length} satır)`)
    }
  }

  const updatedContent = lines.join('\n')

  // 1. Store'u güncelle — editör ve 3D view bunu dinliyor
  projectStore.originalContent = updatedContent
  projectStore.modifiedContent = updatedContent
  if (projectStore.currentFile) {
    projectStore.currentFile.content = updatedContent
  }
  // Projedeki dosyayı da güncelle (3D view activeProject.files'a bakıyor)
  if (projectStore.activeProject) {
    const file = projectStore.activeProject.files.find(f => f.id === projectStore.currentFile?.id)
    if (file) {
      file.content = updatedContent
    }
  }

  // 2. Backend'e kaydet
  if (projectStore.activeProjectId && projectStore.currentFile?.id) {
    await projectStore.saveFileToBackend(
      projectStore.activeProjectId,
      projectStore.currentFile.id,
      updatedContent,
    )
    console.log('[Chat] Dosya backend\'e kaydedildi')
  }

  applied.value = true
}

const handleReject = () => {
  applied.value = true
}
</script>

<style scoped>
.chat-message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  animation: slideIn 0.3s ease-out;
}

@media (min-width: 768px) {
  .chat-message {
    margin-bottom: 1.5rem;
  }
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar.user {
  background: rgba(59, 130, 246, 0.1);
  color: var(--accent-blue);
}

.message-avatar.assistant {
  background: rgba(139, 92, 246, 0.1);
  color: var(--accent-purple);
}

.message-avatar :deep(svg) {
  width: 16px;
  height: 16px;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.message-role {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.message-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.message-text {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-primary);
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
}

@media (min-width: 768px) {
  .message-text {
    font-size: 0.9375rem;
  }
}

.message-text :deep(p) {
  margin-bottom: 0.75rem;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text :deep(code) {
  background: var(--bg-tertiary);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem;
}

.message-text :deep(pre) {
  background: var(--bg-tertiary);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.message-text :deep(pre code) {
  background: none;
  padding: 0;
}

.message-text :deep(ul),
.message-text :deep(ol) {
  margin-left: 1.5rem;
  margin-bottom: 0.75rem;
}

.message-text :deep(strong) {
  font-weight: 600;
  color: var(--accent-green);
}

/* Loading Skeleton */
.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line.short {
  width: 60%;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Diff Section */
.diff-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-default);
}

.diff-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.diff-toggle:hover {
  background: var(--bg-elevated);
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.diff-content {
  margin-top: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid var(--border-default);
  overflow-x: auto;
}

/* Actions */
.message-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .action-btn {
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
  }
}

.action-btn.primary {
  background: var(--accent-blue);
  color: white;
}

.action-btn.primary:hover {
  background: #2563EB;
}

.action-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
}

.action-btn.secondary:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.action-btn :deep(svg) {
  width: 14px;
  height: 14px;
}

.applied-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--accent-green);
  font-weight: 500;
}

.applied-badge :deep(svg) {
  width: 14px;
  height: 14px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
