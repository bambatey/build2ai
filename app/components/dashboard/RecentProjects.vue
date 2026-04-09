<template>
  <div class="recent-projects card">
    <div class="card-header flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold">Son Projeler</h3>
      <NuxtLink to="/projects" class="text-sm text-[var(--accent-blue)] hover:underline">
        Tümünü Gör →
      </NuxtLink>
    </div>

    <div v-if="projects.length === 0" class="empty-state py-8">
      <CommonEmptyState
        icon="lucide:folder-open"
        title="Henüz proje yok"
        description="İlk projenizi oluşturmak için dosya yükleyin"
      />
    </div>

    <div v-else class="projects-list space-y-3">
      <button
        v-for="project in projects"
        :key="project.id"
        type="button"
        @click="handleOpen(project.id)"
        class="project-item flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-all group w-full text-left"
      >
        <div class="project-icon">
          <Icon name="lucide:folder" class="w-5 h-5 text-[var(--accent-blue)]" />
        </div>

        <div class="project-info flex-1 min-w-0">
          <p class="project-name text-sm font-medium text-primary truncate">
            {{ project.name }}
          </p>
          <div class="project-meta flex items-center gap-2 text-xs text-secondary mt-1">
            <CommonFormatBadge :format="project.format" />
            <span>·</span>
            <span>{{ formatTimeAgo(project.lastModified) }}</span>
          </div>
        </div>

        <Icon name="lucide:chevron-right" class="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatTimeAgo } from '~/utils/mockData'
import { useProjectStore } from '~/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

const projects = computed(() => projectStore.recentProjects.slice(0, 5))

const handleOpen = (id: string) => {
  projectStore.openProject(id)
  router.push('/workspace')
}
</script>

<style scoped>
.project-item {
  cursor: pointer;
  border: 1px solid transparent;
}

.project-item:hover {
  border-color: var(--border-active);
}

.project-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background-color: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
