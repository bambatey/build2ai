<template>
  <div class="quick-start card">
    <h3 class="text-lg font-semibold mb-4">Hızlı Başla</h3>

    <div class="actions space-y-3">
      <button
        v-for="action in quickActions"
        :key="action.id"
        @click="action.onClick"
        class="action-btn w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] transition-all group"
      >
        <div class="action-icon" :style="{ backgroundColor: `${action.color}20` }">
          <Icon :name="action.icon" class="w-5 h-5" :style="{ color: action.color }" />
        </div>

        <div class="action-content flex-1 text-left">
          <p class="action-title text-sm font-medium text-primary">{{ action.title }}</p>
          <p class="action-desc text-xs text-secondary mt-0.5">{{ action.description }}</p>
        </div>

        <Icon name="lucide:chevron-right" class="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useProjectStore } from '~/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

const startNew = () => {
  projectStore.closeProject()
  router.push({ path: '/workspace', query: { mode: 'new' } })
}

const quickActions = [
  {
    id: 'upload',
    title: 'Dosya Yükle',
    description: 'SAP2000, ETABS veya diğer analiz dosyalarını yükle',
    icon: 'lucide:upload',
    color: 'var(--accent-blue)',
    onClick: startNew,
  },
  {
    id: 'new-session',
    title: 'Yeni Proje',
    description: 'AI asistan ile yeni bir analiz oturumu başlat',
    icon: 'lucide:plus-circle',
    color: 'var(--accent-purple)',
    onClick: startNew,
  },
  {
    id: 'template',
    title: 'Şablon Seç',
    description: 'Hazır model şablonlarından birini seç ve düzenle',
    icon: 'lucide:layout-template',
    color: 'var(--accent-green)',
    onClick: () => {
      console.log('Şablon seç')
    },
  },
]
</script>

<style scoped>
.action-btn {
  cursor: pointer;
  border: 1px solid transparent;
  text-align: left;
}

.action-btn:hover {
  border-color: var(--border-active);
}

.action-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
