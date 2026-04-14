<template>
  <Teleport to="body">
    <div v-if="open" class="acm-backdrop" @click.self="$emit('close')">
      <div class="acm-modal">
        <header class="acm-header">
          <div>
            <h3 class="acm-title">Analiz Seçenekleri</h3>
            <p class="acm-subtitle">{{ currentFileName }}</p>
          </div>
          <button type="button" class="acm-close" @click="$emit('close')">
            <Icon name="lucide:x" />
          </button>
        </header>

        <div class="acm-body">
          <!-- Yükleniyor -->
          <div v-if="loading" class="acm-loading">
            <Icon name="lucide:loader-2" class="spin" />
            Model özeti yükleniyor…
          </div>

          <!-- Hata -->
          <div v-else-if="error" class="acm-error">
            <Icon name="lucide:alert-triangle" />
            {{ error }}
          </div>

          <template v-else-if="preview">
            <!-- Model özeti -->
            <div class="acm-section">
              <div class="stat-row">
                <div class="stat"><span>{{ preview.n_nodes }}</span> düğüm</div>
                <div class="stat"><span>{{ preview.n_frame_elements }}</span> frame</div>
                <div class="stat"><span>{{ preview.n_shell_elements }}</span> shell</div>
              </div>
              <div v-if="preview.warnings.length > 0" class="acm-warn">
                <Icon name="lucide:alert-triangle" />
                Model sağlama: {{ preview.warnings.length }} uyarı
              </div>
            </div>

            <!-- Yük durumları -->
            <div class="acm-section">
              <div class="section-head">
                <h4>Yük Durumları</h4>
                <button type="button" class="link-btn" @click="toggleAllCases">
                  {{ allCasesSelected ? 'Tümünü kaldır' : 'Tümünü seç' }}
                </button>
              </div>
              <div v-if="preview.load_cases.length === 0" class="acm-empty-msg">
                Dosyada yük durumu tanımı yok.
              </div>
              <ul v-else class="acm-list">
                <li
                  v-for="c in preview.load_cases"
                  :key="c.id"
                  class="acm-item"
                  :class="{ active: selectedCases.has(c.id) }"
                  @click="toggleCase(c.id)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedCases.has(c.id)"
                    @click.stop
                    @change="toggleCase(c.id)"
                  />
                  <div class="acm-item-main">
                    <div class="acm-item-title">
                      {{ c.id }}
                      <span class="acm-tag" :class="typeClass(c.type)">
                        {{ typeLabel(c.type) }}
                      </span>
                    </div>
                    <div class="acm-item-meta">
                      <span v-if="c.self_weight_factor > 0">
                        <Icon name="lucide:weight" /> öz ağırlık ×{{ c.self_weight_factor }}
                      </span>
                      <span v-if="c.n_point_loads">
                        <Icon name="lucide:target" /> {{ c.n_point_loads }} noktasal
                      </span>
                      <span v-if="c.n_distributed_loads">
                        <Icon name="lucide:stretch-horizontal" /> {{ c.n_distributed_loads }} yayılı
                      </span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Kombinasyonlar -->
            <div v-if="preview.combinations.length > 0" class="acm-section">
              <div class="section-head">
                <h4>Yük Kombinasyonları</h4>
                <button type="button" class="link-btn" @click="toggleAllCombos">
                  {{ allCombosSelected ? 'Tümünü kaldır' : 'Tümünü seç' }}
                </button>
              </div>
              <ul class="acm-list">
                <li
                  v-for="c in preview.combinations"
                  :key="c.id"
                  class="acm-item"
                  :class="{ active: selectedCombos.has(c.id) }"
                  @click="toggleCombo(c.id)"
                >
                  <input
                    type="checkbox"
                    :checked="selectedCombos.has(c.id)"
                    @click.stop
                    @change="toggleCombo(c.id)"
                  />
                  <div class="acm-item-main">
                    <div class="acm-item-title">{{ c.id }}</div>
                    <div class="acm-item-meta combo-formula">
                      {{ formatFactors(c.factors) }}
                    </div>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Modal analiz -->
            <div class="acm-section">
              <div class="section-head">
                <h4>Modal Analiz</h4>
              </div>
              <label class="acm-row">
                <input
                  type="checkbox"
                  v-model="runModal"
                />
                <span>Modal analiz çalıştır (öz frekans & mod şekilleri)</span>
              </label>
              <label v-if="runModal || runRS" class="acm-row acm-sub">
                <span class="acm-label">Mod sayısı:</span>
                <input
                  type="number"
                  v-model.number="modalNModes"
                  min="3"
                  max="50"
                  class="acm-num-input"
                />
              </label>
            </div>

            <!-- Response Spectrum (TBDY 2018) -->
            <div class="acm-section">
              <div class="section-head">
                <h4>Response Spectrum Analizi (TBDY 2018)</h4>
              </div>
              <label class="acm-row">
                <input type="checkbox" v-model="runRS" />
                <span>Tasarım spektrumu analizi çalıştır</span>
              </label>

              <div v-if="runRS" class="rs-params">
                <div class="rs-row">
                  <label>
                    <span class="acm-label">Ss (g):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      v-model.number="spectrum.Ss"
                      class="acm-num-input"
                    />
                  </label>
                  <label>
                    <span class="acm-label">S1 (g):</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      v-model.number="spectrum.S1"
                      class="acm-num-input"
                    />
                  </label>
                  <label>
                    <span class="acm-label">Zemin:</span>
                    <select v-model="spectrum.soil" class="acm-select">
                      <option value="ZA">ZA — Kaya</option>
                      <option value="ZB">ZB — Sert kaya</option>
                      <option value="ZC">ZC — Sıkı kum/çakıl</option>
                      <option value="ZD">ZD — Gevşek zemin</option>
                      <option value="ZE">ZE — Yumuşak zemin</option>
                    </select>
                  </label>
                </div>

                <div class="rs-row">
                  <label>
                    <span class="acm-label">R:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      v-model.number="spectrum.R"
                      class="acm-num-input"
                      title="Davranış katsayısı (süneklik)"
                    />
                  </label>
                  <label>
                    <span class="acm-label">I:</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="2"
                      v-model.number="spectrum.I"
                      class="acm-num-input"
                      title="Önem katsayısı"
                    />
                  </label>
                </div>

                <div class="rs-row">
                  <label class="acm-row acm-sub">
                    <input type="checkbox" v-model="spectrum.run_x" />
                    <span>X yönü (EQX_RS)</span>
                  </label>
                  <label class="acm-row acm-sub">
                    <input type="checkbox" v-model="spectrum.run_y" />
                    <span>Y yönü (EQY_RS)</span>
                  </label>
                </div>

                <div class="rs-hint">
                  <Icon name="lucide:info" />
                  Harita değerleri <strong>afad.gov.tr</strong> deprem haritasından;
                  R değeri TBDY Tablo 4.1'den seçilir (konvansiyonel RC çerçeve ≈ 4,
                  süneklik düzeyi yüksek ≈ 8).
                </div>
              </div>
            </div>
          </template>
        </div>

        <footer class="acm-footer">
          <div class="acm-selection-info">
            {{ selectionSummary }}
          </div>
          <div class="acm-actions">
            <button type="button" class="btn-ghost" @click="$emit('close')">
              İptal
            </button>
            <button
              type="button"
              class="btn-primary"
              :disabled="!canRun"
              @click="runAnalysis"
            >
              <Icon name="lucide:play" />
              Analizi Başlat
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'
import { useProjectStore } from '~/stores/project'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  run: [options: Record<string, unknown>]
}>()

