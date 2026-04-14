<template>
  <div class="analysis-panel">
    <!-- Header -->
    <div class="ap-header">
      <div>
        <h2 class="ap-title">Yapısal Analiz</h2>
        <p class="ap-subtitle">
          {{ currentFile ? `Dosya: ${currentFile.name}` : 'Önce bir dosya seç' }}
        </p>
      </div>
      <button
        type="button"
        class="ap-run-btn"
        :disabled="!canRun || analysisStore.isRunning"
        @click="openConfig"
      >
        <Icon v-if="analysisStore.isRunning" name="lucide:loader-2" class="spin" />
        <Icon v-else name="lucide:play" />
        {{ analysisStore.isRunning ? 'Çözülüyor…' : 'Analizi Çalıştır' }}
      </button>
    </div>

    <WorkspaceAnalysisConfigModal
      :open="configOpen"
      @close="configOpen = false"
      @run="handleRunWithOptions"
    />

    <!-- Hata -->
    <div v-if="analysisStore.runningError" class="ap-error">
      <Icon name="lucide:alert-triangle" />
      {{ analysisStore.runningError }}
    </div>

    <!-- Model sağlama uyarıları -->
    <div v-if="modelWarnings.length > 0" class="ap-warnings">
      <div class="warn-header" @click="warningsExpanded = !warningsExpanded">
        <Icon name="lucide:alert-triangle" />
        <strong>Model sorunları tespit edildi ({{ modelWarnings.length }})</strong>
        <Icon
          :name="warningsExpanded ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="warn-chevron"
        />
      </div>
      <div v-if="topWarning" class="warn-summary">
        {{ topWarning }}
      </div>
      <ul v-if="warningsExpanded" class="warn-list">
        <li v-for="(w, i) in modelWarnings.slice(0, 50)" :key="i">{{ w }}</li>
        <li v-if="modelWarnings.length > 50" class="warn-more">
          … {{ modelWarnings.length - 50 }} uyarı daha (ilk 50 gösteriliyor)
        </li>
      </ul>
    </div>

    <!-- Dosya yok -->
    <div v-if="!currentFile" class="ap-empty">
      <Icon name="lucide:file-question" class="ap-empty-icon" />
      <p>Analiz için önce bir .s2k dosyası açmalısınız.</p>
    </div>

    <!-- Çalışma halinde skeleton -->
    <div v-else-if="analysisStore.isRunning" class="ap-loading">
      <div class="loading-grid">
        <div v-for="i in 6" :key="i" class="loading-card" />
      </div>
      <p class="loading-text">Rijitlik matrisi birleştiriliyor, sistem çözülüyor…</p>
    </div>

    <!-- Sonuçlar -->
    <template v-else-if="summary">
      <!-- Özet kartları -->
      <div class="ap-summary">
        <div class="summary-card">
          <Icon name="lucide:circle-dot" class="sc-icon" style="color:#3B82F6" />
          <div class="sc-value">{{ summary.n_nodes }}</div>
          <div class="sc-label">Düğüm</div>
        </div>
        <div class="summary-card">
          <Icon name="lucide:minus" class="sc-icon" style="color:#10B981" />
          <div class="sc-value">{{ summary.n_frame_elements }}</div>
          <div class="sc-label">Frame</div>
        </div>
        <div class="summary-card">
          <Icon name="lucide:square" class="sc-icon" style="color:#8B5CF6" />
          <div class="sc-value">{{ summary.n_shell_elements }}</div>
          <div class="sc-label">Shell</div>
        </div>
        <div class="summary-card">
          <Icon name="lucide:grid-3x3" class="sc-icon" style="color:#F59E0B" />
          <div class="sc-value">{{ summary.n_dofs_free }}/{{ summary.n_dofs_total }}</div>
          <div class="sc-label">Serbestlik</div>
        </div>
        <div class="summary-card">
          <Icon name="lucide:move" class="sc-icon" style="color:#EF4444" />
          <div class="sc-value">{{ formatDisp(summary.max_displacement) }}</div>
          <div class="sc-label">Max Yer Değ.</div>
        </div>
        <div class="summary-card">
          <Icon name="lucide:layers" class="sc-icon" style="color:#EC4899" />
          <div class="sc-value">{{ summary.n_load_cases }}</div>
          <div class="sc-label">Yük Durumu</div>
        </div>
      </div>

      <!-- Yük durumu seçici — dropdown -->
      <div v-if="loadCases.length > 0" class="ap-case-selector" ref="caseSelectorRef">
        <label class="selector-label">Yük durumu:</label>

        <!-- Kapalı görünüm: seçili case + dropdown ok -->
        <button
          type="button"
          class="case-dropdown-trigger"
          :class="{ open: caseDropdownOpen }"
          @click="caseDropdownOpen = !caseDropdownOpen"
        >
          <span class="trigger-pill" :class="{ combo: isSelectedCombo }">
            {{ selectedCase || 'Seç…' }}
          </span>
          <span class="trigger-count">{{ loadCases.length }}</span>
          <Icon
            :name="caseDropdownOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="trigger-chevron"
          />
        </button>

        <button
          v-if="selectedCaseFactors"
          type="button"
          class="case-detail-btn"
          :class="{ active: caseDetailOpen }"
          title="Kombinasyon içeriğini göster"
          @click="caseDetailOpen = !caseDetailOpen"
        >
          <Icon name="lucide:info" />
        </button>

        <!-- Açık dropdown paneli -->
        <div v-if="caseDropdownOpen" class="case-dropdown-panel" @click.stop>
          <div class="case-dropdown-search">
            <Icon name="lucide:search" class="search-icon" />
            <input
              v-model="caseSearchQuery"
              type="text"
              placeholder="Yük durumu ara..."
              class="case-search-input"
              ref="caseSearchInputRef"
            />
          </div>

          <div v-if="filteredPatternCases.length > 0" class="case-group">
            <div class="case-group-label">Yük Patternleri ({{ filteredPatternCases.length }})</div>
            <div class="case-group-pills">
              <button
                v-for="c in filteredPatternCases"
                :key="c"
                type="button"
                class="pill"
                :class="{ active: selectedCase === c }"
                @click="selectCase(c)"
              >
                {{ c }}
              </button>
            </div>
          </div>

          <div v-if="filteredComboCases.length > 0" class="case-group">
            <div class="case-group-label">Kombinasyonlar ({{ filteredComboCases.length }})</div>
            <div class="case-group-pills">
              <button
                v-for="c in filteredComboCases"
                :key="c"
                type="button"
                class="pill combo-pill"
                :class="{ active: selectedCase === c }"
                @click="selectCase(c)"
              >
                {{ c }}
              </button>
            </div>
          </div>

          <div
            v-if="filteredPatternCases.length === 0 && filteredComboCases.length === 0"
            class="case-empty"
          >
            Eşleşen yük durumu yok.
          </div>
        </div>
      </div>

      <!-- Seçili kombinasyonun açıklaması (ana ekranda) -->
      <div v-if="caseDetailOpen && selectedCaseFactors" class="ap-case-detail">
        <div class="case-detail-label">{{ selectedCase }} =</div>
        <div class="case-detail-formula">
          <template v-for="(sf, pat, idx) in selectedCaseFactors" :key="pat">
            <span class="sign" :class="{ neg: sf < 0 }">{{ idx === 0 ? (sf < 0 ? '−' : '') : (sf < 0 ? '−' : '+') }}</span>
            <span class="sf">{{ Math.abs(sf).toFixed(3) }}</span>
            <span class="x">·</span>
            <span class="pat">{{ pat }}</span>
          </template>
        </div>
      </div>

      <!-- Excel indirme butonları -->
      <div class="ap-export-bar">
        <span class="ap-export-label">Excel indir:</span>
        <button class="export-btn" :disabled="exporting" @click="downloadAll">
          <Icon :name="exporting ? 'lucide:loader-2' : 'lucide:file-spreadsheet'"
                :class="{ spin: exporting }" />
          Tamamı
        </button>
        <button
          class="export-btn"
          :disabled="exporting || !selectedCase"
          @click="downloadCurrent('displacements')"
        >
          <Icon name="lucide:move" /> Yer Değ. ({{ selectedCase || '—' }})
        </button>
        <button
          class="export-btn"
          :disabled="exporting || !selectedCase"
          @click="downloadCurrent('reactions')"
        >
          <Icon name="lucide:anchor" /> Reaksiyon
        </button>
        <button
          v-if="modes.length > 0"
          class="export-btn"
          :disabled="exporting"
          @click="downloadModes"
        >
          <Icon name="lucide:waves" /> Modlar
        </button>
      </div>

      <!-- Tab'lar -->
      <div class="ap-tabs">
        <button
          type="button"
          class="tab"
          :class="{ active: activeTab === 'displacements' }"
          @click="activeTab = 'displacements'"
        >
          <Icon name="lucide:move" /> Yer Değiştirmeler ({{ displacements.length }})
        </button>
        <button
          type="button"
          class="tab"
          :class="{ active: activeTab === 'reactions' }"
          @click="activeTab = 'reactions'"
        >
          <Icon name="lucide:anchor" /> Reaksiyonlar ({{ reactions.length }})
        </button>
        <button
          v-if="modes.length > 0"
          type="button"
          class="tab"
          :class="{ active: activeTab === 'modes' }"
          @click="activeTab = 'modes'"
        >
          <Icon name="lucide:waves" /> Mod'lar ({{ modes.length }})
        </button>
      </div>

      <!-- Tablolar -->
      <div class="ap-table-wrap">
        <table v-if="activeTab === 'displacements'" class="ap-table">
          <thead>
            <tr>
              <th>Düğüm</th>
              <th>ux</th>
              <th>uy</th>
              <th>uz</th>
              <th>rx</th>
              <th>ry</th>
              <th>rz</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in displacements" :key="`${d.load_case}-${d.node_id}`">
              <td class="muted node-cell">
                <span class="node-id">{{ d.node_id }}</span>
                <span v-if="hasLabels(d)" class="node-labels">
                  <span
                    v-if="axisLabel(d)"
                    class="node-aks"
                    :class="{ partial: isPartialAks(d) }"
                    :title="axisTitle(d)"
                  >
                    {{ axisLabel(d) }}
                  </span>
                  <span v-if="d.level" class="node-level">{{ d.level }}</span>
                </span>
              </td>
              <td :class="cellCls(d.ux, maxAbs.ux)">{{ fmt(d.ux) }}</td>
              <td :class="cellCls(d.uy, maxAbs.uy)">{{ fmt(d.uy) }}</td>
              <td :class="cellCls(d.uz, maxAbs.uz)">{{ fmt(d.uz) }}</td>
              <td :class="cellCls(d.rx, maxAbs.rx)">{{ fmt(d.rx) }}</td>
              <td :class="cellCls(d.ry, maxAbs.ry)">{{ fmt(d.ry) }}</td>
              <td :class="cellCls(d.rz, maxAbs.rz)">{{ fmt(d.rz) }}</td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="activeTab === 'reactions'" class="ap-table">
          <thead>
            <tr>
              <th>Mesnet</th>
              <th>Fx</th>
              <th>Fy</th>
              <th>Fz</th>
              <th>Mx</th>
              <th>My</th>
              <th>Mz</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reactions" :key="`${r.load_case}-${r.node_id}`">
              <td class="muted node-cell">
                <span class="node-id">{{ r.node_id }}</span>
                <span v-if="hasLabels(r)" class="node-labels">
                  <span
                    v-if="axisLabel(r)"
                    class="node-aks"
                    :class="{ partial: isPartialAks(r) }"
                    :title="axisTitle(r)"
                  >
                    {{ axisLabel(r) }}
                  </span>
                  <span v-if="r.level" class="node-level">{{ r.level }}</span>
                </span>
              </td>
              <td>{{ fmt(r.fx) }}</td>
              <td>{{ fmt(r.fy) }}</td>
              <td :class="r.fz > 0 ? 'positive' : ''">{{ fmt(r.fz) }}</td>
              <td>{{ fmt(r.mx) }}</td>
              <td>{{ fmt(r.my) }}</td>
              <td>{{ fmt(r.mz) }}</td>
            </tr>
          </tbody>
        </table>

        <table v-else-if="activeTab === 'modes'" class="ap-table">
          <thead>
            <tr>
              <th>Mod</th>
              <th>T (s)</th>
              <th>f (Hz)</th>
              <th>ω (rad/s)</th>
              <th>Mx (%)</th>
              <th>My (%)</th>
              <th>Mz (%)</th>
              <th>Yön</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in modes" :key="m.mode_no">
              <td class="muted">{{ m.mode_no }}</td>
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
                <span class="mode-dir-badge" :class="modeDirClass(m)">
                  {{ modeDirection(m) }}
                </span>
              </td>
            </tr>
            <tr class="cumrow" v-if="modes.length > 0">
              <td colspan="4" class="muted">KÜMÜLATİF (%)</td>
              <td :class="cumCls(cumulative.ux)">{{ fmtPct(cumulative.ux) }}</td>
              <td :class="cumCls(cumulative.uy)">{{ fmtPct(cumulative.uy) }}</td>
              <td :class="cumCls(cumulative.uz)">{{ fmtPct(cumulative.uz) }}</td>
              <td class="muted">
                <Icon v-if="cumulative.ux >= 0.95 && cumulative.uy >= 0.95"
                      name="lucide:check-circle" class="tbdy-ok" />
                <span v-else class="tbdy-warn">TBDY 95% ✗</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Geçmiş -->
      <details v-if="history.length > 1" class="ap-history">
        <summary>
          <Icon name="lucide:history" /> Geçmiş ({{ history.length }})
        </summary>
        <ul class="history-list">
          <li
            v-for="h in history"
            :key="h.analysis_id"
            :class="{ active: h.analysis_id === currentId }"
          >
            <button class="history-item" @click="selectHistory(h)">
              <span class="h-id">{{ h.analysis_id.slice(0, 10) }}…</span>
              <span class="h-date">{{ formatDate(h.created_at) }}</span>
              <span class="h-duration">{{ h.duration_ms }}ms</span>
            </button>
            <button
              class="h-delete"
              title="Sil"
              @click="deleteHistory(h)"
            >
              <Icon name="lucide:trash-2" />
            </button>
          </li>
        </ul>
      </details>
    </template>

    <!-- İlk kez: boş state -->
    <div v-else class="ap-intro">
      <Icon name="lucide:play-circle" class="intro-icon" />
      <h3>Henüz analiz yok</h3>
      <p>
        "Analizi Çalıştır"ı tıklayarak modelin statik lineer çözümünü başlatın.
      </p>
      <ul class="intro-list">
        <li><Icon name="lucide:check" /> Düğüm yer değiştirmeleri</li>
        <li><Icon name="lucide:check" /> Mesnet reaksiyonları</li>
        <li><Icon name="lucide:check" /> Tüm yük durumları (G, Q, EQX, EQY…)</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'
