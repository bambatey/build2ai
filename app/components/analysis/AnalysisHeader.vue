<template>
  <header class="ah-root">
    <!-- Sol: geri + dosya adı + analiz bilgisi -->
    <div class="ah-left">
      <button type="button" class="ah-back" @click="$emit('back')">
        <Icon name="lucide:arrow-left" />
      </button>
      <div class="ah-title-block">
        <div class="ah-title">
          <Icon name="lucide:activity" class="ah-title-icon" />
          Yapısal Analiz
        </div>
        <div class="ah-subtitle">
          <span class="ah-file">{{ fileName }}</span>
          <span v-if="currentId" class="ah-analysis">
            <Icon name="lucide:dot" />
            <span class="ah-id">{{ currentId.slice(0, 14) }}…</span>
            <span v-if="status?.status" class="ah-badge" :class="`badge-${status.status}`">
              {{ statusLabel(status.status) }}
            </span>
            <span v-if="status?.duration_ms != null" class="ah-dur">
              {{ status.duration_ms }}ms
            </span>
          </span>
        </div>
      </div>
    </div>

    <!-- Orta: case seçici -->
    <div v-if="availableCases.length > 0" class="ah-case" ref="caseSelectorRef">
      <label class="ah-case-label">Yük durumu:</label>
      <button
        type="button"
        class="ah-case-trigger"
        :class="{ open: caseDropdownOpen }"
        @click="caseDropdownOpen = !caseDropdownOpen"
      >
        <span class="case-pill" :class="{ combo: isSelectedCombo }">
          {{ selectedCase || 'Seç…' }}
        </span>
        <span class="case-count">{{ availableCases.length }}</span>
        <Icon
          :name="caseDropdownOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
        />
      </button>

      <div v-if="caseDropdownOpen" class="ah-case-panel" @click.stop>
        <div class="ah-case-search">
          <Icon name="lucide:search" />
          <input
            ref="caseSearchInputRef"
            v-model="caseSearchQuery"
            type="text"
            placeholder="Yük durumu ara..."
          />
        </div>
        <div v-if="filteredPatternCases.length > 0" class="case-group">
          <div class="case-group-label">Load Patternleri ({{ filteredPatternCases.length }})</div>
          <div class="case-group-pills">
            <button
              v-for="c in filteredPatternCases"
              :key="c"
              type="button"
              class="pill"
              :class="{ active: selectedCase === c }"
              @click="selectCase(c)"
            >{{ c }}</button>
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
            >{{ c }}</button>
          </div>
        </div>
        <div
          v-if="filteredPatternCases.length === 0 && filteredComboCases.length === 0"
          class="case-empty"
        >Eşleşen yük durumu yok.</div>
      </div>
    </div>

    <!-- Sağ: history + run -->
    <div class="ah-right">
      <details v-if="history.length > 0" ref="historyRef" class="ah-history">
        <summary>
          <Icon name="lucide:history" />
          Geçmiş ({{ history.length }})
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
            <button class="h-delete" title="Sil" @click="deleteHistory(h)">
              <Icon name="lucide:trash-2" />
            </button>
          </li>
        </ul>
      </details>

      <button
        type="button"
        class="ah-run-btn"
        :disabled="!canRun || analysisStore.isRunning"
        @click="openConfig"
      >
        <Icon
          :name="analysisStore.isRunning ? 'lucide:loader-2' : 'lucide:play'"
          :class="{ spin: analysisStore.isRunning }"
        />
        {{ analysisStore.isRunning ? 'Çözülüyor…' : 'Analizi Çalıştır' }}
      </button>
    </div>

    <WorkspaceAnalysisConfigModal
      :open="configOpen"
      @close="configOpen = false"
      @run="handleRunWithOptions"
    />
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'

const props = defineProps<{
  projectId: string
  fileId: string
  fileName: string
}>()

defineEmits<{ (e: 'back'): void }>()

const analysisStore = useAnalysisStore()

