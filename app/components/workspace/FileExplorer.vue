<template>
  <div class="file-explorer">
    <!-- Header -->
    <div class="explorer-header">
      <h3 class="explorer-title">Dosyalar</h3>
    </div>

    <!-- Search -->
    <div class="search-section">
      <div class="search-box">
        <Icon name="lucide:search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Dosya ara..."
          class="search-input"
        />
      </div>
    </div>

    <!-- File Tree -->
    <div class="file-tree">
      <FileTreeNode
        v-for="node in filteredFiles"
        :key="node.id"
        :node="node"
        :selected-id="selectedFileId"
        @select="handleSelectFile"
      />

      <div v-if="filteredFiles.length === 0" class="empty-state">
        <Icon name="lucide:inbox" />
        <span>Dosya bulunamadı</span>
      </div>
    </div>

    <!-- File Info -->
    <div v-if="currentFile" class="file-info">
      <div class="info-header">
        <h4 class="info-title">Dosya Bilgisi</h4>
      </div>

      <div class="info-items">
        <div class="info-item">
          <span class="info-label">Format</span>
          <span class="info-value">{{ currentFile.format }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Boyut</span>
          <span class="info-value">{{ formatFileSize(currentFile.size || 0) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Satırlar</span>
          <span class="info-value">{{ currentFile.lineCount?.toLocaleString() }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Güncelleme</span>
          <span class="info-value">{{ formatTimeAgo(currentFile.lastModified!) }}</span>
        </div>
      </div>
    </div>

    <!-- Changes Summary -->
    <div v-if="projectStore.hasChanges" class="changes-section">
      <div class="changes-header">
        <h4 class="changes-title">Değişiklikler</h4>
      </div>

      <div class="changes-stats">
        <div class="change-stat added">
          <span class="stat-dot" />
          <span class="stat-text">{{ changeStats.added }} eklendi</span>
        </div>
        <div class="change-stat deleted">
          <span class="stat-dot" />
          <span class="stat-text">{{ changeStats.deleted }} silindi</span>
        </div>
        <div class="change-stat modified">
          <span class="stat-dot" />
          <span class="stat-text">{{ changeStats.modified }} değişti</span>
        </div>
      </div>

      <button @click="projectStore.revertToOriginal" class="revert-btn">
        <Icon name="lucide:undo-2" />
        Geri Al
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore } from '~/stores/project'
import { formatFileSize, formatTimeAgo, mockSAP2000Content } from '~/utils/mockData'
import type { FileNode } from '~/stores/project'

const projectStore = useProjectStore()
const searchQuery = ref('')

const filteredFiles = computed(() => {
  if (!searchQuery.value) return projectStore.files

  const query = searchQuery.value.toLowerCase()
  return projectStore.files.filter((node: FileNode) =>
    node.name.toLowerCase().includes(query)
  )
})

const selectedFileId = computed(() => projectStore.currentFile?.id)
const currentFile = computed(() => projectStore.currentFile)
const changeStats = computed(() => projectStore.changeStats)

const handleSelectFile = (node: FileNode) => {
  if (node.type === 'file') {
    const mockContent = node.format === '.s2k' ? mockSAP2000Content : '// Mock file content'
    projectStore.openFile(node, mockContent)
  }
}
</script>

<style scoped>
.file-explorer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

/* Header */
.explorer-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-default);
}

.explorer-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Search */
.search-section {
  padding: 1rem;
  border-bottom: 1px solid var(--border-default);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  width: 16px;
  height: 16px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 0.5rem 0.75rem 0.5rem 2.25rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  transition: all 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  background: var(--bg-elevated);
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* File Tree */
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.file-tree::-webkit-scrollbar {
  width: 6px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 0.5rem;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.empty-state :deep(svg) {
  width: 24px;
  height: 24px;
}

/* File Info */
.file-info {
  padding: 1rem;
  border-top: 1px solid var(--border-default);
  background: var(--bg-primary);
}

.info-header {
  margin-bottom: 0.75rem;
}

.info-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-items {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8125rem;
}

.info-label {
  color: var(--text-muted);
}

.info-value {
  color: var(--text-secondary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
}

/* Changes Section */
.changes-section {
  padding: 1rem;
  border-top: 1px solid var(--border-default);
  background: rgba(245, 158, 11, 0.05);
}

.changes-header {
  margin-bottom: 0.75rem;
}

.changes-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--accent-amber);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.changes-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.change-stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.change-stat.added .stat-dot {
  background: var(--accent-green);
}

.change-stat.deleted .stat-dot {
  background: var(--accent-red);
}

.change-stat.modified .stat-dot {
  background: var(--accent-amber);
}

.stat-text {
  color: var(--text-secondary);
}

.revert-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.revert-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--accent-red);
  color: var(--accent-red);
}

.revert-btn :deep(svg) {
  width: 14px;
  height: 14px;
}
</style>