import { useProjectStore } from '~/stores/project'

const projectStore = useProjectStore()
const analysisStore = useAnalysisStore()

const activeTab = ref<'displacements' | 'reactions' | 'modes'>('displacements')
const warningsExpanded = ref(false)
const configOpen = ref(false)
const caseDetailOpen = ref(false)
const exporting = ref(false)
const caseDropdownOpen = ref(false)
const caseSearchQuery = ref('')
const caseSelectorRef = ref<HTMLElement | null>(null)
const caseSearchInputRef = ref<HTMLInputElement | null>(null)

const currentFile = computed(() => projectStore.currentFile)
const projectId = computed(() => projectStore.activeProjectId ?? '')

const canRun = computed(() =>
  !!currentFile.value && !!projectId.value && currentFile.value.format === '.s2k',
)

const fileState = computed(() =>
  currentFile.value ? analysisStore.current(currentFile.value.id) : null,
)

const summary = computed(() => fileState.value?.status?.summary ?? null)
const displacements = computed(() =>
  currentFile.value ? analysisStore.filteredDisplacements(currentFile.value.id) : [],
)
const reactions = computed(() =>
  currentFile.value ? analysisStore.filteredReactions(currentFile.value.id) : [],
)
const modes = computed(() => fileState.value?.modes ?? [])

