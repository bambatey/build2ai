<template>
  <div class="model-3d">
    <div v-if="loading" class="m3d-status">
      <Icon name="lucide:loader-2" class="spin" />
      Model yükleniyor...
    </div>
    <div v-else-if="error" class="m3d-status error">
      <Icon name="lucide:alert-triangle" />
      {{ error }}
    </div>

    <div ref="mountEl" class="m3d-canvas" />

    <!-- Stats overlay -->
    <div v-if="model" class="m3d-stats">
      <div class="m3d-stat">
        <span class="m3d-stat-label">Düğüm</span>
        <span class="m3d-stat-value">{{ model.joints.length }}</span>
      </div>
      <div class="m3d-stat">
        <span class="m3d-stat-label">Çerçeve</span>
        <span class="m3d-stat-value">{{ model.frames.length }}</span>
      </div>
      <div class="m3d-stat">
        <span class="m3d-stat-label">Döşeme</span>
        <span class="m3d-stat-value">{{ model.areas.length }}</span>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="model" class="m3d-legend">
      <div class="m3d-legend-item">
        <span class="dot" style="background:#3b82f6" />
        Kolon
      </div>
      <div class="m3d-legend-item">
        <span class="dot" style="background:#10b981" />
        Kiriş
      </div>
      <div class="m3d-legend-item">
        <span class="dot" style="background:#8b5cf680" />
        Döşeme
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { parseS2K, type ParsedModel } from '~/utils/s2kParser'
import { useProjectStore } from '~/stores/project'

const projectStore = useProjectStore()

const mountEl = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
const model = ref<ParsedModel | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let raf = 0
let resizeObserver: ResizeObserver | null = null

const COLOR_COLUMN = 0x3b82f6
const COLOR_BEAM = 0x10b981
const COLOR_SLAB = 0x8b5cf6
const COLOR_NODE = 0xf59e0b

/**
 * Build all Three.js geometry from a parsed model.
 * Frames are classified into columns (vertical) vs beams (horizontal)
 * by looking at the vector direction.
 */
function buildScene(m: ParsedModel) {
  if (!scene) return

  // Clear previous model meshes (keep lights/grid)
  const toRemove: THREE.Object3D[] = []
  scene.traverse(o => {
    if ((o as any).userData?.modelPart) toRemove.push(o)
  })
  toRemove.forEach(o => scene!.remove(o))

  const jointMap = new Map<number, THREE.Vector3>()
  for (const j of m.joints) {
    // SAP2000 uses Z-up; Three.js uses Y-up. Swap Y and Z.
    jointMap.set(j.id, new THREE.Vector3(j.x, j.z, -j.y))
  }

  // X ve Z'de ortala, Y'yi (yükseklik) tabanda bırak — taban grid ile hizalı.
  const center = new THREE.Vector3(
    (m.bounds.min[0] + m.bounds.max[0]) / 2,
    m.bounds.min[2], // SAP2000 Z-min == taban
    -(m.bounds.min[1] + m.bounds.max[1]) / 2,
  )
  jointMap.forEach(v => v.sub(center))

  // ===== Frames as cylinders =====
  const colGeom = new THREE.CylinderGeometry(0.12, 0.12, 1, 8)
  colGeom.translate(0, 0.5, 0) // pivot at base
  const beamGeom = new THREE.BoxGeometry(0.18, 0.3, 1)
  beamGeom.translate(0, 0, 0.5)

  const columnMat = new THREE.MeshStandardMaterial({
    color: COLOR_COLUMN,
    metalness: 0.1,
    roughness: 0.6,
  })
  const beamMat = new THREE.MeshStandardMaterial({
    color: COLOR_BEAM,
    metalness: 0.1,
    roughness: 0.6,
  })

  const dummy = new THREE.Object3D()
  const columns: { i: THREE.Vector3; j: THREE.Vector3 }[] = []
  const beams: { i: THREE.Vector3; j: THREE.Vector3 }[] = []

  for (const f of m.frames) {
    const a = jointMap.get(f.i)
    const b = jointMap.get(f.j)
    if (!a || !b) continue
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    if (len < 1e-6) continue
    const isVertical = Math.abs(dir.y) > Math.abs(dir.x) + Math.abs(dir.z)
    if (isVertical) columns.push({ i: a, j: b })
    else beams.push({ i: a, j: b })
  }

  // Instanced columns
  if (columns.length > 0) {
    const im = new THREE.InstancedMesh(colGeom, columnMat, columns.length)
    im.userData.modelPart = true
    columns.forEach((c, idx) => {
      const len = c.i.distanceTo(c.j)
      dummy.position.copy(c.i)
      // Cylinder default axis is Y. Align to (j - i).
      const dir = new THREE.Vector3().subVectors(c.j, c.i).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir,
      )
      dummy.quaternion.copy(quat)
      dummy.scale.set(1, len, 1)
      dummy.updateMatrix()
      im.setMatrixAt(idx, dummy.matrix)
    })
    scene.add(im)
  }

  // Instanced beams
  if (beams.length > 0) {
    const im = new THREE.InstancedMesh(beamGeom, beamMat, beams.length)
    im.userData.modelPart = true
    beams.forEach((b, idx) => {
      const len = b.i.distanceTo(b.j)
      dummy.position.copy(b.i)
      const dir = new THREE.Vector3().subVectors(b.j, b.i).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        dir,
      )
      dummy.quaternion.copy(quat)
      dummy.scale.set(1, 1, len)
      dummy.updateMatrix()
      im.setMatrixAt(idx, dummy.matrix)
    })
    scene.add(im)
  }

  // ===== Areas as polygons (slabs) =====
  if (m.areas.length > 0) {
    const slabMat = new THREE.MeshStandardMaterial({
      color: COLOR_SLAB,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const positions: number[] = []
    const indices: number[] = []
    let vertexOffset = 0
    for (const a of m.areas) {
      const verts = a.joints
        .map(jid => jointMap.get(jid))
        .filter((v): v is THREE.Vector3 => !!v)
      if (verts.length < 3) continue
      verts.forEach(v => positions.push(v.x, v.y, v.z))
      // Fan triangulation (works for convex quads/tris which is the typical case)
      for (let k = 1; k < verts.length - 1; k++) {
        indices.push(vertexOffset, vertexOffset + k, vertexOffset + k + 1)
      }
      vertexOffset += verts.length
    }
    if (positions.length > 0) {
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geom.setIndex(indices)
      geom.computeVertexNormals()
      const mesh = new THREE.Mesh(geom, slabMat)
      mesh.userData.modelPart = true
      scene.add(mesh)
    }
  }

  // ===== Joint markers =====
  const sphereGeom = new THREE.SphereGeometry(0.08, 8, 8)
  const sphereMat = new THREE.MeshBasicMaterial({ color: COLOR_NODE })
  const jointMesh = new THREE.InstancedMesh(sphereGeom, sphereMat, m.joints.length)
  jointMesh.userData.modelPart = true
  let idx = 0
  jointMap.forEach(v => {
    dummy.position.copy(v)
    dummy.quaternion.identity()
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    jointMesh.setMatrixAt(idx++, dummy.matrix)
  })
  scene.add(jointMesh)

  // ===== Camera framing =====
  if (camera && controls) {
    const sx = m.bounds.max[0] - m.bounds.min[0]
    const sy = m.bounds.max[2] - m.bounds.min[2]
    const sz = m.bounds.max[1] - m.bounds.min[1]
    const radius = Math.max(sx, sy, sz, 5) * 1.4
    const midY = sy / 2
    camera.position.set(radius, midY + radius * 0.6, radius)
    controls.target.set(0, midY, 0)
    controls.update()
  }
}

const initThree = () => {
  if (!mountEl.value) return
  const el = mountEl.value
  const w = el.clientWidth
  const h = el.clientHeight

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0a0a0a)

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(20, 20, 20)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(20, 30, 10)
  scene.add(dir)
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.3)
  dir2.position.set(-15, 10, -20)
  scene.add(dir2)

  // Grid (XZ plane in three.js, which is the ground for Y-up)
  const grid = new THREE.GridHelper(60, 30, 0x333333, 0x222222)
  scene.add(grid)

  // Axes helper (small)
  const axes = new THREE.AxesHelper(3)
  scene.add(axes)

  const animate = () => {
    raf = requestAnimationFrame(animate)
    controls?.update()
    renderer?.render(scene!, camera!)
  }
  animate()

  resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera || !mountEl.value) return
    const w = mountEl.value.clientWidth
    const h = mountEl.value.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(el)
}

