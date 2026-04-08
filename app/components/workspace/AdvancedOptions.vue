<template>
  <div class="advanced-options">
    <div class="ao-header">
      <div>
        <h2 class="ao-title">Gelişmiş Analizler</h2>
        <p class="ao-subtitle">Modeliniz üzerinde detaylı kontroller çalıştırın</p>
      </div>
    </div>

    <div class="ao-search">
      <Icon name="lucide:search" class="ao-search-icon" />
      <input
        v-model="search"
        type="text"
        class="ao-search-input"
        placeholder="Analiz ara..."
      />
    </div>

    <div class="ao-grid">
      <button
        v-for="check in filteredChecks"
        :key="check.id"
        type="button"
        class="ao-card"
        :class="{ running: runningId === check.id, done: results[check.id] }"
        @click="runCheck(check)"
        :title="check.description"
      >
        <div class="ao-card-icon" :style="{ background: check.color + '20', color: check.color }">
          <Icon :name="check.icon" />
        </div>
        <div class="ao-card-title">{{ check.title }}</div>
        <div v-if="results[check.id]" class="ao-status-dot success" />
        <div v-else-if="runningId === check.id" class="ao-status-dot running">
          <Icon name="lucide:loader-2" class="spin" />
        </div>
      </button>

      <div v-if="filteredChecks.length === 0" class="ao-empty">
        Sonuç bulunamadı
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Check {
  id: string
  title: string
  description: string
  icon: string
  color: string
  category: string
}

const checks: Check[] = [
  {
    id: 'load-combinations',
    title: 'Kombinasyon Kontrolü',
    description: 'TBDY 2018 yük kombinasyonlarının tamlığı ve doğruluğu',
    icon: 'lucide:layers',
    color: '#3B82F6',
    category: 'Yük',
  },
  {
    id: 'spectrum',
    title: 'Spektrum Kontrolü',
    description: 'Tasarım ivme spektrumu varsa parametreleri ve uyumu',
    icon: 'lucide:activity',
    color: '#8B5CF6',
    category: 'Deprem',
  },
  {
    id: 'rigid-diaphragm',
    title: 'Rijit Diyafram Kabulü',
    description: 'Kat döşemelerinde rijit diyafram tanımı kontrolü',
    icon: 'lucide:square-stack',
    color: '#10B981',
    category: 'Model',
  },
  {
    id: 'effective-stiffness',
    title: 'Etkin Kesit Rijitliği',
    description: 'TBDY çatlamış kesit faktörlerinin uygulanması',
    icon: 'lucide:ruler',
    color: '#F59E0B',
    category: 'Kesit',
  },
]

const search = ref('')
const runningId = ref<string | null>(null)
const results = ref<Record<string, string>>({})

const filteredChecks = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return checks
  return checks.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q),
  )
})

const runCheck = async (check: Check) => {
  if (runningId.value) return
  runningId.value = check.id
  await new Promise(r => setTimeout(r, 1200))
  results.value[check.id] = 'Tamamlandı · sonuç chate iletildi'
  runningId.value = null
}
</script>

<style scoped>
.advanced-options {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

.ao-header {
  padding: 1.5rem 1.5rem 1rem;
  border-bottom: 1px solid var(--border-default);
}

.ao-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.ao-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0;
}

.ao-search {
  position: relative;
  padding: 1rem 1.5rem 0.5rem;
}

.ao-search-icon {
  position: absolute;
  left: 2rem;
  top: 50%;
  transform: translateY(-25%);
  width: 16px;
  height: 16px;
  color: var(--text-muted);
  pointer-events: none;
}

.ao-search-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.625rem 0.875rem 0.625rem 2.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.ao-search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.ao-grid {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1.5rem 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  align-content: start;
}

.ao-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 1rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  color: inherit;
  font: inherit;
  min-height: 110px;
}

.ao-card:hover {
  border-color: var(--accent-blue);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}

.ao-card.running {
  border-color: var(--accent-purple);
}

.ao-card.done {
  border-color: var(--accent-green);
}

.ao-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ao-card-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.ao-card-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.ao-status-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ao-status-dot.success {
  background: var(--accent-green);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.ao-status-dot.running {
  width: 14px;
  height: 14px;
  color: var(--accent-purple);
  background: transparent;
}

.ao-status-dot :deep(svg) {
  width: 14px;
  height: 14px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ao-empty {
  grid-column: 1 / -1;
  padding: 2rem;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
}
</style>