const isSelectedCombo = computed(() => !!selectedCaseFactors.value)

const comboCaseIds = computed<Set<string>>(() => {
  const p = fileState.value?.preview
  if (!p) return new Set()
  return new Set(p.combinations.map(c => c.id))
})

const filteredPatternCases = computed(() => {
  const q = caseSearchQuery.value.trim().toLowerCase()
  return loadCases.value
    .filter(c => !comboCaseIds.value.has(c))
    .filter(c => !q || c.toLowerCase().includes(q))
})

const filteredComboCases = computed(() => {
  const q = caseSearchQuery.value.trim().toLowerCase()
  return loadCases.value
    .filter(c => comboCaseIds.value.has(c))
    .filter(c => !q || c.toLowerCase().includes(q))
})

const selectedCaseFactors = computed<Record<string, number> | null>(() => {
  // Kombinasyon ise preview'dan factor'ları bul
  const p = fileState.value?.preview
  if (!p || !selectedCase.value) return null
  const combo = p.combinations.find(c => c.id === selectedCase.value)
  return combo ? combo.factors : null
})

const cumulative = computed(() => {
  const acc = { ux: 0, uy: 0, uz: 0 }
  for (const m of modes.value) {
    const mp = m.mass_participation ?? {}
    acc.ux += mp.ux ?? 0
    acc.uy += mp.uy ?? 0
    acc.uz += mp.uz ?? 0
  }
  return acc
})
const loadCases = computed(() =>
  currentFile.value ? analysisStore.availableLoadCases(currentFile.value.id) : [],
)
const selectedCase = computed(() => fileState.value?.selectedLoadCase ?? null)
const history = computed(() => fileState.value?.history ?? [])
const currentId = computed(() => fileState.value?.currentId ?? null)
const modelWarnings = computed<string[]>(() => fileState.value?.status?.warnings ?? [])
const topWarning = computed(() => {
  // "no_restraints" veya "no_section_assignments" gibi kritik uyarıları öne al
  const critical = modelWarnings.value.find(w =>
    w.includes('no_restraints') || w.includes('no_section_assignments'),
  )
  return critical ?? modelWarnings.value[0] ?? ''
})

