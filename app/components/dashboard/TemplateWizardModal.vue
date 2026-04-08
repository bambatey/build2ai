<template>
  <Teleport to="body">
    <div v-if="modelValue" class="tw-overlay" @click.self="close">
      <div class="tw-modal">
        <!-- Header -->
        <div class="tw-header">
          <div class="tw-header-left">
            <div class="tw-header-icon">
              <Icon name="lucide:layout-template" />
            </div>
            <div>
              <h3 class="tw-title">Şablondan Proje Oluştur</h3>
              <p class="tw-subtitle">{{ stepLabels[step] }}</p>
            </div>
          </div>
          <button type="button" class="tw-close" @click="close">
            <Icon name="lucide:x" />
          </button>
        </div>

        <!-- Stepper -->
        <div class="tw-stepper">
          <div
            v-for="(label, idx) in stepLabels"
            :key="idx"
            class="tw-step"
            :class="{ active: idx === step, done: idx < step }"
          >
            <div class="tw-step-dot">
              <Icon v-if="idx < step" name="lucide:check" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span class="tw-step-label">{{ label }}</span>
          </div>
        </div>

        <!-- Body -->
        <div class="tw-body">
          <!-- STEP 0: Program -->
          <div v-if="step === 0" class="tw-step-content">
            <div class="tw-grid-cards">
              <button
                v-for="prog in programs"
                :key="prog.id"
                type="button"
                class="tw-card"
                :class="{ selected: config.program === prog.id, disabled: prog.disabled }"
                :disabled="prog.disabled"
                @click="!prog.disabled && (config.program = prog.id)"
              >
                <div class="tw-card-icon" :style="{ color: prog.color }">
                  <Icon :name="prog.icon" />
                </div>
                <div class="tw-card-title">{{ prog.name }}</div>
                <div class="tw-card-desc">{{ prog.format }}</div>
                <span v-if="prog.disabled" class="tw-card-badge">Yakında</span>
              </button>
            </div>
          </div>

          <!-- STEP 1: Grid -->
          <div v-if="step === 1" class="tw-step-content">
            <div class="tw-section-label">Hazır Grid Seçenekleri</div>
            <div class="tw-grid-presets">
              <button
                v-for="g in gridPresets"
                :key="`${g.x}x${g.y}`"
                type="button"
                class="tw-preset"
                :class="{ selected: !customGrid && config.gridX === g.x && config.gridY === g.y }"
                @click="selectGridPreset(g)"
              >
                <div class="tw-preset-visual">
                  <div
                    class="tw-grid-preview"
                    :style="{
                      gridTemplateColumns: `repeat(${g.x}, 1fr)`,
                      gridTemplateRows: `repeat(${g.y}, 1fr)`,
                    }"
                  >
                    <div v-for="n in g.x * g.y" :key="n" class="tw-grid-cell" />
                  </div>
                </div>
                <div class="tw-preset-label">{{ g.x }}×{{ g.y }}</div>
              </button>
            </div>

            <div class="tw-divider">
              <span>veya manuel</span>
            </div>

            <div class="tw-manual-row">
              <label class="tw-field">
                <span class="tw-field-label">X (kolon)</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  v-model.number="config.gridX"
                  class="tw-input"
                  @input="customGrid = true"
                />
              </label>
              <label class="tw-field">
                <span class="tw-field-label">Y (satır)</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  v-model.number="config.gridY"
                  class="tw-input"
                  @input="customGrid = true"
                />
              </label>
              <label class="tw-field">
                <span class="tw-field-label">Açıklık (m)</span>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  v-model.number="config.gridSpacing"
                  class="tw-input"
                />
              </label>
            </div>
          </div>

          <!-- STEP 2: Floors -->
          <div v-if="step === 2" class="tw-step-content">
            <div class="tw-section-label">Hazır Kat Seçenekleri</div>
            <div class="tw-floor-presets">
              <button
                v-for="f in floorPresets"
                :key="f.count"
                type="button"
                class="tw-preset tw-floor-preset"
                :class="{ selected: config.numFloors === f.count }"
                @click="config.numFloors = f.count"
              >
                <div class="tw-floor-visual">
                  <div
                    v-for="n in Math.min(f.count, 8)"
                    :key="n"
                    class="tw-floor-bar"
                  />
                </div>
                <div class="tw-preset-label">{{ f.label }}</div>
                <div class="tw-preset-sub">{{ f.count }} kat</div>
              </button>
            </div>

            <div class="tw-divider"><span>veya manuel</span></div>

            <div class="tw-manual-row">
              <label class="tw-field">
                <span class="tw-field-label">Kat Sayısı</span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  v-model.number="config.numFloors"
                  class="tw-input"
                />
              </label>
              <label class="tw-field">
                <span class="tw-field-label">Kat Yüksekliği (m)</span>
                <input
                  type="number"
                  min="2"
                  step="0.1"
                  v-model.number="config.floorHeight"
                  class="tw-input"
                />
              </label>
            </div>
          </div>

          <!-- STEP 3: Materials -->
          <div v-if="step === 3" class="tw-step-content">
            <div class="tw-section-label">Beton</div>
            <div class="tw-mat-grid">
              <button
                v-for="m in concreteOptions"
                :key="m"
                type="button"
                class="tw-mat-chip"
                :class="{ selected: config.materials.includes(m) }"
                @click="toggleMaterial(m)"
              >
                <Icon name="lucide:box" />
                {{ m }}
              </button>
            </div>

            <div class="tw-section-label" style="margin-top: 1.25rem">Çelik</div>
            <div class="tw-mat-grid">
              <button
                v-for="m in steelOptions"
                :key="m"
                type="button"
                class="tw-mat-chip"
                :class="{ selected: config.materials.includes(m) }"
                @click="toggleMaterial(m)"
              >
                <Icon name="lucide:bolt" />
                {{ m }}
              </button>
            </div>

            <div class="tw-section-label" style="margin-top: 1.25rem">Manuel Ekle</div>
            <div class="tw-manual-row">
              <input
                type="text"
                v-model="customMaterial"
                placeholder="örn. C50, S275"
                class="tw-input"
                @keydown.enter.prevent="addCustomMaterial"
              />
              <button type="button" class="tw-btn tw-btn-secondary" @click="addCustomMaterial">
                Ekle
              </button>
            </div>

            <div v-if="config.materials.length" class="tw-selected-list">
              <div class="tw-section-label">Seçilenler</div>
              <div class="tw-mat-grid">
                <span v-for="m in config.materials" :key="m" class="tw-mat-chip selected">
                  {{ m }}
                  <button type="button" class="tw-chip-remove" @click="toggleMaterial(m)">
                    <Icon name="lucide:x" />
                  </button>
                </span>
              </div>
            </div>
          </div>

          <!-- STEP 4: Review + name -->
          <div v-if="step === 4" class="tw-step-content">
            <label class="tw-field">
              <span class="tw-field-label">Proje Adı</span>
              <input
                ref="nameInput"
                type="text"
                v-model="projectName"
                placeholder="örn. Bina_Sablon_v1"
                class="tw-input"
              />
            </label>

            <div class="tw-summary">
              <div class="tw-summary-row">
                <span class="tw-summary-label">Program</span>
                <span class="tw-summary-value">{{ selectedProgramName }}</span>
              </div>
              <div class="tw-summary-row">
                <span class="tw-summary-label">Grid</span>
                <span class="tw-summary-value">
                  {{ config.gridX }}×{{ config.gridY }} ({{ config.gridSpacing }}m)
                </span>
              </div>
              <div class="tw-summary-row">
                <span class="tw-summary-label">Kat</span>
                <span class="tw-summary-value">
                  {{ config.numFloors }} kat × {{ config.floorHeight }}m
                </span>
              </div>
              <div class="tw-summary-row">
                <span class="tw-summary-label">Malzeme</span>
                <span class="tw-summary-value">
                  {{ config.materials.length ? config.materials.join(', ') : '—' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="tw-footer">
          <button
            type="button"
            class="tw-btn tw-btn-secondary"
            @click="prevStep"
            :disabled="step === 0"
          >
            <Icon name="lucide:arrow-left" /> Geri
          </button>
          <div class="tw-footer-right">
            <button type="button" class="tw-btn tw-btn-ghost" @click="close">İptal</button>
            <button
              v-if="step < stepLabels.length - 1"
              type="button"
              class="tw-btn tw-btn-primary"
              :disabled="!canProceed"
              @click="nextStep"
            >
              İleri <Icon name="lucide:arrow-right" />
            </button>
            <button
              v-else
              type="button"
              class="tw-btn tw-btn-primary"
              :disabled="!projectName.trim()"
              @click="createProject"
            >
              <Icon name="lucide:check" /> Projeyi Oluştur
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore, type Project, type FileNode } from '~/stores/project'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const router = useRouter()
const projectStore = useProjectStore()

const step = ref(0)
const stepLabels = ['Program', 'Grid', 'Kat', 'Malzeme', 'Özet']

const programs = [
  { id: 'sap2000', name: 'SAP2000', format: '.s2k', icon: 'lucide:building-2', color: '#3B82F6', disabled: false },
  { id: 'etabs', name: 'ETABS', format: '.e2k', icon: 'lucide:building', color: '#8B5CF6', disabled: true },
  { id: 'robot', name: 'Robot', format: '.rtd', icon: 'lucide:bot', color: '#10B981', disabled: true },
  { id: 'staad', name: 'STAAD.Pro', format: '.std', icon: 'lucide:layers', color: '#F59E0B', disabled: true },
]

const gridPresets = [
  { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 4 },
  { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 8, y: 5 },
]

const floorPresets = [
  { count: 1, label: 'Tek Katlı' },
  { count: 3, label: 'Az Katlı' },
  { count: 5, label: 'Orta' },
  { count: 10, label: 'Çok Katlı' },
  { count: 20, label: 'Yüksek' },
]

const concreteOptions = ['C25', 'C30', 'C35', 'C40', 'C45']
const steelOptions = ['S220', 'S420', 'S500', 'S275', 'S355']

interface TemplateConfig {
  program: string
  gridX: number
  gridY: number
  gridSpacing: number
  numFloors: number
  floorHeight: number
  materials: string[]
}

const config = ref<TemplateConfig>({
  program: 'sap2000',
  gridX: 4,
  gridY: 3,
  gridSpacing: 5,
  numFloors: 5,
  floorHeight: 3,
  materials: ['C30', 'S420'],
})

const customGrid = ref(false)
const customMaterial = ref('')
const projectName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

const selectedProgramName = computed(
  () => programs.find(p => p.id === config.value.program)?.name ?? '—',
)

const canProceed = computed(() => {
  if (step.value === 0) return !!config.value.program
  if (step.value === 1) return config.value.gridX > 0 && config.value.gridY > 0
  if (step.value === 2) return config.value.numFloors > 0
  if (step.value === 3) return config.value.materials.length > 0
  return true
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      step.value = 0
      projectName.value = ''
    }
  },
)

