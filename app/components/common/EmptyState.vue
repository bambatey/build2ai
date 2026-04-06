<template>
  <div class="empty-state">
    <div class="icon-container mb-6">
      <Icon :name="icon" class="w-16 h-16 text-[var(--text-muted)]" />
    </div>

    <h3 class="text-xl font-semibold text-primary mb-2">{{ title }}</h3>
    <p class="text-sm text-secondary mb-6 max-w-md">{{ description }}</p>

    <div v-if="action" class="action-container">
      <button @click="action.onClick" class="btn btn-primary">
        <Icon v-if="action.icon" :name="action.icon" class="w-4 h-4" />
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description: string
    action?: {
      label: string
      icon?: string
      onClick: () => void
    }
  }>(),
  {
    icon: 'lucide:inbox',
  }
)
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 3rem;
  padding-bottom: 3rem;
  text-align: center;
  min-height: 300px;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 6rem;
  height: 6rem;
  border-radius: 9999px;
  background-color: var(--bg-tertiary);
}
</style>
