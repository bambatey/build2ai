<template>
  <div class="analysis-page">
    <AnalysisHeader
      :project-id="projectId"
      :file-id="fileId"
      :file-name="fileName"
      @back="goBack"
    />

    <div class="analysis-body">
      <AnalysisSidebar
        v-model:active="activeTable"
        :file-id="fileId"
      />
      <main class="analysis-main">
        <Transition name="fade" mode="out-in">
          <AnalysisSummaryView
            v-if="activeTable === 'summary'"
            key="summary"
            :file-id="fileId"
          />
          <AnalysisTablesDisplacements
            v-else-if="activeTable === 'displacements'"
            key="disp"
            :project-id="projectId"
            :file-id="fileId"
          />
          <AnalysisTablesReactions
            v-else-if="activeTable === 'reactions'"
            key="reac"
            :project-id="projectId"
            :file-id="fileId"
          />
          <AnalysisTablesForces
            v-else-if="activeTable === 'forces'"
            key="force"
            :project-id="projectId"
            :file-id="fileId"
          />
          <AnalysisTablesModes
            v-else-if="activeTable === 'modes'"
            key="modes"
            :project-id="projectId"
            :file-id="fileId"
          />
        </Transition>
      </main>
    </div>

    <AnalysisChatPopup />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAnalysisStore } from '~/stores/analysis'
import { useProjectStore } from '~/stores/project'

definePageMeta({ layout: 'default' })

type TableView = 'summary' | 'displacements' | 'reactions' | 'forces' | 'modes'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const analysisStore = useAnalysisStore()

const projectId = computed(() => String(route.params.projectId))
const fileId = computed(() => String(route.params.fileId))
const activeTable = ref<TableView>('summary')

const fileName = computed(() => {
  const f = projectStore.currentFile
  return f && f.id === fileId.value ? f.name : fileId.value
})

async function hydrate() {
  if (!projectId.value || !fileId.value) return
  // Proje aktif değilse (sayfaya direkt link ile gelindi) ayarla
  if (projectStore.activeProjectId !== projectId.value) {
    await projectStore.openProject(projectId.value)
  }
  await analysisStore.refreshHistory(projectId.value, fileId.value)
}

function goBack() {
  router.push('/workspace')
}

watch(fileId, hydrate, { immediate: false })
onMounted(hydrate)
</script>

<style scoped>
.analysis-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.analysis-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.analysis-main {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
  position: relative;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