watch(step, async (s) => {
  if (s === 4) {
    if (!projectName.value) {
      const prog = selectedProgramName.value
      projectName.value = `${prog}_${config.value.gridX}x${config.value.gridY}_${config.value.numFloors}kat`
    }
    await nextTick()
    nameInput.value?.focus()
  }
})

function selectGridPreset(g: { x: number; y: number }) {
  config.value.gridX = g.x
  config.value.gridY = g.y
  customGrid.value = false
}

function toggleMaterial(m: string) {
  const i = config.value.materials.indexOf(m)
  if (i >= 0) config.value.materials.splice(i, 1)
  else config.value.materials.push(m)
}

function addCustomMaterial() {
  const m = customMaterial.value.trim().toUpperCase()
  if (m && !config.value.materials.includes(m)) {
    config.value.materials.push(m)
  }
  customMaterial.value = ''
}

function nextStep() {
  if (step.value < stepLabels.length - 1 && canProceed.value) step.value++
}

function prevStep() {
  if (step.value > 0) step.value--
}

function close() {
  emit('update:modelValue', false)
}

// SAP2000 .s2k formatı: Türkçe ondalık (virgül), 3 boşluk ayraç, tab girintisi
function num(n: number): string {
  return n.toString().replace('.', ',')
}

function buildS2KContent(name: string, c: TemplateConfig): string {
  const now = new Date()
  const dateStr = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear().toString().slice(2)} at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  const concretes = c.materials.filter(m => m.startsWith('C'))
  const steels = c.materials.filter(m => !m.startsWith('C'))
  const primaryConc = concretes[0] ?? 'C30'
  const primarySteel = steels[0] ?? 'S420'

  const L: string[] = []
  L.push(`File ${name}.s2k was saved on ${dateStr} by build2ai`)
  L.push(` `)
  L.push(`TABLE:  "PROGRAM CONTROL"`)
  L.push(`   ProgramName=SAP2000   Version=26.2.0   ProgLevel=Ultimate   CurrUnits="KN, m, C"   SteelCode="AISC 360-16"   ConcCode="ACI 318-19"`)
  L.push(` `)
  L.push(`TABLE:  "ACTIVE DEGREES OF FREEDOM"`)
  L.push(`   UX=Yes   UY=Yes   UZ=Yes   RX=Yes   RY=Yes   RZ=Yes`)
  L.push(` `)
  L.push(`TABLE:  "ANALYSIS OPTIONS"`)
  L.push(`   Solver=Advanced   SolverProc=Auto   Force32Bit=No   StiffCase=None   GeomMod=None   HingeOpt="In Elements"`)
  L.push(` `)
  L.push(`TABLE:  "COORDINATE SYSTEMS"`)
  L.push(`   Name=GLOBAL   Type=Cartesian   X=0   Y=0   Z=0   AboutZ=0   AboutY=0   AboutX=0`)
  L.push(` `)

  // Grid lines
  L.push(`TABLE:  "GRID LINES"`)
  const xLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (let i = 0; i < c.gridX; i++) {
    const id = xLetters[i] ?? `X${i + 1}`
    L.push(`   CoordSys=GLOBAL   AxisDir=X   GridID=${id}   XRYZCoord=${num(i * c.gridSpacing)}   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=End`)
  }
  for (let i = 0; i < c.gridY; i++) {
    L.push(`   CoordSys=GLOBAL   AxisDir=Y   GridID=${i + 1}   XRYZCoord=${num(i * c.gridSpacing)}   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=Start`)
  }
  for (let i = 0; i <= c.numFloors; i++) {
    L.push(`   CoordSys=GLOBAL   AxisDir=Z   GridID=Z${i + 1}   XRYZCoord=${num(i * c.floorHeight)}   LineType=Primary   LineColor=Gray8Dark   Visible=Yes   BubbleLoc=End`)
  }
  L.push(` `)

  // Materials
  L.push(`TABLE:  "MATERIAL PROPERTIES 01 - GENERAL"`)
  for (const m of concretes) {
    L.push(`   Material=${m}   Type=Concrete   SymType=Isotropic   TempDepend=No   Color=Cyan   Notes="${m} Concrete"`)
  }
  for (const m of steels) {
    L.push(`   Material=${m}   Type=Steel   Grade=${m}   SymType=Isotropic   TempDepend=No   Color=Magenta   Notes="${m} Steel"`)
  }
  L.push(`   Material=rebar   Type=Rebar   SymType=Uniaxial   TempDepend=No   Color=Red   Notes="Rebar"`)
  L.push(` `)

  L.push(`TABLE:  "MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES"`)
  for (const m of concretes) {
    // Fcm (MPa) ≈ class number; E (kN/m²) ≈ 5000*sqrt(fck) MPa → x1000
    const fck = parseInt(m.replace('C', '')) || 30
    const E = Math.round(5000 * Math.sqrt(fck)) * 1000
    L.push(`   Material=${m}   UnitWeight=25   UnitMass=2,5492904805560515   E1=${num(E)}   U12=0,2   A1=9,9E-06`)
  }
  for (const m of steels) {
    L.push(`   Material=${m}   UnitWeight=76,9728   UnitMass=7,8490   E1=210000000   G12=80769230   U12=0,3   A1=1,17E-05`)
  }
  L.push(`   Material=rebar   UnitWeight=76,9728   UnitMass=7,8490   E1=200000000   A1=1,17E-05`)
  L.push(` `)

  // Concrete data
  if (concretes.length) {
    L.push(`TABLE:  "MATERIAL PROPERTIES 03B - CONCRETE DATA"`)
    for (const m of concretes) {
      const fck = parseInt(m.replace('C', '')) || 30
      L.push(`   Material=${m}   Fc=${num(fck * 1000)}   eFc=${num(fck * 1000)}   LtWtConc=No   SSCurveOpt=Mander   SSHysType=Takeda   SFc=0,002   SCap=0,005   FinalSlope=-0,1`)
    }
    L.push(` `)
  }

  // Steel data
  if (steels.length) {
    L.push(`TABLE:  "MATERIAL PROPERTIES 03A - STEEL DATA"`)
    for (const m of steels) {
      const fy = parseInt(m.replace(/[^0-9]/g, '')) || 420
      L.push(`   Material=${m}   Fy=${num(fy * 1000)}   Fu=${num(Math.round(fy * 1.45) * 1000)}   EffFy=${num(Math.round(fy * 1.1) * 1000)}   EffFu=${num(Math.round(fy * 1.6) * 1000)}   SSCurveOpt=Simple   SSHysType=Kinematic   SHard=0,015   SMax=0,11   SRup=0,17`)
    }
    L.push(` `)
  }

  // Frame sections (column + beam)
  L.push(`TABLE:  "FRAME SECTION PROPERTIES 01 - GENERAL"`)
  L.push(`   SectionName=COL40x40   Material=${primaryConc}   Shape=Rectangular   t3=0,4   t2=0,4   Area=0,16   I33=2,1333E-03   I22=2,1333E-03   ConcCol=Yes   ConcBeam=No   Color=Blue`)
  L.push(`   SectionName=BEAM25x50   Material=${primaryConc}   Shape=Rectangular   t3=0,5   t2=0,25   Area=0,125   I33=2,6042E-03   I22=6,5104E-04   ConcCol=No   ConcBeam=Yes   Color=Green`)
  L.push(` `)

  // Joint coordinates (her grid noktası, her kat)
  L.push(`TABLE:  "JOINT COORDINATES"`)
  let jointId = 1
  for (let k = 0; k <= c.numFloors; k++) {
    for (let j = 0; j < c.gridY; j++) {
      for (let i = 0; i < c.gridX; i++) {
        L.push(`   Joint=${jointId}   CoordSys=GLOBAL   CoordType=Cartesian   XorR=${num(i * c.gridSpacing)}   Y=${num(j * c.gridSpacing)}   Z=${num(k * c.floorHeight)}   SpecialJt=No`)
        jointId++
      }
    }
  }
  L.push(` `)

  // Load patterns
  L.push(`TABLE:  "LOAD PATTERN DEFINITIONS"`)
  L.push(`   LoadPat=G   DesignType=Dead   SelfWtMult=1`)
  L.push(`   LoadPat=Q   DesignType=Live   SelfWtMult=0`)
  L.push(`   LoadPat=EQX   DesignType=Quake   SelfWtMult=0`)
  L.push(`   LoadPat=EQY   DesignType=Quake   SelfWtMult=0`)
  L.push(` `)

  L.push(`END TABLE DATA`)
  L.push(` `)
  return L.join('\n')
}

