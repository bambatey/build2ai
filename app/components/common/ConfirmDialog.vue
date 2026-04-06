<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="isOpen" class="dialog-overlay" @click="handleOverlayClick">
        <div class="dialog-container" @click.stop>
          <!-- Header -->
          <div class="dialog-header">
            <h3 class="dialog-title">{{ title }}</h3>
            <button @click="handleCancel" class="dialog-close-btn">
              <Icon name="lucide:x" class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="dialog-body">
            <p class="text-secondary">{{ message }}</p>
          </div>

          <!-- Footer -->
          <div class="dialog-footer">
            <button @click="handleCancel" class="btn btn-secondary">
              {{ cancelText }}
            </button>
            <button
              @click="handleConfirm"
              class="btn"
              :class="variant === 'danger' ? 'btn-danger' : 'btn-primary'"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: 'primary' | 'danger'
  }>(),
  {
    title: 'Onay',
    confirmText: 'Onayla',
    cancelText: 'İptal',
    variant: 'primary',
  }
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const isOpen = ref(false)

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

const handleConfirm = () => {
  emit('confirm')
  close()
}

const handleCancel = () => {
  emit('cancel')
  close()
}

const handleOverlayClick = () => {
  handleCancel()
}

defineExpose({ open, close })
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.dialog-container {
  background-color: var(--bg-secondary);
  border-radius: 0.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 28rem;
  border: 1px solid var(--border-default);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  padding-bottom: 1rem;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.dialog-close-btn {
  padding: 0.25rem;
  border-radius: 0.25rem;
  color: var(--text-muted);
  transition: all 150ms;
}

.dialog-close-btn:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.dialog-body {
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  padding-bottom: 1rem;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-default);
}

/* Transitions */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 200ms ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog-container,
.dialog-leave-active .dialog-container {
  transition: transform 200ms ease;
}

.dialog-enter-from .dialog-container,
.dialog-leave-to .dialog-container {
  transform: scale(0.95);
}
</style>
