<template>
  <div class="agent-panel">
    <div class="agent-header">
      <div class="agent-title-row">
        <span class="status-dot" :class="statusClass" />
        <span class="agent-title">YEREL KLASÖR</span>
      </div>
      <button
        v-if="agent.connected.value"
        type="button"
        class="refresh-btn"
        title="Yenile"
        @click="agent.refreshFiles()"
      >
        <Icon name="lucide:refresh-cw" />
      </button>
    </div>

    <!-- Disconnected -->
    <div v-if="!agent.connected.value" class="agent-empty">
      <Icon name="lucide:plug-zap" class="empty-icon" />
      <div class="empty-title">Agent bağlı değil</div>
      <div class="empty-text">
        StructAI Agent uygulamasını başlatın.
      </div>
    </div>

    <!-- Connected, no root -->
    <div v-else-if="!agent.root.value" class="agent-empty">
      <Icon name="lucide:folder-search" class="empty-icon" />
      <div class="empty-title">Klasör seçilmedi</div>
      <div class="empty-text">
        Agent uygulamasından bir klasör seçin.
      </div>
    </div>

    <!-- Connected with root -->
    <template v-else>
      <div class="agent-root" :title="agent.root.value">
        <Icon name="lucide:folder-open" class="root-icon" />
        <span class="root-path">{{ rootDisplay }}</span>
      </div>

      <div class="agent-list">
        <!-- .sdb files: show with a Convert button -->
        <div v-if="sdbFiles.length > 0" class="group-label">.SDB DOSYALARI</div>
        <div
          v-for="file in sdbFiles"
          :key="file.path"
          class="file-item sdb-item"
          :title="file.path"
        >
          <Icon name="lucide:file-box" class="file-icon" />
          <span class="file-name">{{ file.name }}</span>
          <button
            type="button"
            class="convert-btn"
            :disabled="convertingPath === file.path"
            @click="handleConvert(file)"
            :title="'s2k\\\' altına .s2k olarak dönüştür'"
          >
            <Icon
              :name="convertingPath === file.path ? 'lucide:loader-2' : 'lucide:refresh-cw'"
              :class="{ spin: convertingPath === file.path }"
            />
          </button>
        </div>

        <!-- .s2k / .$2k files: openable in the workspace -->
        <div v-if="visibleFiles.length > 0" class="group-label">.S2K DOSYALARI</div>
        <button
          v-for="file in visibleFiles"
          :key="file.path"
          type="button"
          class="file-item"
          :title="file.path"
          :disabled="loadingPath === file.path"
          @click="handleOpen(file)"
        >
          <Icon name="lucide:file-text" class="file-icon" />
          <span class="file-name">{{ displayName(file) }}</span>
          <Icon
            v-if="loadingPath === file.path"
            name="lucide:loader-2"
            class="file-spin"
          />
        </button>

        <div
          v-if="sdbFiles.length === 0 && visibleFiles.length === 0"
          class="agent-empty small"
        >
          Klasör boş
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAgent, type AgentFile } from '~/composables/useAgent'
import { useProjectStore } from '~/stores/project'
import type { Project } from '~/stores/project'

const router = useRouter()
const agent = useAgent()
const projectStore = useProjectStore()

const loadingPath = ref<string | null>(null)
const convertingPath = ref<string | null>(null)

const ALLOWED_EXT = /\.(s2k|\$2k)$/i

const visibleFiles = computed(() =>
  agent.entries.value.filter(f => {
    // Only files inside the agent-managed s2k/ subfolder, and only the
    // text exports we actually understand. Everything else (.sdb, .ico,
    // .sbk, ...) is hidden so the sidebar stays focused on the things
    // the web app can open.
    if (!f.path.toLowerCase().startsWith('s2k/')) return false
    return ALLOWED_EXT.test(f.name)
  }),
)

const sdbFiles = computed(() =>
  agent.entries.value.filter(f => {
    // Only top-level .sdb files (the user's source documents). We hide
    // anything that lives under s2k/ so converted artefacts don't show
    // up alongside the originals.
    if (f.path.includes('/')) return false
    return f.name.toLowerCase().endsWith('.sdb')
  }),
)