function createProject() {
  const name = projectName.value.trim()
  if (!name) return

  const id = crypto.randomUUID()
  const c = config.value
  const fileName = `${name}.s2k`
  const content = buildS2KContent(name, c)

  const fileNode: FileNode = {
    id: crypto.randomUUID(),
    name: fileName,
    type: 'file',
    path: `/${name}/${fileName}`,
    format: '.s2k',
    size: content.length,
    lineCount: content.split('\n').length,
    lastModified: new Date(),
    content,
  }

  const project: Project = {
    id,
    name,
    format: '.s2k',
    fileCount: 1,
    lastModified: new Date(),
    progress: 0,
    tags: [
      'şablon',
      `${c.gridX}x${c.gridY}`,
      `${c.numFloors}kat`,
      ...c.materials,
    ],
    files: [fileNode],
  }

  projectStore.addProject(project)
  projectStore.openProject(id)
  close()
  router.push('/workspace')
}
</script>

<style scoped>
.tw-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 1rem;
}

.tw-modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 14px;
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.tw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.125rem 1.5rem;
  border-bottom: 1px solid var(--border-default);
}

.tw-header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.tw-header-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.12);
  color: var(--accent-blue);
  font-size: 1.125rem;
}

.tw-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.tw-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0.125rem 0 0;
}

