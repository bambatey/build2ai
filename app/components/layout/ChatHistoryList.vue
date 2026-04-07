<template>
  <div class="chat-history">
    <div class="history-header">
      <span class="history-label">SOHBETLER</span>
      <button type="button" class="new-chat-btn" title="Yeni sohbet" @click="handleNewChat">
        <Icon name="lucide:plus" />
      </button>
    </div>

    <div class="history-list">
      <div v-if="sessions.length === 0" class="history-empty">
        Henüz sohbet yok
      </div>

      <div
        v-for="session in sessions"
        :key="session.id"
        class="history-item"
        :class="{ active: session.id === chatStore.activeSessionId }"
        role="button"
        tabindex="0"
        @click="handleSwitch(session.id)"
        @keydown.enter="handleSwitch(session.id)"
      >
        <Icon name="lucide:message-square" class="item-icon" />
        <span class="item-name">{{ session.name }}</span>
        <button
          type="button"
          class="item-delete"
          title="Sil"
          @click.stop="handleDelete(session.id)"
        >
          <Icon name="lucide:trash-2" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '~/stores/chat'
import { useProjectStore } from '~/stores/project'

const router = useRouter()
const chatStore = useChatStore()
const projectStore = useProjectStore()

const sessions = computed(() => {
  if (!projectStore.activeProjectId) return []
  return chatStore.sessionsByProject(projectStore.activeProjectId)
})

const handleNewChat = () => {
  if (!projectStore.activeProjectId) return
  chatStore.createChat(projectStore.activeProjectId)
  if (router.currentRoute.value.path !== '/workspace') {
    router.push('/workspace')
  }
}

const handleSwitch = (id: string) => {
  chatStore.switchChat(id)
  if (router.currentRoute.value.path !== '/workspace') {
    router.push('/workspace')
  }
}

const handleDelete = (id: string) => {
  chatStore.deleteChat(id)
  // Eğer hâlâ proje açıksa ve oturum kalmadıysa yenisini oluştur
  if (projectStore.activeProjectId && sessions.value.length === 0) {
    chatStore.createChat(projectStore.activeProjectId)
  }
}
</script>

<style scoped>
.chat-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0.75rem 0.5rem;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem 0.5rem;
}

.history-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.new-chat-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.new-chat-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.new-chat-btn :deep(svg) {
  width: 12px;
  height: 12px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.history-empty {
  padding: 1rem 0.75rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.history-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  transition: all 0.15s;
  position: relative;
}

.history-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.history-item.active {
  background: var(--bg-tertiary);
  color: var(--accent-blue);
}

.item-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-delete {
  display: none;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}

.item-delete:hover {
  color: var(--accent-red);
}

.item-delete :deep(svg) {
  width: 14px;
  height: 14px;
}

.history-item:hover .item-delete {
  display: flex;
}
</style>