const projectStore = useProjectStore()
const analysisStore = useAnalysisStore()

const loading = ref(false)
const error = ref('')
const runModal = ref(false)
const modalNModes = ref(6)

const runRS = ref(false)
const spectrum = ref({
  Ss: 1.0,
  S1: 0.3,
  soil: 'ZC' as 'ZA' | 'ZB' | 'ZC' | 'ZD' | 'ZE',
  R: 4.0,
  I: 1.0,
  run_x: true,
  run_y: true,
})

const selectedCases = ref(new Set<string>())
const selectedCombos = ref(new Set<string>())

const currentFile = computed(() => projectStore.currentFile)
const projectId = computed(() => projectStore.activeProjectId ?? '')
const currentFileName = computed(() => currentFile.value?.name ?? '—')

const preview = computed(() =>
  currentFile.value ? analysisStore.current(currentFile.value.id).preview : null,
)

const allCasesSelected = computed(
  () => preview.value !== null && selectedCases.value.size === preview.value.load_cases.length,
)
const allCombosSelected = computed(
  () => preview.value !== null && selectedCombos.value.size === preview.value.combinations.length,
)

const canRun = computed(() =>
  (selectedCases.value.size > 0 || selectedCombos.value.size > 0
   || runModal.value || runRS.value),
)