const configOpen = ref(false)
const caseDropdownOpen = ref(false)
const caseSearchQuery = ref('')
const caseSelectorRef = ref<HTMLElement | null>(null)
const caseSearchInputRef = ref<HTMLInputElement | null>(null)

const fileState = computed(() => analysisStore.current(props.fileId))
const status = computed(() => fileState.value.status)
const currentId = computed(() => fileState.value.currentId)
const history = computed(() => fileState.value.history)
const availableCases = computed(() => analysisStore.availableLoadCases(props.fileId))
const selectedCase = computed(() => fileState.value.selectedLoadCase)
const canRun = computed(() => !!props.projectId && !!props.fileId)

const comboCaseIds = computed<Set<string>>(() => {
  const p = fileState.value.preview
  if (!p) return new Set()
  return new Set(p.combinations.map(c => c.id))
})

const isSelectedCombo = computed(
  () => !!selectedCase.value && comboCaseIds.value.has(selectedCase.value),
)

const filteredPatternCases = computed(() => {
  const q = caseSearchQuery.value.trim().toLowerCase()
  return availableCases.value
    .filter(c => !comboCaseIds.value.has(c))
    .filter(c => !q || c.toLowerCase().includes(q))
})

const filteredComboCases = computed(() => {
  const q = caseSearchQuery.value.trim().toLowerCase()
  return availableCases.value
    .filter(c => comboCaseIds.value.has(c))
    .filter(c => !q || c.toLowerCase().includes(q))
})

function openConfig() {
  if (canRun.value) configOpen.value = true
}

function selectCase(c: string) {
  analysisStore.setLoadCase(props.fileId, c)
  caseDropdownOpen.value = false
  caseSearchQuery.value = ''
}

async function handleRunWithOptions(options: Record<string, unknown>) {
  await analysisStore.run(props.projectId, props.fileId, options as any)
}

async function selectHistory(h: { analysis_id: string }) {
  await analysisStore.selectAnalysis(props.projectId, props.fileId, h.analysis_id)
}

async function deleteHistory(h: { analysis_id: string }) {
  if (!confirm(`Analiz ${h.analysis_id} silinsin mi?`)) return
  await analysisStore.remove(props.projectId, props.fileId, h.analysis_id)
}

function statusLabel(s: string): string {
  return {
    completed: 'tamamlandı',
    running: 'çalışıyor',
    queued: 'sırada',
    failed: 'başarısız',
  }[s] ?? s
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit',
    })
  } catch { return iso }
}

watch(caseDropdownOpen, async (open) => {
  if (open) {
    await nextTick()
    caseSearchInputRef.value?.focus()
  }
})

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
  // Preview'ı da tembel yükle — combo id setini besler
  if (!fileState.value.preview) {
    analysisStore.loadPreview(props.projectId, props.fileId).catch(() => {})
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.ah-root {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-secondary);
  flex-shrink: 0;
  min-height: 56px;
}

.ah-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; flex: 0 0 auto; }
.ah-back {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--border-default);
  color: var(--text-muted); border-radius: 6px; cursor: pointer;
}
.ah-back:hover { color: var(--text-primary); border-color: var(--border-active); }

.ah-title-block { min-width: 0; }
.ah-title {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.9375rem; font-weight: 600; color: var(--text-primary);
}
.ah-title-icon { color: var(--accent-blue); }
.ah-subtitle {
  display: flex; align-items: center; gap: 0.375rem;
  font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;
}
.ah-file { font-weight: 500; color: var(--text-primary); }
.ah-analysis { display: inline-flex; align-items: center; gap: 0.375rem; opacity: 0.9; }
.ah-id { font-family: ui-monospace, SFMono-Regular, monospace; }
.ah-dur { color: var(--accent-green); font-weight: 600; }

