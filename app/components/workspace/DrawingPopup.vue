<template>
  <!-- Collapsed: FAB -->
  <button
    v-if="collapsed"
    type="button"
    class="draw-fab"
    title="Taslak çizimi (AI'a göndermek için)"
    @click="openPopup"
  >
    <Icon name="lucide:pencil-ruler" />
  </button>

  <!-- Expanded: draggable + resizable pencere -->
  <div
    v-else
    class="draw-popup"
    :style="popupStyle"
    :class="{ dragging: isDragging }"
  >
    <header class="popup-head" @mousedown="startDrag">
      <div class="head-title">
        <Icon name="lucide:pencil-ruler" />
        Taslak
      </div>
      <div class="head-actions">
        <button type="button" class="head-btn" title="Küçült" @click="collapse">
          <Icon name="lucide:minus" />
        </button>
      </div>
    </header>
    <div class="popup-body">
      <WorkspaceDrawingCanvas @export="handleExport" />
    </div>
    <div class="resize-corner" @mousedown.stop="startResize" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useChatStore } from '~/stores/chat'

const chatStore = useChatStore()
const collapsed = ref(true)

// Pencere konum + boyut — chat popup'tan büyük
const MARGIN = 16
const CHAT_W = 420             // AnalysisChatPopup varsayılan genişliği
const CHAT_GAP = 12            // chat popup ile arasındaki boşluk
const defaultW = 720
const defaultH = 520

const x = ref(0)
const y = ref(0)
const w = ref(defaultW)
const h = ref(defaultH)

function placeNextToChat() {
  if (typeof window === 'undefined') return
  if (chatStore.popupOpen) {
    // Chat popup sağ altta sabit: left = innerWidth - CHAT_W - MARGIN
    const chatLeft = window.innerWidth - CHAT_W - MARGIN
    x.value = Math.max(MARGIN, chatLeft - w.value - CHAT_GAP)
  } else {
    x.value = Math.max(MARGIN, window.innerWidth - w.value - MARGIN)
  }
  y.value = Math.max(MARGIN, window.innerHeight - h.value - MARGIN)
}

const popupStyle = computed(() => ({
  left: `${x.value}px`,
  top: `${y.value}px`,
  width: `${w.value}px`,
  height: `${h.value}px`,
}))

function openPopup() {
  collapsed.value = false
  placeNextToChat()
}
function collapse() {
  collapsed.value = true
}

// Chat popup açılıp/kapanınca drawing popup'ı animasyonlu olarak yeniden
// konumlandır (açıksa). CSS transition bu x değişimini smoothluyor.
watch(() => chatStore.popupOpen, () => {
  if (!collapsed.value) placeNextToChat()
})

// Kendi open/close durumunu store'a bildir (tutarlılık için)
watch(collapsed, (v) => { chatStore.drawingPopupOpen = !v }, { immediate: true })

// --- Drag
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 })

function startDrag(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('.head-btn')) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, px: x.value, py: y.value }
}

// --- Resize
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, w: 0, h: 0 })

function startResize(e: MouseEvent) {
  isResizing.value = true
  resizeStart.value = { x: e.clientX, y: e.clientY, w: w.value, h: h.value }
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
    w.value = Math.max(480, Math.min(window.innerWidth - x.value - 8, resizeStart.value.w + dw))
    h.value = Math.max(360, Math.min(window.innerHeight - y.value - 8, resizeStart.value.h + dh))
  }
}

function onMouseUp() {
  isDragging.value = false
  isResizing.value = false
}

function onWindowResize() {
  if (collapsed.value) return
  if (x.value + w.value > window.innerWidth) x.value = Math.max(0, window.innerWidth - w.value)
  if (y.value + h.value > window.innerHeight) y.value = Math.max(0, window.innerHeight - h.value)
}

function handleExport(data: { image: string; shapes: any; prompt: string }) {
  const shapeCount = Object.values(data.shapes ?? {}).flat().length
  const msg = data.prompt
    ? `${data.prompt}\n\n[Taslak çizim eklendi — ${shapeCount} şekil]`
    : `[Taslak çizim eklendi — ${shapeCount} şekil]`
  chatStore.sendMessage(msg)
  // Çizimi gönderdikten sonra popup'ı küçült — chat popup'ına hazır
  collapse()
}

onMounted(() => {
  placeNextToChat()
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', onWindowResize)
})
onBeforeUnmount(() => {
  chatStore.drawingPopupOpen = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', onWindowResize)
})
</script>

<style scoped>
.draw-fab {
  position: relative;
  z-index: 100;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-purple, #8b5cf6);
  color: #fff;
  border: none;
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, box-shadow 0.15s;
}
.draw-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(139, 92, 246, 0.5);
}
.draw-fab :deep(svg) { width: 22px; height: 22px; }

.draw-popup {
  position: fixed;
  z-index: 100;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: left 0.28s cubic-bezier(0.22, 1, 0.36, 1),
              top 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.draw-popup.dragging {
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  transition: none;
}

.popup-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-default);
  cursor: move;
  user-select: none;
  flex-shrink: 0;
}
.head-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}
.head-title :deep(svg) {
  color: var(--accent-purple, #8b5cf6);
  width: 16px;
  height: 16px;
}

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
  display: flex;
}
.popup-body > :deep(*) {
  flex: 1;
  min-width: 0;
  height: 100%;
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