const selectionSummary = computed(() => {
  const parts: string[] = []
  if (selectedCases.value.size > 0) parts.push(`${selectedCases.value.size} yük durumu`)
  if (selectedCombos.value.size > 0) parts.push(`${selectedCombos.value.size} kombinasyon`)
  if (runModal.value) parts.push(`modal (${modalNModes.value} mod)`)
  if (runRS.value) {
    const dirs: string[] = []
    if (spectrum.value.run_x) dirs.push('X')
    if (spectrum.value.run_y) dirs.push('Y')
    parts.push(`RS ${dirs.join('+') || '—'}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'En az bir öğe seç'
})

async function loadPreview() {
  if (!currentFile.value || !projectId.value) return
  loading.value = true
  error.value = ''
  try {
    const p = await analysisStore.loadPreview(projectId.value, currentFile.value.id)
    if (p) {
      // Varsayılan: hepsi seçili
      selectedCases.value = new Set(p.load_cases.map(c => c.id))
      selectedCombos.value = new Set(p.combinations.map(c => c.id))
    }
  } catch (e: any) {
    error.value = e?.message ?? 'Önizleme alınamadı'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) loadPreview()
  },
  { immediate: true },
)

function toggleCase(id: string) {
  const s = new Set(selectedCases.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedCases.value = s
}

function toggleAllCases() {
  if (!preview.value) return
  selectedCases.value = allCasesSelected.value
    ? new Set()
    : new Set(preview.value.load_cases.map(c => c.id))
}

function toggleCombo(id: string) {
  const s = new Set(selectedCombos.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedCombos.value = s
}

function toggleAllCombos() {
  if (!preview.value) return
  selectedCombos.value = allCombosSelected.value
    ? new Set()
    : new Set(preview.value.combinations.map(c => c.id))
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    dead: 'Ölü', live: 'Hareketli', wind: 'Rüzgar', snow: 'Kar',
    earthquake_x: 'Deprem X', earthquake_y: 'Deprem Y',
    temperature: 'Sıcaklık', other: 'Diğer',
  }
  return map[t] ?? t
}

function typeClass(t: string): string {
  if (t === 'dead') return 'tag-dead'
  if (t === 'live') return 'tag-live'
  if (t.startsWith('earthquake')) return 'tag-eq'
  return 'tag-other'
}

function formatFactors(factors: Record<string, number>): string {
  return Object.entries(factors)
    .map(([k, v]) => {
      const sign = v < 0 ? '−' : '+'
      const abs = Math.abs(v)
      return `${sign} ${abs}·${k}`
    })
    .join(' ')
    .replace(/^\+ /, '')
}

function runAnalysis() {
  const options: Record<string, unknown> = {
    selected_load_cases: [...selectedCases.value],
    selected_combinations: [...selectedCombos.value],
    modal: runModal.value || runRS.value,    // RS modal gerektiriyor
    modal_n_modes: modalNModes.value,
    response_spectrum: runRS.value,
  }
  if (runRS.value) {
    options.spectrum_params = { ...spectrum.value }
  }
  emit('run', options)
  emit('close')
}
</script>

<style scoped>
.acm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.acm-modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  width: 100%;
  max-width: 640px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.acm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--border-default);
}

.acm-title {
  margin: 0 0 0.25rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.acm-subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.acm-close {
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
}

.acm-close:hover {
  color: var(--text-primary);
  border-color: var(--text-primary);
}

.acm-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
}

.acm-loading,
.acm-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.acm-error {
  color: #ef4444;
}

.acm-section {
  margin-bottom: 1.5rem;
}

.acm-section:last-child {
  margin-bottom: 0;
}

.stat-row {
  display: flex;
  gap: 1.25rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border-radius: 10px;
}

.stat {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.stat span {
  display: inline-block;
  font-weight: 700;
  color: var(--text-primary);
  margin-right: 0.25rem;
  font-variant-numeric: tabular-nums;
}

.acm-warn {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  color: #f59e0b;
  font-size: 0.8125rem;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.625rem;
}

.section-head h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.link-btn {
  background: transparent;
  border: none;
  color: var(--accent-blue);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.acm-empty-msg {
  padding: 0.75rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.acm-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.acm-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.acm-item:hover {
  border-color: var(--accent-blue);
}

.acm-item.active {
  background: rgba(59, 130, 246, 0.08);
  border-color: var(--accent-blue);
}

.acm-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent-blue);
  cursor: pointer;
}

.acm-item-main {
  flex: 1;
  min-width: 0;
}

.acm-item-title {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.acm-item-meta {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.acm-item-meta span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.acm-item-meta :deep(svg) {
  width: 12px;
  height: 12px;
}

.combo-formula {
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--text-muted);
}

.acm-tag {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.tag-dead { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }
.tag-live { background: rgba(16, 185, 129, 0.2); color: #10b981; }
.tag-eq   { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.tag-other { background: rgba(139, 92, 246, 0.2); color: #8b5cf6; }

.acm-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}

.acm-row input[type="checkbox"] {
  accent-color: var(--accent-blue);
}

.acm-sub {
  padding-left: 1.75rem;
}

.acm-label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.acm-num-input {
  width: 64px;
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
  text-align: center;
}

.acm-select {
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.rs-params {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.75rem;
  margin-top: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
}

.rs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.rs-row label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.rs-hint {
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin-top: 0.25rem;
  padding: 0.5rem 0.625rem;
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  line-height: 1.4;
}

.rs-hint :deep(svg) {
  color: var(--accent-blue);
  flex-shrink: 0;
  margin-top: 2px;
}

.acm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-default);
}

.acm-selection-info {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.acm-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-ghost,
.btn-primary {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.btn-ghost {
  background: transparent;
  border-color: var(--border-default);
  color: var(--text-secondary);
}

.btn-ghost:hover {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.btn-primary {
  background: var(--accent-blue);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