.tw-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.15s;
}

.tw-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Stepper */
.tw-stepper {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-primary);
  overflow-x: auto;
}

.tw-step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  position: relative;
}

.tw-step:not(:last-child)::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-default);
  margin: 0 0.5rem;
}

.tw-step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all 0.2s;
}

.tw-step.active .tw-step-dot {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
  color: white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
}

.tw-step.done .tw-step-dot {
  background: var(--accent-green);
  border-color: var(--accent-green);
  color: white;
}

.tw-step-label {
  font-size: 0.8125rem;
  color: var(--text-muted);
  font-weight: 500;
  white-space: nowrap;
}

.tw-step.active .tw-step-label {
  color: var(--text-primary);
}

.tw-step.done .tw-step-label {
  color: var(--text-secondary);
}

/* Body */
.tw-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.tw-step-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.tw-section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 0.625rem;
}

/* Program cards */
.tw-grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.875rem;
}

.tw-card {
  position: relative;
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border-default);
  border-radius: 10px;
  padding: 1.125rem 1rem;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tw-card:hover:not(.disabled) {
  border-color: var(--accent-blue);
  background: var(--bg-elevated);
  transform: translateY(-2px);
}

.tw-card.selected {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.tw-card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tw-card-icon {
  font-size: 1.5rem;
}

.tw-card-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.tw-card-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.tw-card-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  font-size: 0.625rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

/* Grid presets */
.tw-grid-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.tw-preset {
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border-default);
  border-radius: 10px;
  padding: 0.875rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.tw-preset:hover {
  border-color: var(--accent-blue);
  background: var(--bg-elevated);
}

.tw-preset.selected {
  border-color: var(--accent-blue);
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.tw-preset-visual {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
}

.tw-grid-preview {
  display: grid;
  width: 100%;
  height: 100%;
  gap: 2px;
}

.tw-grid-cell {
  background: var(--text-muted);
  border-radius: 1px;
  opacity: 0.5;
}

.tw-preset.selected .tw-grid-cell {
  background: var(--accent-blue);
  opacity: 0.8;
}

.tw-preset-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.tw-preset-sub {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

/* Floor presets */
.tw-floor-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.75rem;
}

.tw-floor-preset {
  min-height: 130px;
}

.tw-floor-visual {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  height: 50px;
  width: 28px;
}

.tw-floor-bar {
  flex: 1;
  background: var(--text-muted);
  opacity: 0.5;
  border-radius: 1px;
}

.tw-floor-preset.selected .tw-floor-bar {
  background: var(--accent-blue);
  opacity: 0.8;
}

/* Divider */
.tw-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.tw-divider::before,
.tw-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-default);
}

