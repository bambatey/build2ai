<template>
  <NuxtLink
    :to="`/projects/${project.id}`"
    class="project-card card hover:border-[var(--accent-blue)] transition-all group"
  >
    <!-- Header -->
    <div class="card-header flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="project-icon">
          <Icon name="lucide:folder" class="w-6 h-6 text-[var(--accent-blue)]" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary group-hover:text-[var(--accent-blue)] transition-colors">
            {{ project.name }}
          </h3>
          <div class="flex items-center gap-2 text-xs text-secondary mt-1">
            <CommonFormatBadge :format="project.format" />
            <span>·</span>
            <span>{{ project.fileCount }} dosya</span>
            <span>·</span>
            <span>{{ formatTimeAgo(project.lastModified) }}</span>
          </div>
        </div>
      </div>

      <!-- Menu Button -->
      <button class="btn btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Icon name="lucide:more-vertical" class="w-4 h-4" />
      </button>
    </div>

    <!-- Progress Bar -->
    <div class="progress-section mb-3">
      <div class="flex items-center justify-between text-xs text-secondary mb-2">
        <span>İlerleme</span>
        <span class="font-mono">%{{ project.progress }}</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width: `${project.progress}%`,
            backgroundColor: getProgressColor(project.progress),
          }"
        />
      </div>
    </div>

    <!-- Tags -->
    <div class="tags-section flex flex-wrap gap-2">
      <span
        v-for="tag in project.tags"
        :key="tag"
        class="badge"
      >
        {{ tag }}
      </span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { formatTimeAgo } from '~/utils/mockData'
import type { Project } from '~/stores/project'

defineProps<{
  project: Project
}>()

const getProgressColor = (progress: number) => {
  if (progress >= 80) return 'var(--accent-green)'
  if (progress >= 50) return 'var(--accent-blue)'
  if (progress >= 25) return 'var(--accent-amber)'
  return 'var(--accent-red)'
}
</script>

<style scoped>
.project-card {
  cursor: pointer;
}

.project-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-bar {
  height: 6px;
  background-color: var(--bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 500ms ease, background-color 300ms ease;
  border-radius: 3px;
}
</style>
