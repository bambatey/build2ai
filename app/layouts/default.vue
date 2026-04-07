<template>
  <div class="app-layout min-h-screen">
    <!-- Sidebar -->
    <LayoutAppSidebar />

    <!-- Main Content -->
    <div class="main-content" :class="{ 'with-topbar': showTopBar }">
      <!-- Page Content -->
      <main class="page-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Dashboard'da top bar gösterme
const showTopBar = computed(() => {
  return route.path !== '/'
})
</script>

<style scoped>
.app-layout {
  display: flex;
  position: relative;
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.main-content {
  flex: 1 1 0;
  min-width: 0;
  margin-left: 240px;
  min-height: 100vh;
  width: calc(100% - 240px);
  overflow-x: hidden;
  transition: margin-left 300ms ease, width 300ms ease;
}

.main-content.with-topbar {
  padding-top: 0;
}

.page-content {
  position: relative;
  z-index: 1;
  width: 100%;
  min-width: 0;
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Sidebar collapse durumunda */
:deep(.sidebar.collapsed ~ .main-content) {
  margin-left: 72px;
  width: calc(100% - 72px);
}

/* Responsive */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
    width: 100%;
  }

  :deep(.sidebar) {
    transform: translateX(-100%);
  }

  :deep(.sidebar.mobile-open) {
    transform: translateX(0);
  }
}
</style>