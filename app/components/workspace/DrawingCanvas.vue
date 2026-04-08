<template>
  <div class="drawing-canvas">
    <!-- Toolbar -->
    <div class="canvas-toolbar">
      <div class="toolbar-group">
        <button
          v-for="tool in tools"
          :key="tool.id"
          @click="selectedTool = tool.id"
          :class="['tool-btn', { active: selectedTool === tool.id }]"
          :title="tool.label"
        >
          <Icon :name="tool.icon" />
        </button>
      </div>

      <div class="toolbar-divider" />

      <div class="toolbar-group">
        <button @click="undo" class="tool-btn" title="Geri Al" :disabled="!canUndo">
          <Icon name="lucide:undo" />
        </button>
        <button @click="redo" class="tool-btn" title="İleri Al" :disabled="!canRedo">
          <Icon name="lucide:redo" />
        </button>
      </div>

      <div class="toolbar-divider" />

      <div class="toolbar-group">
        <button @click="clearCanvas" class="tool-btn danger" title="Temizle">
          <Icon name="lucide:trash-2" />
        </button>
        <button @click="exportSketch" class="tool-btn primary" title="AI'ya Gönder">
          <Icon name="lucide:send" />
          Modele Dönüştür
        </button>
      </div>

      <div class="toolbar-spacer" />

      <div class="toolbar-group">
        <button
          @click="downloadActiveProject"
          class="tool-btn download"
          :disabled="!downloadableFile"
          :title="downloadableFile ? `İndir: ${downloadableFile.name}` : 'İndirilebilir dosya yok'"
        >
          <Icon name="lucide:download" />
          <span class="download-label">İndir</span>
        </button>
      </div>
    </div>

    <!-- Canvas Area -->
    <div ref="canvasContainer" class="canvas-container">
      <v-stage
        ref="stage"
        :config="stageConfig"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @touchstart="handleMouseDown"
        @touchmove="handleMouseMove"
        @touchend="handleMouseUp"
      >
        <v-layer ref="layer">
          <!-- Grid Background -->
          <v-line
            v-for="(line, index) in gridLines"
            :key="'grid-' + index"
            :config="line"
          />

          <!-- Drawn Lines -->
          <v-line
            v-for="(line, index) in lines"
            :key="'line-' + index"
            :config="line"
          />

          <!-- Shapes -->
          <v-rect
            v-for="(rect, index) in rectangles"
            :key="'rect-' + index"
            :config="rect"
          />
          <v-circle
            v-for="(circle, index) in circles"
            :key="'circle-' + index"
            :config="circle"
          />
        </v-layer>
      </v-stage>

      <!-- Helper Text -->
      <div v-if="lines.length === 0 && rectangles.length === 0 && circles.length === 0" class="canvas-helper">
        <Icon name="lucide:pencil" />
        <p>Yapınızın taslak çizimini yapın</p>
        <p class="helper-subtext">Basit çizimler yapın - AI detayları tamamlayacak</p>
      </div>
    </div>

    <!-- Prompt Input Area -->
    <div class="prompt-area">
      <input
        v-model="promptText"
        type="text"
        placeholder="Model talimatları (örn: '3 katlı betonarme bina')"
        class="prompt-input"
        @keydown.enter.ctrl="exportSketch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useProjectStore, type FileNode } from '~/stores/project'

const emit = defineEmits<{
  export: [data: { image: string; shapes: any[]; prompt: string }]
}>()

const projectStore = useProjectStore()

// Aktif projedeki içerik taşıyan ilk dosyayı bul
const downloadableFile = computed<FileNode | null>(() => {
  const proj = projectStore.activeProject
  if (!proj) return null
  const find = (nodes: FileNode[]): FileNode | null => {
    for (const n of nodes) {
      if (n.type === 'file' && n.content) return n
      if (n.children) {
        const f = find(n.children)
        if (f) return f
      }
    }
    return null
  }
  return find(proj.files)
})

