<template>
  <div ref="rootEl" class="thumb-root">
    <img v-if="imageUrl" :src="imageUrl" class="thumb-img" alt="3D önizleme" />
    <div v-else-if="state === 'loading'" class="thumb-state">
      <Icon name="lucide:loader-2" class="spin" />
    </div>
    <div v-else-if="state === 'error'" class="thumb-state muted">
      <Icon name="lucide:box" />
    </div>
    <div v-else class="thumb-state muted">
      <Icon name="lucide:box" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'

import { parseS2K } from '~/utils/s2kParser'
import { useProjectStore } from '~/stores/project'

const props = defineProps<{ projectId: string }>()
const projectStore = useProjectStore()

const rootEl = ref<HTMLElement | null>(null)
const imageUrl = ref<string | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

// Snapshot cache — aynı projeyi tekrar tekrar renderlama
const _cache = getCache()

const COLOR_COLUMN = 0x3b82f6
const COLOR_BEAM = 0x10b981
const COLOR_SLAB = 0x8b5cf6

let io: IntersectionObserver | null = null

onMounted(() => {
  // Cache varsa anında kullan
  const cached = _cache.get(props.projectId)
  if (cached) {
    imageUrl.value = cached
    state.value = 'ready'
    return
  }
  // Viewport'a girince render et
  if (!rootEl.value) return
  io = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      io?.disconnect()
      io = null
      renderThumbnail().catch(() => { state.value = 'error' })
    }
  }, { rootMargin: '200px' })
  io.observe(rootEl.value)
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})

async function renderThumbnail() {
  state.value = 'loading'

  // Dosya içeriğini bul (önce mevcut state, yoksa backend)
  const proj = projectStore.projects.find(p => p.id === props.projectId)
  let files = proj?.files ?? []
  let s2kFile = files.find(f => {
    const ext = (f.format ?? '').toLowerCase()
    return ext === '.s2k' || ext === '.e2k'
  })
  if (!s2kFile) {
    files = await projectStore.fetchProjectDetail(props.projectId)
    s2kFile = files.find(f => {
      const ext = (f.format ?? '').toLowerCase()
      return ext === '.s2k' || ext === '.e2k'
    })
  }
  if (!s2kFile) {
    state.value = 'error'
    return
  }
  const content = s2kFile.content
    ?? await projectStore.fetchFileContent(props.projectId, s2kFile.id)
  if (!content) {
    state.value = 'error'
    return
  }

  let parsed
  try {
    parsed = parseS2K(content)
  } catch {
    state.value = 'error'
    return
  }
  if (!parsed.joints.length) {
    state.value = 'error'
    return
  }

  const dataUrl = renderStaticPNG(parsed)
  if (dataUrl) {
    imageUrl.value = dataUrl
    _cache.set(props.projectId, dataUrl)
    state.value = 'ready'
  } else {
    state.value = 'error'
  }
}

function renderStaticPNG(model: ReturnType<typeof parseS2K>): string | null {
  const W = 320
  const H = 180
  // Offscreen canvas
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  let renderer: THREE.WebGLRenderer | null = null
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(W, H, false)
    renderer.setClearColor(0x0a0a0a, 0)

    const scene = new THREE.Scene()
    const group = new THREE.Group()
    scene.add(group)

    // Çizimleri hesapla
    const jointMap = new Map<number, [number, number, number]>()
    for (const j of model.joints) {
      jointMap.set(j.id, [j.x, j.y, j.z])
    }

    // Frames: kolon/kiriş ayrımı + line geometry
    const columnPos: number[] = []
    const beamPos: number[] = []
    for (const fr of model.frames) {
      const a = jointMap.get(fr.i)
      const b = jointMap.get(fr.j)
      if (!a || !b) continue
      const dx = Math.abs(b[0] - a[0])
      const dy = Math.abs(b[1] - a[1])
      const dz = Math.abs(b[2] - a[2])
      const isColumn = dz > Math.max(dx, dy) * 1.5
      const arr = isColumn ? columnPos : beamPos
      arr.push(a[0], a[2], -a[1], b[0], b[2], -b[1])
      // Not: three kamerası +Y üste, modelde +Z üst — koordinat swap
    }
    addLines(group, columnPos, COLOR_COLUMN)
    addLines(group, beamPos, COLOR_BEAM)

    // Shell/döşemeler
    for (const ar of model.areas) {
      const pts: number[] = []
      for (const jid of ar.joints) {
        const p = jointMap.get(jid)
        if (!p) continue
        pts.push(p[0], p[2], -p[1])
      }
      if (pts.length >= 9) addPolygon(group, pts, COLOR_SLAB)
    }

    // Kamera: modele göre fit
    const box = new THREE.Box3().setFromObject(group)
    if (box.isEmpty()) return null
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, maxDim * 20)
    camera.position.set(
      center.x + maxDim * 1.6,
      center.y + maxDim * 1.2,
      center.z + maxDim * 1.6,
    )
    camera.lookAt(center)

    // Işık (line materyali ihmal eder ama shell için)
    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const dir = new THREE.DirectionalLight(0xffffff, 0.6)
    dir.position.set(1, 2, 1)
    scene.add(dir)

    renderer.render(scene, camera)
    const url = canvas.toDataURL('image/png')
    return url
  } catch (e) {
    console.error('[Thumb] render error:', e)
    return null
  } finally {
    renderer?.dispose()
  }
}

function addLines(group: THREE.Group, positions: number[], color: number) {
  if (positions.length === 0) return
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 1 })
  group.add(new THREE.LineSegments(geo, mat))
}

function addPolygon(group: THREE.Group, pts: number[], color: number) {
  // 3D noktalardan üçgen fan
  const nPts = pts.length / 3
  if (nPts < 3) return
  const positions: number[] = []
  const [x0, y0, z0] = [pts[0]!, pts[1]!, pts[2]!]
  for (let i = 1; i < nPts - 1; i++) {
    const [x1, y1, z1] = [pts[i * 3]!, pts[i * 3 + 1]!, pts[i * 3 + 2]!]
    const [x2, y2, z2] = [pts[(i + 1) * 3]!, pts[(i + 1) * 3 + 1]!, pts[(i + 1) * 3 + 2]!]
    positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.25, side: THREE.DoubleSide,
  })
  group.add(new THREE.Mesh(geo, mat))
}

// Module-level cache — sayfalar arası dolaşımda kalıcı
function getCache(): Map<string, string> {
  const g = globalThis as any
  if (!g.__build2ai_thumb_cache) g.__build2ai_thumb_cache = new Map<string, string>()
  return g.__build2ai_thumb_cache
}
</script>

<style scoped>
.thumb-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg,
    rgba(59, 130, 246, 0.08),
    rgba(139, 92, 246, 0.08));
}
.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-state {
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb-state :deep(svg) { width: 34px; height: 34px; }
.thumb-state.muted { opacity: 0.5; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
