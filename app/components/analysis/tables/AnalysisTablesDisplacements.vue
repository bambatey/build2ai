<template>
  <div class="tbl-root">
    <div class="tbl-head">
      <h3>
        <Icon name="lucide:move" /> Deplasmanlar
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
          <tr><th>Düğüm</th><th>ux</th><th>uy</th><th>uz</th><th>rx</th><th>ry</th><th>rz</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in rows" :key="`${d.load_case}-${d.node_id}`">
            <td class="node-cell">
              <span class="node-id">{{ d.node_id }}</span>
              <span v-if="hasLabels(d)" class="node-labels">
                <span
                  v-if="axisLabel(d)"
                  class="node-aks"
                  :class="{ partial: isPartialAks(d) }"
                  :title="axisTitle(d)"
                >{{ axisLabel(d) }}</span>
                <span v-if="d.level" class="node-level">{{ d.level }}</span>
              </span>
            </td>
            <td :class="cellCls(d.ux, maxAbs.ux)">{{ fmtFloat(d.ux) }}</td>
            <td :class="cellCls(d.uy, maxAbs.uy)">{{ fmtFloat(d.uy) }}</td>
            <td :class="cellCls(d.uz, maxAbs.uz)">{{ fmtFloat(d.uz) }}</td>
            <td :class="cellCls(d.rx, maxAbs.rx)">{{ fmtFloat(d.rx) }}</td>
            <td :class="cellCls(d.ry, maxAbs.ry)">{{ fmtFloat(d.ry) }}</td>
            <td :class="cellCls(d.rz, maxAbs.rz)">{{ fmtFloat(d.rz) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="loading" class="tbl-state">
        <Icon name="lucide:loader-2" class="spin" /> Yükleniyor…
      </div>
      <div v-else class="tbl-state">
        <Icon name="lucide:inbox" /> Veri yok — analiz çalıştır veya farklı case seç.
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
const loading = computed(() =>
  analysisStore.isTableLoading(props.fileId, 'displacements'),
)
const rows = computed(() => analysisStore.filteredDisplacements(props.fileId))
const exporting = ref(false)

const maxAbs = computed(() => {
  const out = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }
  for (const d of rows.value) {
    if (Math.abs(d.ux) > out.ux) out.ux = Math.abs(d.ux)
    if (Math.abs(d.uy) > out.uy) out.uy = Math.abs(d.uy)
    if (Math.abs(d.uz) > out.uz) out.uz = Math.abs(d.uz)
    if (Math.abs(d.rx) > out.rx) out.rx = Math.abs(d.rx)
    if (Math.abs(d.ry) > out.ry) out.ry = Math.abs(d.ry)
    if (Math.abs(d.rz) > out.rz) out.rz = Math.abs(d.rz)
  }
  return out
})

function cellCls(v: number, max: number): string {
  if (!max) return ''
  const r = Math.abs(v) / max
  if (r > 0.9) return 'heat-high'
  if (r > 0.5) return 'heat-mid'
  return ''
}

async function ensureLoaded() {
  if (currentId.value) {
    await analysisStore.loadDisplacements(
      props.projectId, props.fileId, currentId.value,
    )
  }
}

async function download() {
  if (!currentId.value || !selectedCase.value) return
  exporting.value = true
  try {
    const api = await import('~/utils/analysisApi')
    const url = api.exportDisplacementsXlsxUrl(
      props.projectId, props.fileId, currentId.value, selectedCase.value,
    )
    await api.downloadXlsx(url, `displacements_${selectedCase.value}.xlsx`)
  } catch (e) { console.error('[Export]', e) }
  finally { exporting.value = false }
}

watch(currentId, ensureLoaded)
onMounted(ensureLoaded)
</script>

<style scoped>
@import './tables-shared.css';
</style>
