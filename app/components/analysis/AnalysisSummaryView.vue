<template>
  <div class="sv-root">
    <div v-if="!status" class="sv-empty">
      <Icon name="lucide:play-circle" class="sv-empty-icon" />
      <h3>Henüz analiz yok</h3>
      <p>Sağ üstten "Analizi Çalıştır" ile başla.</p>
    </div>

    <template v-else>
      <!-- Özet kartları -->
      <div class="sv-summary">
        <div class="sc"><Icon name="lucide:circle-dot" style="color:#3B82F6" />
          <div class="sc-v">{{ summary?.n_nodes ?? '—' }}</div>
          <div class="sc-l">Düğüm</div>
        </div>
        <div class="sc"><Icon name="lucide:minus" style="color:#10B981" />
          <div class="sc-v">{{ summary?.n_frame_elements ?? '—' }}</div>
          <div class="sc-l">Frame</div>
        </div>
        <div class="sc"><Icon name="lucide:square" style="color:#8B5CF6" />
          <div class="sc-v">{{ summary?.n_shell_elements ?? '—' }}</div>
          <div class="sc-l">Shell</div>
        </div>
        <div class="sc"><Icon name="lucide:grid-3x3" style="color:#F59E0B" />
          <div class="sc-v">{{ summary?.n_dofs_free ?? '—' }}/{{ summary?.n_dofs_total ?? '—' }}</div>
          <div class="sc-l">DOF</div>
        </div>
        <div class="sc"><Icon name="lucide:move" style="color:#EF4444" />
          <div class="sc-v">{{ formatDisp(summary?.max_displacement) }}</div>
          <div class="sc-l">Max Yer Değ.</div>
        </div>
        <div class="sc"><Icon name="lucide:layers" style="color:#EC4899" />
          <div class="sc-v">{{ summary?.n_load_cases ?? '—' }}</div>
          <div class="sc-l">Yük Durumu</div>
        </div>
        <div v-if="summary?.n_combinations != null" class="sc">
          <Icon name="lucide:git-merge" style="color:#14B8A6" />
          <div class="sc-v">{{ summary.n_combinations }}</div>
          <div class="sc-l">Kombinasyon</div>
        </div>
        <div v-if="summary?.fundamental_period" class="sc">
          <Icon name="lucide:waves" style="color:#0EA5E9" />
          <div class="sc-v">{{ summary.fundamental_period.toFixed(3) }}s</div>
          <div class="sc-l">T<sub>1</sub></div>
        </div>
      </div>

      <!-- Uyarılar -->
      <div v-if="warnings.length > 0" class="sv-warnings">
        <div class="warn-head" @click="warnOpen = !warnOpen">
          <Icon name="lucide:alert-triangle" />
          <strong>Uyarılar ({{ warnings.length }})</strong>
          <Icon :name="warnOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'" />
        </div>
        <ul v-if="warnOpen" class="warn-list">
          <li v-for="(w, i) in warnings.slice(0, 50)" :key="i">{{ w }}</li>
          <li v-if="warnings.length > 50" class="warn-more">
            … {{ warnings.length - 50 }} uyarı daha
          </li>
        </ul>
      </div>

      <!-- Yön -->
      <div class="sv-hint">
        <Icon name="lucide:info" />
        Tablo görmek için soldaki menüden birini seç. Her tablo ilk tıklamada
        ayrı bir istek olarak yüklenir.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAnalysisStore } from '~/stores/analysis'

const props = defineProps<{ fileId: string }>()

const analysisStore = useAnalysisStore()
const fileState = computed(() => analysisStore.current(props.fileId))
const status = computed(() => fileState.value.status)
const summary = computed(() => status.value?.summary ?? null)
const warnings = computed<string[]>(() => status.value?.warnings ?? [])
const warnOpen = ref(false)

function formatDisp(v: number | undefined): string {
  if (v == null || !v) return '0'
  if (Math.abs(v) < 1e-3) return `${(v * 1000).toFixed(3)} mm`
  return `${v.toFixed(4)} m`
}
</script>

<style scoped>
.sv-root { padding: 1.25rem 1.5rem; }

.sv-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 5rem 2rem; text-align: center; color: var(--text-secondary);
}
.sv-empty-icon { width: 56px; height: 56px; color: var(--text-muted); margin-bottom: 1rem; }
.sv-empty h3 { font-size: 1.125rem; color: var(--text-primary); margin: 0 0 0.25rem; }

.sv-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.sc {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem;
  display: flex; flex-direction: column; gap: 4px;
}
.sc-v { font-size: 1.25rem; font-weight: 600; color: var(--text-primary); }
.sc-l { font-size: 0.75rem; color: var(--text-secondary); }

.sv-warnings {
  margin-bottom: 1.25rem;
  padding: 0.625rem 0.875rem;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 8px;
  color: #f59e0b;
  font-size: 0.8125rem;
}
.warn-head { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none; }
.warn-head strong { flex: 1; }
.warn-list {
  list-style: disc;
  padding: 0.5rem 0 0 2rem;
  margin: 0;
  max-height: 240px; overflow-y: auto;
  color: var(--text-secondary); font-size: 0.75rem;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.warn-more { list-style: none; font-style: italic; margin-left: -1rem; }

.sv-hint {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}
</style>
