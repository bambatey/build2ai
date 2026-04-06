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

    <!-- Navigation -->
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

    <!-- Agent Status -->
    <div class="sidebar-footer">
      <div class="agent-status" :class="{ collapsed: isCollapsed }">
        <div class="agent-indicator">
          <span class="status-dot" :class="agentStore.status" />
          <span v-if="!isCollapsed" class="status-text">{{ agentStore.statusText }}</span>
        </div>
      </div>
    </div>

    <!-- Collapse Toggle -->
    <button @click="toggleCollapse" class="collapse-btn">
      <Icon :name="isCollapsed ? 'lucide:chevrons-right' : 'lucide:chevrons-left'" />
    </button>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAgentStore } from '~/stores/agent'

const route = useRoute()
const agentStore = useAgentStore()
const isCollapsed = ref(false)

const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    icon: 'lucide:layout-grid',
  },
  {
    path: '/workspace',
    label: 'Workspace',
    icon: 'lucide:code-2',
  },
  {
    path: '/projects',
    label: 'Projeler',
    icon: 'lucide:folder',
  },
  {
    path: '/settings',
    label: 'Ayarlar',
    icon: 'lucide:settings',
  },
]

const isActiveRoute = (path: string) => {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
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
  opacity: 1;
  transition: opacity 0.2s;
}

.sidebar-container.collapsed .logo-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  padding: 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
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
  opacity: 1;
  transition: opacity 0.2s;
}

.sidebar-container.collapsed .nav-label {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

/* Agent Status */
.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid var(--border-default);
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
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Responsive */
@media (max-width: 768px) {
  .sidebar-container {
    transform: translateX(-100%);
  }

  .sidebar-container.mobile-open {
    transform: translateX(0);
  }
}
</style>