const maxAbs = computed(() => {
  const out = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }
  displacements.value.forEach(d => {
    if (Math.abs(d.ux) > out.ux) out.ux = Math.abs(d.ux)
    if (Math.abs(d.uy) > out.uy) out.uy = Math.abs(d.uy)
    if (Math.abs(d.uz) > out.uz) out.uz = Math.abs(d.uz)
    if (Math.abs(d.rx) > out.rx) out.rx = Math.abs(d.rx)
    if (Math.abs(d.ry) > out.ry) out.ry = Math.abs(d.ry)
    if (Math.abs(d.rz) > out.rz) out.rz = Math.abs(d.rz)
  })
  return out
})

function openConfig() {
  if (!canRun.value) return
  configOpen.value = true
}

function selectCase(c: string) {
  if (!currentFile.value) return
  analysisStore.setLoadCase(currentFile.value.id, c)
  caseDropdownOpen.value = false
  caseSearchQuery.value = ''
}

// Dropdown açılınca arama kutusuna odaklan
watch(caseDropdownOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    caseSearchInputRef.value?.focus()
  }
})

// Dışarı tıklanınca dropdown'u kapat
function handleOutsideClick(e: MouseEvent) {
  if (!caseDropdownOpen.value) return
  const target = e.target as Node
  if (caseSelectorRef.value && !caseSelectorRef.value.contains(target)) {
    caseDropdownOpen.value = false
    caseSearchQuery.value = ''
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function fmtPct(v: number): string {
  return (v * 100).toFixed(2)
}

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

function modeDirection(m: { mass_participation?: Record<string, number> }): string {
  const mp = m.mass_participation ?? {}
  const ux = mp.ux ?? 0
  const uy = mp.uy ?? 0
  const uz = mp.uz ?? 0
  const max = Math.max(ux, uy, uz)
  if (max < 0.1) return 'lokal'
  if (max === ux) return 'X'
  if (max === uy) return 'Y'
  return 'Z'
}

function modeDirClass(m: { mass_participation?: Record<string, number> }): string {
  const d = modeDirection(m)
  return d === 'X' ? 'dir-x' : d === 'Y' ? 'dir-y' : d === 'Z' ? 'dir-z' : 'dir-local'
}

async function downloadAll() {
  if (!currentFile.value || !projectId.value || !currentId.value) return
  exporting.value = true
  try {
    const { exportFullXlsxUrl, downloadXlsx } = await import('~/utils/analysisApi')
    const url = exportFullXlsxUrl(projectId.value, currentFile.value.id, currentId.value)
    await downloadXlsx(url, `analiz_${currentId.value}.xlsx`)
  } catch (e) {
    console.error('[Export] error:', e)
  } finally {
    exporting.value = false
  }
}

async function downloadCurrent(kind: 'displacements' | 'reactions') {
  if (!currentFile.value || !projectId.value || !currentId.value || !selectedCase.value) return
  exporting.value = true
  try {
    const api = await import('~/utils/analysisApi')
    const urlFn = kind === 'displacements'
      ? api.exportDisplacementsXlsxUrl
      : api.exportReactionsXlsxUrl
    const url = urlFn(
      projectId.value, currentFile.value.id, currentId.value, selectedCase.value,
    )
    await api.downloadXlsx(url, `${kind}_${selectedCase.value}.xlsx`)
  } catch (e) {
    console.error('[Export] error:', e)
  } finally {
    exporting.value = false
  }
}

async function downloadModes() {
  if (!currentFile.value || !projectId.value || !currentId.value) return
  exporting.value = true
  try {
    const api = await import('~/utils/analysisApi')
    const url = api.exportModesXlsxUrl(projectId.value, currentFile.value.id, currentId.value)
    await api.downloadXlsx(url, `modlar_${currentId.value}.xlsx`)
  } catch (e) {
    console.error('[Export] error:', e)
  } finally {
    exporting.value = false
  }
}

async function handleRunWithOptions(options: Record<string, unknown>) {
  if (!currentFile.value || !projectId.value) return
  await analysisStore.run(projectId.value, currentFile.value.id, options as any)
}

async function selectHistory(h: { analysis_id: string }) {
  if (!currentFile.value || !projectId.value) return
  const state = analysisStore._ensure(currentFile.value.id)
  state.currentId = h.analysis_id
  await analysisStore.loadResults(projectId.value, currentFile.value.id, h.analysis_id)
}

async function deleteHistory(h: { analysis_id: string }) {
  if (!currentFile.value || !projectId.value) return
  if (!confirm(`Analiz ${h.analysis_id} silinsin mi?`)) return
  await analysisStore.remove(projectId.value, currentFile.value.id, h.analysis_id)
}

// Dosya değişince geçmişi yükle
watch(
  () => currentFile.value?.id,
  async (fid) => {
    if (fid && projectId.value) {
      await analysisStore.refreshHistory(projectId.value, fid)
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (currentFile.value && projectId.value) {
    analysisStore.refreshHistory(projectId.value, currentFile.value.id)
  }
})

function fmt(v: number): string {
  if (Math.abs(v) < 1e-4) return v === 0 ? '0' : v.toExponential(2)
  return v.toFixed(4)
}

type NodeLabelRec = { axis_x?: string | null; axis_y?: string | null; level?: string | null }

function hasLabels(rec: NodeLabelRec): boolean {
  return !!(rec.axis_x || rec.axis_y || rec.level)
}

/** Aks etiketini oluştur:
 *   Kolon kesişimi (her iki aks var)  → "B-3"
 *   Sadece Y ekseni                   → "aks B"  (X arası ara nokta)
 *   Sadece X ekseni                   → "aks 3"
 *   Hiçbiri yok                       → ""       (gösterilmez)
 */
function axisLabel(rec: NodeLabelRec): string {
  const { axis_x, axis_y } = rec
  if (axis_x && axis_y) return `${axis_x}-${axis_y}`
  if (axis_y) return `aks ${axis_y}`
  if (axis_x) return `aks ${axis_x}`
  return ''
}

function isPartialAks(rec: NodeLabelRec): boolean {
  return !!(rec.axis_x || rec.axis_y) && !(rec.axis_x && rec.axis_y)
}

function axisTitle(rec: NodeLabelRec): string {
  if (rec.axis_x && rec.axis_y) return `Kolon hizası: ${rec.axis_x}-${rec.axis_y}`
  if (rec.axis_y) return `${rec.axis_y} aksı üzerinde; X ekseninde iki grid arasında (ara nokta)`
  if (rec.axis_x) return `${rec.axis_x} aksı üzerinde; Y ekseninde iki grid arasında (ara nokta)`
  return ''
}

function formatDisp(v: number): string {
  if (!v) return '0'
  if (Math.abs(v) < 1e-3) return `${(v * 1000).toFixed(3)} mm`
  return `${v.toFixed(4)} m`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
    })
  } catch { return iso }
}