.ah-badge {
  padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;
}
.badge-completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.badge-running { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.badge-queued { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
.badge-failed { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

.ah-case {
  position: relative; display: flex; align-items: center; gap: 0.5rem;
  flex: 0 1 auto;
}
.ah-case-label { font-size: 0.75rem; color: var(--text-secondary); }
.ah-case-trigger {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.625rem; background: var(--bg-tertiary);
  border: 1px solid var(--border-default); border-radius: 6px;
  color: var(--text-primary); cursor: pointer; font-size: 0.8125rem;
}
.ah-case-trigger:hover { border-color: var(--border-active); }
.ah-case-trigger.open { border-color: var(--accent-blue); }
.case-pill {
  padding: 2px 8px; border-radius: 4px; background: var(--accent-blue);
  color: #fff; font-weight: 600; font-size: 0.75rem;
}
.case-pill.combo { background: var(--accent-purple, #8b5cf6); }
.case-count {
  padding: 0 6px; border-radius: 4px; font-size: 0.7rem; opacity: 0.7;
  border: 1px solid var(--border-default);
}

.ah-case-panel {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 50;
  width: min(520px, 80vw); max-height: 60vh; overflow-y: auto;
  background: var(--bg-secondary); border: 1px solid var(--border-default);
  border-radius: 8px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  padding: 0.5rem;
}
.ah-case-search {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.375rem 0.5rem; border: 1px solid var(--border-default);
  border-radius: 6px; margin-bottom: 0.5rem;
}
.ah-case-search input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-primary); font-size: 0.8125rem;
}
.case-group { margin-top: 0.5rem; }
.case-group-label {
  font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 0.25rem;
}
.case-group-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.pill {
  padding: 3px 8px; background: var(--bg-tertiary);
  border: 1px solid var(--border-default); border-radius: 4px;
  color: var(--text-primary); font-size: 0.75rem; cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.pill:hover { border-color: var(--accent-blue); }
.pill.active {
  background: var(--accent-blue); color: #fff; border-color: var(--accent-blue);
}
.pill.combo-pill {
  border-color: var(--accent-purple, #8b5cf6);
  color: var(--accent-purple, #8b5cf6);
}
.pill.combo-pill.active {
  background: var(--accent-purple, #8b5cf6); color: #fff;
}
.case-empty {
  padding: 1rem; text-align: center; font-size: 0.8125rem;
  color: var(--text-muted);
}

.ah-right { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }

.ah-history {
  position: relative;
}
.ah-history > summary {
  list-style: none; cursor: pointer;
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.375rem 0.625rem; background: var(--bg-tertiary);
  border: 1px solid var(--border-default); border-radius: 6px;
  color: var(--text-primary); font-size: 0.8125rem;
}
.ah-history > summary::-webkit-details-marker { display: none; }
.ah-history[open] > summary { border-color: var(--accent-blue); }

.history-list {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 40;
  list-style: none; margin: 0; padding: 0.375rem;
  background: var(--bg-secondary); border: 1px solid var(--border-default);
  border-radius: 8px; min-width: 320px; max-height: 50vh; overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
}
.history-list li { display: flex; align-items: center; gap: 0.25rem; }
.history-list li.active .history-item { border-color: var(--accent-blue); }
.history-item {
  flex: 1; display: flex; gap: 0.5rem; padding: 0.375rem 0.5rem;
  background: var(--bg-tertiary); border: 1px solid var(--border-default);
  border-radius: 6px; font-size: 0.75rem; color: var(--text-primary);
  cursor: pointer; text-align: left;
}
.h-id { font-family: ui-monospace, SFMono-Regular, monospace; color: var(--text-muted); }
.h-date { flex: 1; color: var(--text-secondary); }
.h-duration { color: var(--accent-green); font-weight: 600; }
.h-delete {
  padding: 4px; background: transparent; border: 1px solid var(--border-default);
  border-radius: 6px; color: var(--text-muted); cursor: pointer;
}
.h-delete:hover { color: #ef4444; border-color: #ef4444; }

.ah-run-btn {
  display: inline-flex; align-items: center; gap: 0.375rem;
  padding: 0.5rem 0.875rem; background: var(--accent-blue);
  color: #fff; border: none; border-radius: 6px;
  font-weight: 600; font-size: 0.8125rem; cursor: pointer;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}
.ah-run-btn:hover:not(:disabled) { transform: translateY(-1px); }
.ah-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