const downloadActiveProject = () => {
  const file = downloadableFile.value
  if (!file?.content) return
  const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Prompt text
const promptText = ref('')

// Canvas refs
const stage = ref<any>(null)
const layer = ref<any>(null)
const canvasContainer = ref<HTMLElement | null>(null)

// Canvas state
const stageConfig = ref({
  width: 800,
  height: 600,
})

// Drawing state
const selectedTool = ref('pen')
const isDrawing = ref(false)
const lines = ref<any[]>([])
const rectangles = ref<any[]>([])
const circles = ref<any[]>([])
const currentLine = ref<number[]>([])
const currentShape = ref<any>(null)

// History
const history = ref<any[]>([])
const historyStep = ref(-1)

// Tools
const tools = [
  { id: 'pen', label: 'Kalem', icon: 'lucide:pencil' },
  { id: 'line', label: 'Çizgi', icon: 'lucide:minus' },
  { id: 'rectangle', label: 'Dikdörtgen', icon: 'lucide:square' },
  { id: 'circle', label: 'Daire', icon: 'lucide:circle' },
]

// Grid lines
const gridLines = computed(() => {
  const lines = []
  const gridSize = 20
  const { width, height } = stageConfig.value

  // Vertical lines
  for (let i = 0; i < width; i += gridSize) {
    lines.push({
      points: [i, 0, i, height],
      stroke: '#27272F',
      strokeWidth: i % (gridSize * 5) === 0 ? 1 : 0.5,
      opacity: i % (gridSize * 5) === 0 ? 0.3 : 0.15,
    })
  }

  // Horizontal lines
  for (let i = 0; i < height; i += gridSize) {
    lines.push({
      points: [0, i, width, i],
      stroke: '#27272F',
      strokeWidth: i % (gridSize * 5) === 0 ? 1 : 0.5,
      opacity: i % (gridSize * 5) === 0 ? 0.3 : 0.15,
    })
  }

  return lines
})

const canUndo = computed(() => historyStep.value > 0)
const canRedo = computed(() => historyStep.value < history.value.length - 1)

// Resize canvas
const handleResize = () => {
  if (canvasContainer.value) {
    stageConfig.value.width = canvasContainer.value.offsetWidth
    stageConfig.value.height = canvasContainer.value.offsetHeight
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
  saveState()

  // ResizeObserver ile container boyut değişikliklerini izle
  if (canvasContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(canvasContainer.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeObserver && canvasContainer.value) {
    resizeObserver.unobserve(canvasContainer.value)
    resizeObserver.disconnect()
  }
})

// Drawing handlers
const handleMouseDown = (e: any) => {
  isDrawing.value = true
  const pos = e.target.getStage().getPointerPosition()

  if (selectedTool.value === 'pen') {
    currentLine.value = [pos.x, pos.y]
  } else if (selectedTool.value === 'line') {
    currentLine.value = [pos.x, pos.y, pos.x, pos.y]
  } else if (selectedTool.value === 'rectangle') {
    currentShape.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  } else if (selectedTool.value === 'circle') {
    currentShape.value = { x: pos.x, y: pos.y, radius: 0 }
  }
}

const handleMouseMove = (e: any) => {
  if (!isDrawing.value) return

  const pos = e.target.getStage().getPointerPosition()

  if (selectedTool.value === 'pen') {
    currentLine.value = currentLine.value.concat([pos.x, pos.y])

    // Update or add line
    if (lines.value.length > 0 && lines.value[lines.value.length - 1].temp) {
      lines.value[lines.value.length - 1] = {
        points: currentLine.value,
        stroke: '#3B82F6',
        strokeWidth: 2,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        temp: true,
      }
    } else {
      lines.value.push({
        points: currentLine.value,
        stroke: '#3B82F6',
        strokeWidth: 2,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        temp: true,
      })
    }
  } else if (selectedTool.value === 'line') {
    currentLine.value = [currentLine.value[0], currentLine.value[1], pos.x, pos.y]

    if (lines.value.length > 0 && lines.value[lines.value.length - 1].temp) {
      lines.value[lines.value.length - 1] = {
        points: currentLine.value,
        stroke: '#3B82F6',
        strokeWidth: 2,
        temp: true,
      }
    } else {
      lines.value.push({
        points: currentLine.value,
        stroke: '#3B82F6',
        strokeWidth: 2,
        temp: true,
      })
    }
  } else if (selectedTool.value === 'rectangle' && currentShape.value) {
    const width = pos.x - currentShape.value.x
    const height = pos.y - currentShape.value.y

    if (rectangles.value.length > 0 && rectangles.value[rectangles.value.length - 1].temp) {
      rectangles.value[rectangles.value.length - 1] = {
        x: currentShape.value.x,
        y: currentShape.value.y,
        width,
        height,
        stroke: '#3B82F6',
        strokeWidth: 2,
        temp: true,
      }
    } else {
      rectangles.value.push({
        x: currentShape.value.x,
        y: currentShape.value.y,
        width,
        height,
        stroke: '#3B82F6',
        strokeWidth: 2,
        temp: true,
      })
    }
  } else if (selectedTool.value === 'circle' && currentShape.value) {
    const radius = Math.sqrt(
      Math.pow(pos.x - currentShape.value.x, 2) + Math.pow(pos.y - currentShape.value.y, 2)
    )

    if (circles.value.length > 0 && circles.value[circles.value.length - 1].temp) {
      circles.value[circles.value.length - 1] = {
        x: currentShape.value.x,
        y: currentShape.value.y,
        radius,
        stroke: '#3B82F6',
        strokeWidth: 2,
        temp: true,
      }
    } else {
      circles.value.push({
        x: currentShape.value.x,
        y: currentShape.value.y,
        radius,
        stroke: '#3B82F6',
        strokeWidth: 2,
        temp: true,
      })
    }
  }
}

const handleMouseUp = () => {
  isDrawing.value = false

  // Finalize shapes
  lines.value.forEach(line => delete line.temp)
  rectangles.value.forEach(rect => delete rect.temp)
  circles.value.forEach(circle => delete circle.temp)

  currentLine.value = []
  currentShape.value = null

  saveState()
}

// History
const saveState = () => {
  const state = {
    lines: JSON.parse(JSON.stringify(lines.value)),
    rectangles: JSON.parse(JSON.stringify(rectangles.value)),
    circles: JSON.parse(JSON.stringify(circles.value)),
  }

  history.value = history.value.slice(0, historyStep.value + 1)
  history.value.push(state)
  historyStep.value++
}

const undo = () => {
  if (!canUndo.value) return

  historyStep.value--
  const state = history.value[historyStep.value]
  lines.value = JSON.parse(JSON.stringify(state.lines))
  rectangles.value = JSON.parse(JSON.stringify(state.rectangles))
  circles.value = JSON.parse(JSON.stringify(state.circles))
}

const redo = () => {
  if (!canRedo.value) return

  historyStep.value++
  const state = history.value[historyStep.value]
  lines.value = JSON.parse(JSON.stringify(state.lines))
  rectangles.value = JSON.parse(JSON.stringify(state.rectangles))
  circles.value = JSON.parse(JSON.stringify(state.circles))
}

const clearCanvas = () => {
  if (confirm('Çizimi temizlemek istediğinizden emin misiniz?')) {
    lines.value = []
    rectangles.value = []
    circles.value = []
    saveState()
  }
}

const exportSketch = () => {
  if (stage.value) {
    // Validation
    if (lines.value.length === 0 && rectangles.value.length === 0 && circles.value.length === 0) {
      alert('Lütfen önce bir çizim yapın!')
      return
    }

    if (!promptText.value.trim()) {
      alert('Lütfen model dönüştürme talimatlarınızı yazın!')
      return
    }

    // Export as image
    const dataURL = stage.value.getNode().toDataURL()

    // Export shapes data
    const shapesData = {
      lines: lines.value,
      rectangles: rectangles.value,
      circles: circles.value,
    }

    emit('export', {
      image: dataURL,
      shapes: shapesData,
      prompt: promptText.value.trim(),
    })
  }
}
</script>

<style scoped>
.drawing-canvas {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

/* Toolbar */
.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-primary);
  min-height: 52px;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.toolbar-divider {
  width: 1px;
  height: 28px;
  background: var(--border-default);
  align-self: center;
}

.toolbar-spacer {
  flex: 1;
  min-width: 0.5rem;
}

.tool-btn.download {
  width: auto;
  padding: 0 0.875rem;
  height: 36px;
  gap: 0.4375rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.tool-btn.download:hover:not(:disabled) {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: white;
}

.download-label {
  display: inline-block;
}

@media (max-width: 720px) {
  .download-label { display: none; }
  .tool-btn.download { width: 36px; padding: 0; }
}

.tool-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  gap: 0.5rem;
  flex-shrink: 0;
}

.tool-btn:hover:not(:disabled) {
  background: var(--bg-elevated);
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.tool-btn.active {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn.primary {
  width: auto;
  padding: 0 1.25rem;
  background: var(--accent-blue);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  height: 38px;
}

.tool-btn.primary:hover:not(:disabled) {
  background: #2563EB;
}

.tool-btn.danger:hover:not(:disabled) {
  background: var(--accent-red);
  border-color: var(--accent-red);
  color: white;
}

.tool-btn :deep(svg) {
  width: 18px;
  height: 18px;
}

/* Canvas Container */
.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
}

/* Helper Text */
.canvas-helper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
  color: var(--text-muted);
}

.canvas-helper :deep(svg) {
  width: 48px;
  height: 48px;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.canvas-helper p {
  font-size: 1rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

.helper-subtext {
  font-size: 0.875rem;
  color: var(--text-muted);
  opacity: 0.7;
}

/* Prompt Area */
.prompt-area {
  border-top: 1px solid var(--border-default);
  background: var(--bg-primary);
  padding: 1rem;
  flex-shrink: 0;
}

.prompt-input {
  width: 100%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  font-family: inherit;
  height: 40px;
  transition: all 0.2s;
  box-sizing: border-box;
  line-height: 1.5;
}

.prompt-input:focus {
  outline: none;
  border-color: var(--accent-blue);
  background: var(--bg-elevated);
}

.prompt-input::placeholder {
  color: var(--text-muted);
}
</style>
