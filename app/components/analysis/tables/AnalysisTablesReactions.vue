<template>
  <div class="tbl-root">
    <div class="tbl-head">
      <h3>
        <Icon name="lucide:anchor" /> Reaksiyonlar
        <span class="count">{{ rows.length }}</span>
      </h3>
      <button
        class="export-btn"
        :disabled="exporting || !selectedCase || !currentId"
        @click="download"
      >
        <Icon :name="exporting ? 'lucide:loader-2' : 'lucide:file-spreadsheet'"
              :class="{ spin: exporting }" />
        Excel ({{ selectedCase || '—' }})
      </button>
    </div>

    <div class="tbl-wrap">
      <table v-if="!loading && rows.length > 0" class="tbl">
        <thead>
          <tr><th>Mesnet</th><th>Fx</th><th>Fy</th><th>Fz</th><th>Mx</th><th>My</th><th>Mz</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="`${r.load_case}-${r.node_id}`">
            <td class="node-cell">
              <span class="node-id">{{ r.node_id }}</span>
              <span v-if="hasLabels(r)" class="node-labels">
                <span
                  v-if="axisLabel(r)"
                  class="node-aks"
                  :class="{ partial: isPartialAks(r) }"
                  :title="axisTitle(r)"
                >{{ axisLabel(r) }}</span>
                <span v-if="r.level" class="node-level">{{ r.level }}</span>
              </span>
            </td>
            <td>{{ fmtFloat(r.fx) }}</td>
            <td>{{ fmtFloat(r.fy) }}</td>
            <td :class="r.fz > 0 ? 'positive' : ''">{{ fmtFloat(r.fz) }}</td>
            <td>{{ fmtFloat(r.mx) }}</td>
            <td>{{ fmtFloat(r.my) }}</td>
            <td>{{ fmtFloat(r.mz) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="loading" class="tbl-state">
        <Icon name="lucide:loader-2" class="spin" /> Yükleniyor…
      </div>
      <div v-else class="tbl-state">
        <Icon name="lucide:inbox" /> Veri yok.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'
import {
  axisLabel, axisTitle, fmtFloat, hasLabels, isPartialAks,
} from '~/composables/useNodeLabels'

const props = defineProps<{ projectId: string; fileId: string }>()

const analysisStore = useAnalysisStore()
const fileState = computed(() => analysisStore.current(props.fileId))
const currentId = computed(() => fileState.value.currentId)
const selectedCase = computed(() => fileState.value.selectedLoadCase)
const loading = computed(() => analysisStore.isTableLoading(props.fileId, 'reactions'))
const rows = computed(() => analysisStore.filteredReactions(props.fileId))
const exporting = ref(false)

async function ensureLoaded() {
  if (currentId.value) {
    await analysisStore.loadReactions(props.projectId, props.fileId, currentId.value)
  }
}

async function download() {
  if (!currentId.value || !selectedCase.value) return
  exporting.value = true
  try {
    const api = await import('~/utils/analysisApi')
    const url = api.exportReactionsXlsxUrl(
      props.projectId, props.fileId, currentId.value, selectedCase.value,
    )
    await api.downloadXlsx(url, `reactions_${selectedCase.value}.xlsx`)
  } catch (e) { console.error('[Export]', e) }
  finally { exporting.value = false }
}

watch(currentId, ensureLoaded)
onMounted(ensureLoaded)
</script>

<style scoped>
@import './tables-shared.css';
.positive { color: var(--accent-green); }
</style>