function cellCls(v: number, max: number): string {
  if (!max) return ''
  const ratio = Math.abs(v) / max
  if (ratio > 0.9) return 'heat-high'
  if (ratio > 0.5) return 'heat-mid'
  return ''
}
</script>

<style scoped>
.analysis-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.ap-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-default);
}

.ap-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
  color: var(--text-primary);
}

.ap-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0;
}

.ap-run-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.ap-run-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.ap-run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ap-error {
  margin: 1rem 1.5rem 0;
  padding: 0.75rem 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  border-radius: 8px;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.ap-warnings {
  margin: 1rem 1.5rem 0;
  padding: 0.625rem 0.875rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #f59e0b;
  border-radius: 8px;
  font-size: 0.8125rem;
}

.warn-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.warn-chevron {
  margin-left: auto;
  opacity: 0.7;
}

.warn-summary {
  margin-top: 0.375rem;
  padding-left: 1.5rem;
  color: var(--text-primary);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.warn-list {
  list-style: disc;
  padding: 0.5rem 0.5rem 0 2.25rem;
  margin: 0;
  max-height: 240px;
  overflow-y: auto;
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.5;
}

.warn-list li {
  margin-bottom: 0.25rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.warn-more {
  list-style: none;
  margin-left: -1rem;
  color: var(--text-muted);
  font-style: italic;
  font-family: inherit !important;
}

.ap-empty,
.ap-intro {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.ap-empty-icon,
.intro-icon {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.intro-icon {
  color: var(--accent-blue);
}

.ap-intro h3 {
  margin: 0 0 0.5rem;
  color: var(--text-primary);
  font-size: 1.125rem;
}

.intro-list {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.intro-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.intro-list :deep(svg) {
  color: var(--accent-green);
}

.ap-loading {
  padding: 1.5rem;
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.loading-card {
  height: 80px;
  background: var(--bg-secondary);
  border-radius: 10px;
  animation: pulse 1.2s ease-in-out infinite;
}

.loading-text {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.ap-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 1rem 1.5rem;
}

.summary-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.sc-icon {
  width: 18px;
  height: 18px;
  margin-bottom: 0.25rem;
}

.sc-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.sc-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.ap-case-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.5rem;
  border-top: 1px solid var(--border-default);
}

.selector-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

/* Kapalı dropdown — tek satır trigger */
.case-dropdown-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  cursor: pointer;
  min-width: 160px;
  max-width: 360px;
  transition: border-color 0.15s;
}

.case-dropdown-trigger:hover,
.case-dropdown-trigger.open {
  border-color: var(--accent-blue);
}

.trigger-pill {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent-blue);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.trigger-pill.combo {
  color: var(--accent-purple, #8b5cf6);
}

.trigger-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 0.125rem 0.375rem;
  background: var(--bg-primary);
  border-radius: 999px;
}

.trigger-chevron {
  color: var(--text-muted);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Dropdown paneli */
.case-dropdown-panel {
  position: absolute;
  top: calc(100% - 2px);
  left: 1.5rem;
  right: 1.5rem;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border: 1px solid var(--accent-blue);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
  padding: 0.75rem;
  gap: 0.625rem;
  animation: dropdownFade 0.12s ease-out;
}

@keyframes dropdownFade {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.case-dropdown-search {
  position: relative;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  pointer-events: none;
}

.case-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem 0.5rem 2rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.case-search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.case-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  overflow-y: auto;
  min-height: 0;
}

.case-group:not(:last-child) {
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--border-default);
}

.case-group-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.case-group-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  max-height: 160px;
  overflow-y: auto;
  padding: 0.125rem 0.25rem 0.125rem 0;
}

.case-group-pills::-webkit-scrollbar { width: 6px; }
.case-group-pills::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 3px;
}

.combo-pill {
  border-color: rgba(139, 92, 246, 0.3) !important;
}
.combo-pill:hover {
  border-color: var(--accent-purple, #8b5cf6) !important;
}
.combo-pill.active {
  background: var(--accent-purple, #8b5cf6) !important;
  border-color: var(--accent-purple, #8b5cf6) !important;
}

.case-empty {
  padding: 1.5rem 0.75rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.pill {
  padding: 0.25rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.pill:hover {
  border-color: var(--accent-blue);
}

.pill.active {
  background: var(--accent-blue);
  color: #fff;
  border-color: var(--accent-blue);
}

.ap-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid var(--border-default);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}

.ap-table-wrap {
  flex: 1;
  overflow: auto;
  padding: 0 1.5rem;
  min-height: 0;
}

.ap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.ap-table thead {
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 1;
}

.ap-table th {
  text-align: right;
  padding: 0.5rem 0.5rem;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-default);
}

.ap-table th:first-child {
  text-align: left;
}

.ap-table td {
  padding: 0.375rem 0.5rem;
  text-align: right;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.04));
  color: var(--text-primary);
}

.ap-table td:first-child {
  text-align: left;
}

.ap-table td.muted {
  color: var(--text-muted);
}

.node-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-align: left !important;
}

.node-id {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 24px;
}

.node-labels {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.node-aks {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  background: rgba(59, 130, 246, 0.12);
  color: var(--accent-blue);
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-family: ui-monospace, SFMono-Regular, monospace;
  white-space: nowrap;
  cursor: help;
}

/* Sadece tek eksen var — açıkça ayır */
.node-aks.partial {
  background: rgba(148, 163, 184, 0.12);
  color: var(--text-secondary);
  font-weight: 500;
  font-family: inherit;
  letter-spacing: normal;
}

.node-level {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
}

.ap-table td.heat-mid {
  background: rgba(245, 158, 11, 0.08);
}

.ap-table td.heat-high {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  font-weight: 600;
}

.ap-table tr.cumrow td {
  background: rgba(59, 130, 246, 0.06);
  border-top: 2px solid var(--border-default);
  font-weight: 700;
}
.ap-table td.cum-ok {
  color: var(--accent-green);
  font-weight: 700;
}
.ap-table td.cum-mid {
  color: #f59e0b;
  font-weight: 600;
}
.ap-table td.cum-low {
  color: #ef4444;
  font-weight: 600;
}

.mode-dir-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.dir-x { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.dir-y { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.dir-z { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
.dir-local { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }

.tbdy-ok { color: var(--accent-green); width: 16px; height: 16px; }
.tbdy-warn {
  color: #ef4444;
  font-size: 0.6875rem;
  font-weight: 700;
}

/* Seçili kombinasyonun ana ekranda detayı */
.case-detail-btn {
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 0.25rem 0.375rem;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
}
.case-detail-btn:hover,
.case-detail-btn.active {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}

.ap-case-detail {
  margin: 0.25rem 1.5rem 0.5rem;
  padding: 0.625rem 0.875rem;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.8125rem;
}
.case-detail-label {
  color: var(--text-secondary);
  font-weight: 600;
}
.case-detail-formula {
  font-family: ui-monospace, SFMono-Regular, monospace;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem;
  color: var(--text-primary);
}
.case-detail-formula .sign {
  color: var(--accent-green);
  font-weight: 700;
}
.case-detail-formula .sign.neg {
  color: #ef4444;
}
.case-detail-formula .sf {
  font-variant-numeric: tabular-nums;
}
.case-detail-formula .x {
  color: var(--text-muted);
}
.case-detail-formula .pat {
  color: var(--accent-blue);
  font-weight: 600;
}

/* Excel export bar */
.ap-export-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.5rem;
  border-top: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
}
.ap-export-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-right: 0.25rem;
}
.export-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}
.export-btn:hover:not(:disabled) {
  border-color: var(--accent-green);
  color: var(--accent-green);
}
.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ap-table td.positive {
  color: var(--accent-green);
}

.ap-history {
  border-top: 1px solid var(--border-default);
  padding: 0.75rem 1.5rem;
}

.ap-history summary {
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  user-select: none;
}

.history-list {
  list-style: none;
  padding: 0.75rem 0 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.history-list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.history-list li.active .history-item {
  border-color: var(--accent-blue);
}

.history-item {
  flex: 1;
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.h-id {
  font-family: monospace;
  color: var(--text-muted);
}

.h-date {
  flex: 1;
  color: var(--text-secondary);
}

.h-duration {
  color: var(--accent-green);
  font-weight: 600;
}

.h-delete {
  padding: 0.375rem;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.h-delete:hover {
  color: #ef4444;
  border-color: #ef4444;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
