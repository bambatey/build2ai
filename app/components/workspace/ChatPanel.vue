<template>
  <div class="chat-panel">
    <!-- Chat Header -->
    <!-- Quick Commands -->
    <div class="quick-commands">
      <button
        v-for="command in chatStore.quickCommands"
        :key="command.id"
        @click="handleQuickCommand(command)"
        class="quick-cmd-btn"
      >
        {{ command.label }}
      </button>
    </div>

    <!-- Messages Area -->
    <div ref="messagesContainer" class="messages-area">
      <!-- Welcome Message -->
      <div v-if="chatStore.messages.length === 0" class="welcome-message">
          <Icon name="lucide:sparkles" />

        <h4 class="welcome-title">Merhaba!</h4>
        <p class="welcome-text">
          Dosyanızı yükleyin veya bir komut verin. 
        </p>
      </div>

      <!-- Messages -->
      <WorkspaceChatMessage
        v-for="message in chatStore.messages"
        :key="message.id"
        :message="message"
      />

      <!-- Typing Indicator -->
      <div v-if="chatStore.isLoading" class="typing-indicator">
        <div class="typing-dots">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
        </div>
        <span class="typing-text">AI düşünüyor...</span>
      </div>
    </div>

    <!-- Chat Input -->
    <WorkspaceChatInput @send="handleSendMessage" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChatStore } from '~/stores/chat'

const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement | null>(null)

watch(() => chatStore.messages.length, async () => {
  await nextTick()
  scrollToBottom()
})

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const handleSendMessage = (content: string) => {
  chatStore.sendMessage(content)
}

const handleQuickCommand = (command: any) => {
  chatStore.sendMessage(command.prompt)
}
</script>

<style scoped>
.chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

/* Header */
.chat-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-default);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.model-select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.model-select:hover {
  border-color: var(--border-active);
}

.model-select:focus {
  outline: none;
  border-color: var(--accent-blue);
}

/* Quick Commands */
.quick-commands {
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
  background: var(--bg-primary);
  min-height: 52px;
  min-width: 0;
}

.quick-commands::-webkit-scrollbar {
  display: none;
}

.quick-cmd-btn {
  padding: 0.5rem 0.875rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
}

@media (min-width: 768px) {
  .quick-cmd-btn {
    padding: 0.5rem 1.125rem;
    font-size: 0.8125rem;
  }
}

.quick-cmd-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--accent-blue);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

/* Messages Area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  scroll-behavior: smooth;
  display: block;
  min-width: 0;
}

.messages-area::-webkit-scrollbar {
  width: 6px;
}

/* Welcome Message */
.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1.5rem;
  min-height: 100%;
}

@media (min-width: 768px) {
  .welcome-message {
    padding: 8rem 2rem;
  }
}

.welcome-icon {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 12px;
  color: var(--accent-purple);
  margin-bottom: 1rem;
  opacity: 0.3;
}

.welcome-icon :deep(svg) {
  width: 3rem;
  height: 3rem;
}

.welcome-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.welcome-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  max-width: 280px;
  line-height: 1.6;
}

/* Typing Indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border-radius: 8px;
  width: fit-content;
  max-width: 100%;
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-purple);
  animation: typing 1.4s infinite;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-4px);
  }
}
</style>
