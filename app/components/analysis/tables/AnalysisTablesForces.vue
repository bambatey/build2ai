<template>
  <div class="tbl-root">
    <div class="tbl-head">
      <h3>
        <Icon name="lucide:activity" /> Kesit Tesirleri
        <span class="count">{{ rows.length }}</span>
      </h3>
    </div>

    <div class="tbl-wrap">
      <table v-if="!loading && rows.length > 0" class="tbl forces-table">
        <thead>
          <tr>
            <th>Frame</th><th>I</th><th>J</th><th>L (m)</th>
            <th title="I ucundaki moment (mesnet momenti)">M3<sub>I</sub></th>
            <th title="Açıklık içi extremum moment">M3<sub>açıklık</sub></th>
            <th title="J ucundaki moment (mesnet momenti)">M3<sub>J</sub></th>
            <th>|V2|<sub>max</sub></th>
            <th>N<sub>I</sub></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="ef in rows" :key="`${ef.load_case}-${ef.element_id}`">
            <tr
              class="force-row"
              :class="{ expanded: expanded === ef.element_id }"
              @click="toggle(ef.element_id)"
            >
              <td>
                <Icon
                  :name="expanded === ef.element_id ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                  class="chev"
                />
                #{{ ef.element_id }}
              </td>
              <td class="node-cell">
                <span class="node-id">{{ ef.node_i }}</span>
                <span v-if="hasLabels(ef.i_labels)" class="node-labels">
                  <span
                    v-if="axisLabel(ef.i_labels || {})"
                    class="node-aks"
                    :class="{ partial: isPartialAks(ef.i_labels || {}) }"
                  >{{ axisLabel(ef.i_labels || {}) }}</span>
                  <span v-if="ef.i_labels?.level" class="node-level">{{ ef.i_labels.level }}</span>
                </span>
              </td>
              <td class="node-cell">
                <span class="node-id">{{ ef.node_j }}</span>
                <span v-if="hasLabels(ef.j_labels)" class="node-labels">
                  <span
                    v-if="axisLabel(ef.j_labels || {})"
                    class="node-aks"
                    :class="{ partial: isPartialAks(ef.j_labels || {}) }"
                  >{{ axisLabel(ef.j_labels || {}) }}</span>
                  <span v-if="ef.j_labels?.level" class="node-level">{{ ef.j_labels.level }}</span>
                </span>
              </td>
              <td>{{ ef.length.toFixed(2) }}</td>
              <td :class="momentCls(ef.M3_I, max.M3)">{{ fmtFloat(ef.M3_I) }}</td>
              <td :class="momentCls(ef.M3_span_ext, max.M3)">
                {{ fmtFloat(ef.M3_span_ext) }}
                <small v-if="ef.M3_span_ext_x > 0" class="muted">
                  @{{ ef.M3_span_ext_x.toFixed(2) }}m
                </small>
              </td>
              <td :class="momentCls(ef.M3_J, max.M3)">{{ fmtFloat(ef.M3_J) }}</td>
              <td :class="momentCls(ef.V2_max_abs, max.V)">{{ fmtFloat(ef.V2_max_abs) }}</td>
              <td :class="ef.P_I > 0 ? 'tension' : (ef.P_I < 0 ? 'compression' : '')">
                {{ fmtFloat(ef.P_I) }}
              </td>
            </tr>
            <tr v-if="expanded === ef.element_id" class="force-detail">
              <td colspan="9">
                <div class="detail">
                  <div class="detail-label">
                    Frame #{{ ef.element_id }} • L = {{ ef.length.toFixed(3) }} m •
                    q<sub>local</sub> = [{{ ef.q_local.map(q => q.toFixed(2)).join(', ') }}]
                  </div>
                  <table class="tbl inner">
                    <thead>
                      <tr>
                        <th>x (m)</th><th>x/L</th>
                        <th>P</th><th>V2</th><th>V3</th>
                        <th>T</th><th>M2</th><th>M3</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(s, i) in ef.stations" :key="i">
                        <td>{{ s.x.toFixed(3) }}</td>
                        <td class="muted">{{ (s.x_rel * 100).toFixed(0) }}%</td>
                        <td>{{ fmtFloat(s.P) }}</td>
                        <td>{{ fmtFloat(s.V2) }}</td>
                        <td>{{ fmtFloat(s.V3) }}</td>
                        <td>{{ fmtFloat(s.T) }}</td>
                        <td>{{ fmtFloat(s.M2) }}</td>
                        <td class="m3-cell">{{ fmtFloat(s.M3) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </template>
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
  axisLabel, fmtFloat, hasLabels, isPartialAks,
} from '~/composables/useNodeLabels'

const props = defineProps<{ projectId: string; fileId: string }>()

const analysisStore = useAnalysisStore()
const fileState = computed(() => analysisStore.current(props.fileId))
const currentId = computed(() => fileState.value.currentId)
const selectedCase = computed(() => fileState.value.selectedLoadCase)
const loading = computed(() => analysisStore.isTableLoading(props.fileId, 'forces'))
const rows = computed(() => analysisStore.filteredElementForces(props.fileId))
const expanded = ref<number | null>(null)

const max = computed(() => {
  let M3 = 0, V = 0
  for (const ef of rows.value) {
    const m = Math.max(Math.abs(ef.M3_I), Math.abs(ef.M3_J), Math.abs(ef.M3_span_ext))
    if (m > M3) M3 = m
    if (ef.V2_max_abs > V) V = ef.V2_max_abs
  }
  return { M3, V }
})

function toggle(id: number) { expanded.value = expanded.value === id ? null : id }
function momentCls(v: number, m: number): string {
  if (!m) return ''
  const r = Math.abs(v) / m
  if (r > 0.8) return 'f-high'
  if (r > 0.5) return 'f-mid'
  if (r > 0.2) return 'f-low'
  return ''
}

async function ensureLoaded() {
  if (currentId.value) {
    // Case'e göre lazy fetch — tüm case'leri tek seferde çekmek yerine
    // kullanıcının seçtiği case için endpoint'e ?load_case= geçilir.
    await analysisStore.loadForces(
      props.projectId, props.fileId, currentId.value, selectedCase.value,
    )
  }
}

watch([currentId, selectedCase], ensureLoaded)
onMounted(ensureLoaded)
</script>

<style scoped>
@import './tables-shared.css';

.force-row { cursor: pointer; }
.force-row:hover, .force-row.expanded { background: var(--bg-secondary); }
.chev { opacity: 0.6; margin-right: 4px; }
.f-low { background: rgba(239, 68, 68, 0.07); }
.f-mid { background: rgba(239, 68, 68, 0.20); font-weight: 600; }
.f-high {
  background: rgba(239, 68, 68, 0.45);
  color: #fff;
  font-weight: 700;
}
.tension { color: var(--accent-green); }
.compression { color: #60a5fa; }

.force-detail td { padding: 0 !important; background: var(--bg-primary); }
.detail {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-default);
  border-left: 3px solid var(--accent-blue);
  background: var(--bg-secondary);
}
.detail-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.inner { font-size: 0.75rem; }
.m3-cell { font-weight: 600; }
small.muted { margin-left: 0.3rem; opacity: 0.6; }
</style>