const displayName = (file: AgentFile) =>
  // Strip the "s2k/" prefix so the panel reads cleanly.
  file.path.replace(/^s2k\//i, '')

const statusClass = computed(() => {
  if (agent.checking.value) return 'checking'
  return agent.connected.value ? 'ok' : 'down'
})

const rootDisplay = computed(() => {
  const r = agent.root.value
  if (!r) return ''
  // Compact long paths: keep last 3 segments.
  const parts = r.split(/[\\/]/).filter(Boolean)
  if (parts.length <= 3) return r
  return '...\\' + parts.slice(-3).join('\\')
})

const handleConvert = async (file: AgentFile) => {
  if (convertingPath.value) return
  convertingPath.value = file.path
  try {
    await agent.convertSdb(file.path)
    // The job runs on the agent in the background; refresh once after
    // a short delay so the resulting .s2k shows up under the converted
    // group without the user having to hit reload.
    setTimeout(() => agent.refreshFiles(), 1500)
  } catch (err) {
    console.error('Convert failed', err)
  } finally {
    convertingPath.value = null
  }
}

const handleOpen = async (file: AgentFile) => {
  if (!file.is_text) return
  loadingPath.value = file.path
  try {
    const content = await agent.readFile(file.path)
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    const baseName = file.name.replace(/\.[^.]+$/, '')

    // Reuse existing project if we already opened this file.
    const existing = projectStore.projects.find(p =>
      p.files.some(f => f.path === `agent://${file.path}`),
    )
    if (existing) {
      // Refresh content from disk in case it changed.
      const f = existing.files[0]
      if (f) f.content = content
      projectStore.openProject(existing.id)
      router.push('/workspace')
      return
    }

    const id = crypto.randomUUID()
    const project: Project = {
      id,
      name: baseName,
      format: ext,
      fileCount: 1,
      lastModified: new Date(),
      progress: 0,
      tags: ['yerel'],
      files: [
        {
          id: crypto.randomUUID(),
          name: file.name,
          type: 'file',
          path: `agent://${file.path}`,
          format: ext,
          size: file.size ?? 0,
          lastModified: file.modified ? new Date(file.modified) : new Date(),
          content,
        },
      ],
    }
    projectStore.addProject(project)
    projectStore.openProject(id)
    router.push('/workspace')
  } catch (err) {
    console.error('Agent file open failed', err)
  } finally {
    loadingPath.value = null
  }
}
</script>

<style scoped>
.agent-panel {
  border-top: 1px solid var(--border-default);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.agent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.25rem 0.5rem;
}

.agent-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.ok {
  background: var(--accent-green);
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
}

.status-dot.down {
  background: var(--accent-red);
}

.status-dot.checking {
  background: var(--accent-amber);
  animation: pulse 1.4s infinite;
}

.agent-title {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
}

.refresh-btn {
  background: transparent;
  border: 1px solid var(--border-default);
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-btn:hover {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.refresh-btn :deep(svg) {
  width: 12px;
  height: 12px;
}

.agent-root {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.root-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.root-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-height: 0;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: var(--text-secondary);
  font-size: 0.8125rem;
  transition: all 0.15s;
}

.file-item:hover:not(.disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.file-item.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.file-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-spin {
  width: 14px;
  height: 14px;
  color: var(--accent-purple);
  animation: spin 1s linear infinite;
}

.group-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  padding: 0.5rem 0.625rem 0.25rem;
}

.sdb-item {
  cursor: default;
}

.sdb-item:hover {
  background: var(--bg-tertiary);
}

.convert-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.convert-btn:hover:not(:disabled) {
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.convert-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.convert-btn :deep(svg) {
  width: 13px;
  height: 13px;
}

.spin {
  animation: spin 1s linear infinite;
}

.agent-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0.5rem;
  color: var(--text-muted);
}

.agent-empty.small {
  padding: 0.75rem 0.5rem;
  font-size: 0.75rem;
}

.empty-icon {
  width: 22px;
  height: 22px;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.empty-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.empty-text {
  font-size: 0.6875rem;
  color: var(--text-muted);
  line-height: 1.4;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
