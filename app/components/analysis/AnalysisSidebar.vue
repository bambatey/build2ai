<template>
  <aside class="as-root">
    <div class="as-section">
      <div class="as-section-title">Model</div>
      <button
        type="button"
        class="as-item"
        :class="{ active: active === 'summary' }"
        @click="select('summary')"
      >
        <Icon name="lucide:layout-dashboard" />
        <span>Özet</span>
      </button>
    </div>

    <div class="as-section">
      <div class="as-section-title">Tablolar</div>
      <button
        v-for="t in tables"
        :key="t.id"
        type="button"
        class="as-item"
        :class="{ active: active === t.id }"
        @click="select(t.id)"
      >
        <Icon :name="t.icon" />
        <span>{{ t.label }}</span>
        <span v-if="loadedFor(t.id)" class="as-dot ok" title="Yüklendi" />
        <span v-else-if="loadingFor(t.id)" class="as-dot loading" title="Yükleniyor">
          <Icon name="lucide:loader-2" class="spin" />
        </span>
      </button>
    </div>

    <div class="as-foot">
      <div class="foot-label">Seçili:</div>
      <div class="foot-case">{{ selectedCase || '—' }}</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'

type TableView = 'summary' | 'displacements' | 'reactions' | 'forces' | 'modes'
type TableId = Exclude<TableView, 'summary'>

const props = defineProps<{
  fileId: string
  active: TableView
}>()

const emit = defineEmits<{
  (e: 'update:active', v: TableView): void
}>()

const analysisStore = useAnalysisStore()
const fileState = computed(() => analysisStore.current(props.fileId))
const selectedCase = computed(() => fileState.value.selectedLoadCase)

const tables: Array<{ id: TableId; label: string; icon: string }> = [
  { id: 'displacements', label: 'Deplasmanlar', icon: 'lucide:move' },
  { id: 'reactions', label: 'Reaksiyonlar', icon: 'lucide:anchor' },
  { id: 'forces', label: 'Kesit Tesirleri', icon: 'lucide:activity' },
  { id: 'modes', label: 'Modlar', icon: 'lucide:waves' },
]

function select(v: TableView) {
  emit('update:active', v)
}

function loadedFor(id: TableId): boolean {
  return analysisStore.isTableLoaded(props.fileId, id)
}

function loadingFor(id: TableId): boolean {
  return analysisStore.isTableLoading(props.fileId, id)
}
</script>

<style scoped>
.as-root {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0.75rem 0.5rem 0.5rem;
  gap: 0.75rem;
}

.as-section { display: flex; flex-direction: column; gap: 1px; }
.as-section-title {
  padding: 0 0.625rem 0.25rem;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.as-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s, border-color 0.1s;
}
.as-item:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-default);
}
.as-item.active {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: var(--accent-blue);
}
.as-item :deep(svg) { width: 15px; height: 15px; }

.as-dot {
  margin-left: auto;
  width: 10px; height: 10px;
  display: inline-flex; align-items: center; justify-content: center;
}
.as-dot.ok::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-green);
}
.as-dot.loading :deep(svg) { width: 10px; height: 10px; color: var(--text-muted); }

.as-foot {
  margin-top: auto;
  padding: 0.5rem 0.625rem;
  border-top: 1px solid var(--border-default);
  font-size: 0.7rem;
}
.foot-label { color: var(--text-muted); margin-bottom: 2px; }
.foot-case {
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: var(--text-primary);
  word-break: break-all;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
