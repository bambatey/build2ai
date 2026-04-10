<template>
  <aside
    :class="['sidebar', { collapsed: isCollapsed }]"
    class="sidebar-container"
  >
    <!-- Logo -->
    <div class="sidebar-logo">
      <NuxtLink to="/" class="logo-link">
        <div class="logo-mark">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span v-if="!isCollapsed" class="logo-text">StructAI</span>
      </NuxtLink>
    </div>

    <!-- MOD A: Aktif proje yok → genel nav + recents -->
    <template v-if="!hasActiveProject">
      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: isActiveRoute(item.path) }"
        >
          <Icon :name="item.icon" class="nav-icon" />
          <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div v-if="!isCollapsed && recentProjects.length > 0" class="recent-section">
        <div class="section-label">SON PROJELER</div>
        <div class="recent-list">
          <button
            v-for="project in recentProjects.slice(0, 5)"
            :key="project.id"
            type="button"
            class="recent-item"
            @click="handleOpenRecent(project.id)"
          >
            <Icon name="lucide:folder" class="recent-icon" />
            <span class="recent-name">{{ project.name }}</span>
          </button>
        </div>
      </div>

      <LayoutAgentFilesPanel v-if="!isCollapsed" />
    </template>

    <!-- MOD B: Aktif proje var → switcher + chat history -->
    <template v-else>
      <LayoutProjectSwitcher :collapsed="isCollapsed" />

      <NuxtLink
        to="/projects"
        class="back-link"
        :class="{ collapsed: isCollapsed }"
      >
        <Icon name="lucide:arrow-left" />
        <span v-if="!isCollapsed">Tüm projeler</span>
      </NuxtLink>

      <LayoutChatHistoryList v-if="!isCollapsed" />
    </template>

    <!-- User Profile -->
    <div v-if="authUser" class="sidebar-user" :class="{ collapsed: isCollapsed }">
      <div class="user-info" @click="router.push('/settings')">
        <div class="user-avatar">
          {{ authUser.email?.charAt(0).toUpperCase() || '?' }}
        </div>
        <div v-if="!isCollapsed" class="user-details">
          <span class="user-name">{{ authUser.displayName || authUser.email?.split('@')[0] }}</span>
          <span class="user-email">{{ authUser.email }}</span>
        </div>
      </div>
      <button v-if="!isCollapsed" @click="handleLogout" class="logout-btn" title="Çıkış Yap">
        <Icon name="lucide:log-out" />
      </button>
    </div>

    <!-- Collapse Toggle -->
    <button @click="toggleCollapse" class="collapse-btn">
      <Icon :name="isCollapsed ? 'lucide:chevrons-right' : 'lucide:chevrons-left'" />
    </button>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectStore } from '~/stores/project'
import { useChatStore } from '~/stores/chat'

const route = useRoute()
const router = useRouter()
const projectStore = useProjectStore()
const chatStore = useChatStore()
const { user: authUser, signOut } = useAuth()
const isCollapsed = ref(false)

const handleLogout = async () => {
  await signOut()
  router.push('/login')
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'lucide:layout-grid' },
  { path: '/projects', label: 'Projeler', icon: 'lucide:folder' },
  { path: '/settings', label: 'Ayarlar', icon: 'lucide:settings' },
]

const isWorkspace = computed(() => route.path === '/workspace')
const isNewProjectFlow = computed(
  () => isWorkspace.value && route.query.mode === 'new',
)
// Mod B yalnızca workspace içindeyken anlamlı
const hasActiveProject = computed(
  () => isWorkspace.value && (!!projectStore.activeProjectId || isNewProjectFlow.value),
)
const recentProjects = computed(() => projectStore.recentProjects)

const isActiveRoute = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

const handleOpenRecent = (id: string) => {
  projectStore.openProject(id)
  router.push('/workspace')
}

onMounted(() => {
  projectStore.hydrate()
  chatStore.hydrate()
})
</script>

<style scoped>
.sidebar-container {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 240px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  z-index: 50;
}

.sidebar-container.collapsed {
  width: 72px;
}

/* Logo */
.sidebar-logo {
  padding: 1.5rem 1rem;
  border-bottom: 1px solid var(--border-default);
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--text-primary);
}

.logo-mark {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-green);
  flex-shrink: 0;
}

.logo-mark svg {
  width: 24px;
  height: 24px;
}

.logo-text {
  font-size: 1.125rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

/* Navigation */
.sidebar-nav {
  padding: 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--bg-tertiary);
  color: var(--accent-green);
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--accent-green);
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.nav-label {
  white-space: nowrap;
}

.sidebar-container.collapsed .nav-label,
.sidebar-container.collapsed .logo-text {
  display: none;
}

/* Recent projects */
.recent-section {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-default);
  margin-top: 0.5rem;
  max-height: 220px;
  overflow-y: auto;
  flex-shrink: 0;
}

.section-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  padding: 0.5rem 0.5rem;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.recent-item {
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

.recent-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.recent-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-blue);
  flex-shrink: 0;
}

.recent-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Back link */
.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  margin: 0 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.15s;
}

.back-link:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.back-link.collapsed {
  justify-content: center;
  padding: 0.625rem;
}

.back-link :deep(svg) {
  width: 14px;
  height: 14px;
}

/* Agent Status */
.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-default);
  margin-top: auto;
}

.agent-status {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--bg-tertiary);
}

.agent-status.collapsed {
  justify-content: center;
}

.agent-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-green);
  flex-shrink: 0;
}

.status-dot.connecting {
  background: var(--accent-amber);
  animation: pulse 2s infinite;
}

.status-dot.disconnected {
  background: var(--accent-red);
}

.status-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.sidebar-container.collapsed .status-text {
  display: none;
}

/* User Profile */
.sidebar-user {
  margin-top: auto;
  padding: 0.75rem;
  border-top: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sidebar-user.collapsed {
  justify-content: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex: 1;
  min-width: 0;
  cursor: pointer;
  padding: 0.375rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.user-info:hover {
  background: var(--bg-tertiary);
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent-blue);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 600;
  flex-shrink: 0;
}

.user-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.6875rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--accent-red);
}

/* Collapse Button */
.collapse-btn {
  position: absolute;
  right: -12px;
  top: 80px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--accent-blue);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 768px) {
  .sidebar-container {
    transform: translateX(-100%);
  }
  .sidebar-container.mobile-open {
    transform: translateX(0);
  }
}
</style>