/* Manual row */
.tw-manual-row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.tw-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
}

.tw-field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.tw-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.625rem 0.875rem;
  font-size: 0.9375rem;
  color: var(--text-primary);
  transition: border-color 0.15s;
}

.tw-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

/* Materials */
.tw-mat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tw-mat-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border-default);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'JetBrains Mono', monospace;
}

.tw-mat-chip:hover {
  border-color: var(--accent-blue);
  color: var(--text-primary);
}

.tw-mat-chip.selected {
  background: rgba(59, 130, 246, 0.12);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.tw-chip-remove {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  display: flex;
  padding: 0;
  margin-left: 0.125rem;
  opacity: 0.7;
}

.tw-chip-remove:hover {
  opacity: 1;
}

.tw-selected-list {
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--border-default);
}

/* Summary */
.tw-summary {
  margin-top: 1.25rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  padding: 1rem 1.25rem;
}

.tw-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0;
  border-bottom: 1px solid var(--border-default);
}

.tw-summary-row:last-child {
  border-bottom: none;
}

.tw-summary-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  font-weight: 600;
}

.tw-summary-value {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
  text-align: right;
}

/* Footer */
.tw-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-default);
  background: var(--bg-primary);
}

.tw-footer-right {
  display: flex;
  gap: 0.625rem;
}

.tw-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5625rem 1.125rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.tw-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tw-btn-primary {
  background: var(--accent-blue);
  color: white;
}

.tw-btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.tw-btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border-color: var(--border-default);
}

.tw-btn-secondary:hover:not(:disabled) {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.tw-btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.tw-btn-ghost:hover {
  color: var(--text-primary);
}
</style>
