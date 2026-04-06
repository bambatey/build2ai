<template>
  <div class="project-list">
    <!-- Search and Filter -->
    <div class="list-header flex items-center gap-4 mb-6">
      <!-- Search -->
      <div class="search-box flex-1 relative">
        <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Proje ara..."
          class="input pl-10 w-full"
        />
      </div>

      <!-- Filter -->
      <select v-model="filterFormat" class="input w-48">
        <option value="">Tüm Formatlar</option>
        <option value=".s2k">SAP2000 (.s2k)</option>
        <option value=".e2k">ETABS (.e2k)</option>
        <option value=".r3d">RISA-3D (.r3d)</option>
        <option value=".std">STAAD Pro (.std)</option>
      </select>

      <!-- Sort -->
      <select v-model="sortBy" class="input w-48">
        <option value="recent">Son Değişiklik</option>
        <option value="name">İsim</option>
        <option value="progress">İlerleme</option>
      </select>
    </div>

    <!-- Project Grid -->
    <div v-if="filteredProjects.length > 0" class="projects-grid grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <ProjectsProjectCard
        v-for="project in filteredProjects"
        :key="project.id"
        :project="project"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <CommonEmptyState
        icon="lucide:folder-search"
        title="Proje bulunamadı"
        description="Arama kriterlerinize uygun proje bulunamadı"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Project } from '~/stores/project'

const props = defineProps<{
  projects: Project[]
}>()

const searchQuery = ref('')
const filterFormat = ref('')
const sortBy = ref('recent')

const filteredProjects = computed(() => {
  let result = [...props.projects]

  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  // Filter by format
  if (filterFormat.value) {
    result = result.filter(p => p.format === filterFormat.value)
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'progress':
        return b.progress - a.progress
      case 'recent':
      default:
        return b.lastModified.getTime() - a.lastModified.getTime()
    }
  })

  return result
})
</script>

<style scoped>
.projects-grid {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
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
