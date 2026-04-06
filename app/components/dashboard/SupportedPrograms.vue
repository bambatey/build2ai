<template>
  <div class="supported-programs card">
    <h3 class="text-lg font-semibold mb-4">Desteklenen Programlar</h3>

    <div class="programs-grid grid grid-cols-2 md:grid-cols-4 gap-3">
      <div
        v-for="program in programs"
        :key="program.id"
        class="program-card p-4 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-elevated)] transition-all relative"
        :class="{ 'opacity-60': program.status === 'coming-soon' }"
      >
        <!-- Status Badge -->
        <div v-if="program.status === 'coming-soon'" class="status-badge badge badge-amber absolute top-2 right-2">
          Yakında
        </div>
        <div v-else class="status-badge badge badge-green absolute top-2 right-2">
          Aktif
        </div>

        <!-- Icon -->
        <div class="program-icon text-3xl mb-3">{{ program.icon }}</div>

        <!-- Name -->
        <p class="program-name font-['JetBrains_Mono'] text-sm font-semibold text-primary mb-1">
          {{ program.name }}
        </p>

        <!-- Format -->
        <p class="program-format text-xs font-mono text-secondary mb-2">
          {{ program.format }}
        </p>

        <!-- Description -->
        <p class="program-desc text-xs text-muted">{{ program.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { mockSupportedPrograms } from '~/utils/mockData'

const programs = mockSupportedPrograms
</script>

<style scoped>
.program-card {
  cursor: pointer;
  border: 1px solid var(--border-default);
  position: relative;
}

.program-card:hover {
  border-color: var(--border-active);
}

.program-card.opacity-60 {
  cursor: not-allowed;
}

.program-icon {
  height: 48px;
  display: flex;
  align-items: center;
}

.status-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 10px;
  padding: 2px 6px;
}
</style>
