<template>
  <div class="app-layout min-h-screen">
    <!-- Sidebar -->
    <LayoutAppSidebar />

    <!-- Main Content -->
    <div class="main-content" :class="{ 'with-topbar': showTopBar }">
      <!-- Top Bar (isteğe bağlı) -->
      <LayoutAppTopBar v-if="showTopBar" />

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
}

.main-content {
  flex: 1;
  margin-left: 240px;
  min-height: 100vh;
  transition: margin-left 300ms ease;
}

.main-content.with-topbar {
  padding-top: 0;
}

.page-content {
  position: relative;
  z-index: 1;
}

/* Sidebar collapse durumunda */
:deep(.sidebar.collapsed ~ .main-content) {
  margin-left: 72px;
}

/* Responsive */
@media (max-width: 768px) {
  .main-content {
    margin-left: 0;
  }

  :deep(.sidebar) {
    transform: translateX(-100%);
  }

  :deep(.sidebar.mobile-open) {
    transform: translateX(0);
  }
}
</style>
