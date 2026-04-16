<template>
  <!-- Collapsed: sağ alt köşe FAB -->
  <button
    v-if="collapsed"
    type="button"
    class="chat-fab"
    :style="fabStyle"
    title="AI sohbet (modeli editlemek için)"
    @click="openPopup"
  >
    <Icon name="lucide:message-circle" />
    <span class="fab-badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
  </button>

  <!-- Expanded: floating draggable + resizable pencere -->
  <div
    v-else
    class="chat-popup"
    :style="popupStyle"
    :class="{ dragging: isDragging }"
  >
    <header
      class="popup-head"
      @mousedown="startDrag"
    >
      <div class="head-title">
        <Icon name="lucide:sparkles" />
        AI Asistan
      </div>
      <div class="head-actions">
        <button type="button" class="head-btn" title="Küçült" @click="collapse">
          <Icon name="lucide:minus" />
        </button>
      </div>
    </header>
    <div class="popup-body">
      <WorkspaceChatPanel />
    </div>
    <!-- Resize handles -->
    <div class="resize-corner" @mousedown.stop="startResize" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useChatStore } from '~/stores/chat'

const chatStore = useChatStore()
const collapsed = ref(true)           // default: kapalı
const unreadCount = ref(0)            // ileride: son seen'den bu yana gelen msg

// Pencere konum + boyut (sağ-alt hizalı)
const MARGIN = 16
const defaultW = 420
const defaultH = 560

const x = ref(0)      // left (px)
const y = ref(0)      // top (px)
const w = ref(defaultW)
const h = ref(defaultH)

function placeBottomRight() {
  if (typeof window === 'undefined') return
  x.value = window.innerWidth - w.value - MARGIN
  y.value = window.innerHeight - h.value - MARGIN
}

// FAB konumu
const fabStyle = computed(() => ({
  right: `${MARGIN}px`,
  bottom: `${MARGIN}px`,
}))

const popupStyle = computed(() => ({
  left: `${x.value}px`,
  top: `${y.value}px`,
  width: `${w.value}px`,
  height: `${h.value}px`,
}))

function openPopup() {
  collapsed.value = false
  unreadCount.value = 0
  placeBottomRight()
}
function collapse() {
  collapsed.value = true
}

// --- Drag
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 })

function startDrag(e: MouseEvent) {
  // Head-btn tıklamasıysa drag başlatma
  const target = e.target as HTMLElement
  if (target.closest('.head-btn')) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, px: x.value, py: y.value }
}

function onMouseMove(e: MouseEvent) {
  if (isDragging.value) {
    const dx = e.clientX - dragStart.value.x
    const dy = e.clientY - dragStart.value.y
    x.value = Math.max(0, Math.min(window.innerWidth - w.value, dragStart.value.px + dx))
    y.value = Math.max(0, Math.min(window.innerHeight - h.value, dragStart.value.py + dy))
  }
  if (isResizing.value) {
    const dw = e.clientX - resizeStart.value.x
    const dh = e.clientY - resizeStart.value.y
    w.value = Math.max(320, Math.min(window.innerWidth - x.value - 8, resizeStart.value.w + dw))
    h.value = Math.max(360, Math.min(window.innerHeight - y.value - 8, resizeStart.value.h + dh))
  }
}

function onMouseUp() {
  isDragging.value = false
  isResizing.value = false
}

// --- Resize
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, w: 0, h: 0 })

function startResize(e: MouseEvent) {
  isResizing.value = true
  resizeStart.value = { x: e.clientX, y: e.clientY, w: w.value, h: h.value }
}

function onWindowResize() {
  if (collapsed.value) return
  // pencere küçülürse sığdır
  if (x.value + w.value > window.innerWidth) x.value = Math.max(0, window.innerWidth - w.value)
  if (y.value + h.value > window.innerHeight) y.value = Math.max(0, window.innerHeight - h.value)
}

onMounted(() => {
  placeBottomRight()
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', onWindowResize)
})

// Önemsiz kullanım uyarısını susturmak için referans
void chatStore
</script>

<style scoped>
.chat-fab {
  position: fixed;
  z-index: 100;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, box-shadow 0.15s;
}
.chat-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(59, 130, 246, 0.5);
}
.chat-fab :deep(svg) { width: 24px; height: 24px; }
.fab-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #ef4444;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-popup {
  position: fixed;
  z-index: 100;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.1s;
}
.chat-popup.dragging { box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5); }

.popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-default);
  cursor: move;
  user-select: none;
}
.head-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}
.head-title :deep(svg) { color: var(--accent-purple, #8b5cf6); }

.head-actions { display: flex; gap: 2px; }
.head-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
}
.head-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.popup-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.resize-corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: se-resize;
  background:
    linear-gradient(135deg,
      transparent 50%,
      var(--border-default) 50%,
      var(--border-default) 58%,
      transparent 58%,
      transparent 66%,
      var(--border-default) 66%,
      var(--border-default) 74%,
      transparent 74%);
}
</style>
