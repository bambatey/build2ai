<template>
  <div class="settings-page">
    <header class="page-header">
      <h1 class="page-title">Ayarlar</h1>
      <p class="page-subtitle">Hesap ve lokal agent</p>
    </header>

    <!-- Hesap -->
    <section class="card">
      <div class="card-head">
        <Icon name="lucide:user" />
        <h2>Hesap</h2>
      </div>

      <div class="account">
        <div class="avatar">
          {{ authUser?.email?.charAt(0).toUpperCase() || '?' }}
        </div>
        <div class="account-info">
          <div class="account-name">
            {{ authUser?.displayName || authUser?.email?.split('@')[0] || '—' }}
          </div>
          <div class="account-email">{{ authUser?.email || 'Giriş yapılmamış' }}</div>
        </div>
        <button class="btn-danger" @click="handleLogout">
          <Icon name="lucide:log-out" />
          Çıkış
        </button>
      </div>

      <div class="row">
        <label>UID</label>
        <code class="mono-value">{{ authUser?.uid || '—' }}</code>
      </div>
    </section>

    <!-- Agent -->
    <section class="card">
      <div class="card-head">
        <Icon name="lucide:zap" />
        <h2>Local Agent</h2>
      </div>

      <div class="row">
        <div class="row-label">
          <label>Durum</label>
          <span class="row-help">Build2AI Agent uygulamasıyla bağlantı</span>
        </div>
        <span class="status-pill" :class="agent.connected.value ? 'ok' : 'off'">
          <span class="dot" />
          {{ agent.connected.value ? 'Bağlı' : 'Bağlı değil' }}
        </span>
      </div>

      <div class="row">
        <div class="row-label">
          <label>İzlenen klasör</label>
          <span class="row-help">Agent uygulamasından değiştirilir</span>
        </div>
        <code class="mono-value">{{ agent.root.value || '(seçilmedi)' }}</code>
      </div>

      <div class="row">
        <label>Dosya sayısı</label>
        <span class="number-value">{{ agent.fileCount.value }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useAgent } from '~/composables/useAgent'

definePageMeta({ layout: 'default' })

useSeoMeta({
  title: 'Ayarlar - Build2AI',
  description: 'Hesap ve agent ayarları',
})

const agent = useAgent()
const router = useRouter()
const { user: authUser, signOut } = useAuth()

async function handleLogout() {
  await signOut()
  router.push('/login')
}
</script>

<style scoped>
.settings-page {
  padding: 2rem;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Header */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}
.page-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}
.page-subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
}

/* Card */
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-default);
}
.card-head :deep(svg) {
  width: 18px;
  height: 18px;
  color: var(--text-muted);
}
.card-head h2 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Row */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.row > label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.row-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.row-label label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}
.row-help {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Account */
.account {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
}
.avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-blue);
  color: #fff;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  flex-shrink: 0;
}
.account-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.account-name {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.account-email {
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Buttons */
.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-danger:hover {
  background: rgba(239, 68, 68, 0.08);
}
.btn-danger :deep(svg) { width: 14px; height: 14px; }

/* Inputs */
.select {
  min-width: 200px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  cursor: pointer;
}
.select:focus { outline: none; border-color: var(--accent-blue); }

.mono-value {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.75rem;
  color: var(--text-secondary);
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: all;
}

.number-value {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 600;
}

/* Status pill */
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.375rem 0.75rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 999px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}
.status-pill .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-pill.ok .dot { background: var(--accent-green); }
.status-pill.off .dot { background: #ef4444; }

/* Responsive */
@media (max-width: 640px) {
  .settings-page { padding: 1rem; gap: 1rem; }
  .page-title { font-size: 1.5rem; }
  .row { flex-direction: column; align-items: stretch; }
  .select { width: 100%; }
}
</style>