const activeS2KContent = computed<string | null>(() => {
  const project = projectStore.activeProject
  if (!project) return null
  const file = project.files.find(f => {
    const ext = (f.format ?? '').toLowerCase()
    return ext === '.s2k' || ext === '.e2k'
  })
  return file?.content ?? null
})

const loadModel = async () => {
  loading.value = true
  error.value = ''
  try {
    const text = activeS2KContent.value
    if (!text) {
      throw new Error('Aktif projede .s2k / .e2k dosyası yok')
    }
    const parsed = parseS2K(text)
    if (parsed.joints.length === 0) {
      throw new Error('Modelden düğüm okunamadı')
    }
    model.value = parsed
    buildScene(parsed)
  } catch (e: any) {
    error.value = e?.message ?? 'Bilinmeyen hata'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  initThree()
  await loadModel()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
  if (renderer?.domElement.parentNode) {
    renderer.domElement.parentNode.removeChild(renderer.domElement)
  }
  scene = null
  camera = null
  renderer = null
  controls = null
})

// Aktif proje değişirse yeniden yükle
watch(activeS2KContent, () => {
  if (scene) loadModel()
})
</script>

<style scoped>
.model-3d {
  position: relative;
  width: 100%;
  height: 100%;
  background: #0a0a0a;
  overflow: hidden;
}

.m3d-canvas {
  width: 100%;
  height: 100%;
}

.m3d-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.875rem;
  z-index: 10;
}

.m3d-status.error {
  color: var(--accent-red);
  border-color: var(--accent-red);
}

.m3d-status :deep(svg) {
  width: 18px;
  height: 18px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.m3d-stats {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
  z-index: 10;
}

.m3d-stat {
  background: rgba(15, 15, 15, 0.85);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  min-width: 56px;
}

.m3d-stat-label {
  font-size: 0.625rem;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.m3d-stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.m3d-legend {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  gap: 12px;
  background: rgba(15, 15, 15, 0.85);
  border: 1px solid var(--border-default);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  z-index: 10;
}

.m3d-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
}
</style>
