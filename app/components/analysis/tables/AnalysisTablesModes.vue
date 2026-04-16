<template>
  <div class="tbl-root">
    <div class="tbl-head">
      <h3>
        <Icon name="lucide:waves" /> Modlar
        <span class="count">{{ rows.length }}</span>
      </h3>
      <button
        class="export-btn"
        :disabled="exporting || !currentId"
        @click="download"
      >
        <Icon :name="exporting ? 'lucide:loader-2' : 'lucide:file-spreadsheet'"
              :class="{ spin: exporting }" />
        Excel
      </button>
    </div>

    <div class="tbl-wrap">
      <table v-if="!loading && rows.length > 0" class="tbl">
        <thead>
          <tr>
            <th>Mod</th><th>T (s)</th><th>f (Hz)</th><th>ω (rad/s)</th>
            <th>Mx (%)</th><th>My (%)</th><th>Mz (%)</th><th>Yön</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in rows" :key="m.mode_no">
            <td>{{ m.mode_no }}</td>
            <td>{{ m.period.toFixed(4) }}</td>
            <td>{{ m.frequency.toFixed(3) }}</td>
            <td>{{ m.angular_frequency.toFixed(3) }}</td>
            <td :class="massCls(m.mass_participation?.ux ?? 0)">
              {{ fmtPct(m.mass_participation?.ux ?? 0) }}
            </td>
            <td :class="massCls(m.mass_participation?.uy ?? 0)">
              {{ fmtPct(m.mass_participation?.uy ?? 0) }}
            </td>
            <td :class="massCls(m.mass_participation?.uz ?? 0)">
              {{ fmtPct(m.mass_participation?.uz ?? 0) }}
            </td>
            <td>
              <span class="dir-badge" :class="dirCls(m)">{{ dir(m) }}</span>
            </td>
          </tr>
          <tr class="cumrow">
            <td colspan="4" class="muted">KÜMÜLATİF (%)</td>
            <td :class="cumCls(cumulative.ux)">{{ fmtPct(cumulative.ux) }}</td>
            <td :class="cumCls(cumulative.uy)">{{ fmtPct(cumulative.uy) }}</td>
            <td :class="cumCls(cumulative.uz)">{{ fmtPct(cumulative.uz) }}</td>
            <td>
              <Icon v-if="cumulative.ux >= 0.95 && cumulative.uy >= 0.95"
                    name="lucide:check-circle" class="tbdy-ok" />
              <span v-else class="tbdy-warn">TBDY 95% ✗</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else-if="loading" class="tbl-state">
        <Icon name="lucide:loader-2" class="spin" /> Yükleniyor…
      </div>
      <div v-else class="tbl-state">
        <Icon name="lucide:inbox" /> Modal sonuç yok — analizi "Modal" seçeneğiyle çalıştır.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'
import type { Mode } from '~/utils/analysisApi'

const props = defineProps<{ projectId: string; fileId: string }>()

const analysisStore = useAnalysisStore()
const fileState = computed(() => analysisStore.current(props.fileId))
const currentId = computed(() => fileState.value.currentId)
const loading = computed(() => analysisStore.isTableLoading(props.fileId, 'modes'))
const rows = computed(() => fileState.value.modes)
const exporting = ref(false)

const cumulative = computed(() => {
  const acc = { ux: 0, uy: 0, uz: 0 }
  for (const m of rows.value) {
    const mp = m.mass_participation ?? {}
    acc.ux += mp.ux ?? 0
    acc.uy += mp.uy ?? 0
    acc.uz += mp.uz ?? 0
  }
  return acc
})

function fmtPct(v: number): string { return (v * 100).toFixed(2) }
function massCls(v: number): string {
  if (v >= 0.5) return 'heat-high'
  if (v >= 0.1) return 'heat-mid'
  return ''
}
function cumCls(v: number): string {
  if (v >= 0.95) return 'cum-ok'
  if (v >= 0.80) return 'cum-mid'
  return 'cum-low'
}
function dir(m: Mode): string {
  const mp = m.mass_participation ?? {}
  const ux = mp.ux ?? 0, uy = mp.uy ?? 0, uz = mp.uz ?? 0
  const max = Math.max(ux, uy, uz)
  if (max < 0.1) return 'lokal'
  if (max === ux) return 'X'
  if (max === uy) return 'Y'
  return 'Z'
}
function dirCls(m: Mode): string {
  const d = dir(m)
  return d === 'X' ? 'dir-x' : d === 'Y' ? 'dir-y' : d === 'Z' ? 'dir-z' : 'dir-local'
}

async function ensureLoaded() {
  if (currentId.value) {
    await analysisStore.loadModes(props.projectId, props.fileId, currentId.value)
  }
}

async function download() {
  if (!currentId.value) return
  exporting.value = true
  try {
    const api = await import('~/utils/analysisApi')
    const url = api.exportModesXlsxUrl(props.projectId, props.fileId, currentId.value)
    await api.downloadXlsx(url, `modlar_${currentId.value}.xlsx`)
  } catch (e) { console.error('[Export]', e) }
  finally { exporting.value = false }
}

watch(currentId, ensureLoaded)
onMounted(ensureLoaded)
</script>

<style scoped>
@import './tables-shared.css';

.cumrow { background: var(--bg-tertiary); font-weight: 600; }
.cumrow .muted { color: var(--text-secondary); text-align: left; }
.cum-ok { color: var(--accent-green); }
.cum-mid { color: #f59e0b; }
.cum-low { color: #ef4444; }
.tbdy-ok { color: var(--accent-green); }
.tbdy-warn { color: #ef4444; font-size: 0.7rem; }

.dir-badge {
  padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;
}
.dir-x { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.dir-y { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.dir-z { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
.dir-local { background: var(--bg-tertiary); color: var(--text-muted); }
</style>
