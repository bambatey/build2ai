# 04 — Shader-Based 3D Görselleştirme

> **Konu:** Three.js + custom GLSL shader'lar ile analiz sonuçlarını 3D görselleştirme. Deformed shape, mod animasyonu, time history playback, kontur, kesit tesirleri overlay.

## 4.1 Görselleştirme envanteri

| # | Görselleştirme | Kullanım | Veri kaynağı |
|---|---|---|---|
| 1 | **Deforme şekil** (statik) | Per case yapı eğilmesi | Per node displacement |
| 2 | **Mod şekli** (animasyonlu) | T1, T2, T3 modlarını oynat | Mod vektör + frekans |
| 3 | **Time history playback** | Deprem altında animasyon | U(t) per node, time-history |
| 4 | **Kesit tesirleri overlay** | Kiriş rengi = max moment | M3(x), V2(x), N(x) per beam |
| 5 | **Stress contour (shell)** | Per element σ_vm renklendirme | Stress per shell vertex |
| 6 | **Reaksiyon vektörleri** | Mesnet ok işaretleri | F, M per support |
| 7 | **Pushover hinge formation** | Adım × hinge state animasyon | Hinge timeline |
| 8 | **Drift profili** | Kat × yatay deplasman çubuğu | U_x per story |

8 görselleştirme — hepsi WebGL + three.js ile yapılır.

## 4.2 Teknoloji seçimi

### Karşılaştırma
| | three.js | BabylonJS | Threlte | Plotly.js |
|---|---|---|---|---|
| Maturity | En olgun | Olgun | Yeni | Olgun |
| Engineering örneği | Çok | Az | Az | Çok ama 2D |
| Custom shader | Tam kontrol | Tam | Tam | Sınırlı |
| Vue 3 entegrasyon | El ile | El ile | Native | İyi |
| Bundle size | 600KB | 1.2MB | 50KB + three | 3MB |

### Karar: **three.js + custom ShaderMaterial**

Mevcut `Model3DPreview.vue` zaten three.js kullanıyor. Yeni framework öğrenmek gereksiz. Custom shader'lar GLSL ile yazılır, Vue tarafı reactive uniform/attribute güncelleme.

## 4.3 Mimari plan

```
app/components/visualization/
├── Viz3DCanvas.vue              # Ortak canvas + scene + lights + camera
├── DeformedShape.vue            # Görselleştirme 1
├── ModeShape.vue                # Görselleştirme 2
├── TimeHistoryPlayback.vue      # Görselleştirme 3
├── ForceOverlay.vue             # Görselleştirme 4
├── StressContour.vue            # Görselleştirme 5
├── ReactionVectors.vue          # Görselleştirme 6
├── PushoverAnimation.vue        # Görselleştirme 7
└── DriftProfile.vue             # Görselleştirme 8

app/composables/
├── useViz3D.ts                  # Three.js scene management
├── useShader.ts                 # GLSL ShaderMaterial wrapper
└── useColormap.ts               # Colormap textures (jet, viridis)

app/shaders/
├── deformed.vert                # Deformed shape vertex shader
├── deformed.frag                # Deformed shape fragment shader
├── mode_shape.vert              # Mod animasyon vertex
├── mode_shape.frag
├── time_history.vert            # Time history with texture sampling
├── time_history.frag
├── force_overlay.vert           # Beam coloring
├── force_overlay.frag           # Colormap sampling
├── stress_contour.vert          # Per-vertex stress
├── stress_contour.frag          # Smooth gradient
└── colormaps.ts                 # Jet, viridis, spectral data
```

## 4.4 Görselleştirme detayları

### 1) Deforme şekil

**Algoritma:** Her node'un orijinal pozisyonu + displacement vektörü × user scale.

**Vertex shader:**
```glsl
attribute vec3 displacement;
uniform float scale;

void main() {
  vec3 deformed = position + displacement * scale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(deformed, 1.0);
}
```

**Fragment shader:**
```glsl
uniform vec3 lineColor;

void main() {
  gl_FragColor = vec4(lineColor, 1.0);
}
```

**Vue component:**
```vue
<script setup lang="ts">
const props = defineProps<{
  modelGeometry: THREE.BufferGeometry  // base mesh
  displacements: Float32Array           // (N_nodes × 3,)
  scale: number                          // user slider 1-1000
}>()

const material = new THREE.ShaderMaterial({
  vertexShader: deformedVert,
  fragmentShader: deformedFrag,
  uniforms: {
    scale: { value: props.scale },
    lineColor: { value: new THREE.Color(0x3b82f6) },
  },
})

watch(() => props.scale, (s) => {
  material.uniforms.scale.value = s
})

// Displacement attribute geometry'ye ekle (bir kere)
onMounted(() => {
  props.modelGeometry.setAttribute(
    'displacement',
    new THREE.BufferAttribute(props.displacements, 3),
  )
})
</script>
```

**Performans:** 60 FPS smooth slider, 5000 frame'de bile.

**Daha iyi görünüm — cubic Hermite:**
Lineer interpolasyon yerine, beam'i 8 segmente böl, her ara nokta için Hermite eğrisi:
```
P(t) = (2t³-3t²+1)P0 + (t³-2t²+t)L·T0 + (-2t³+3t²)P1 + (t³-t²)L·T1
```
T0 ve T1 = end rotation tangent vektörleri. **Gerçek bending görünümü** (beam eğri görünür).

### 2) Mod şekli animasyonu

```glsl
uniform float time;
uniform float omega;
uniform float scale;
attribute vec3 modeShape;

void main() {
  vec3 deformed = position + modeShape * sin(time * omega) * scale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(deformed, 1.0);
}
```

**Vue:**
```vue
<script setup>
const time = ref(0)

useRafFn(() => {
  time.value += 0.016  // 60 FPS = ~16ms per frame
  material.uniforms.time.value = time.value
})

watch(() => props.selectedMode, (mode) => {
  geometry.setAttribute('modeShape', new THREE.BufferAttribute(mode.shape, 3))
  material.uniforms.omega.value = mode.omega
})
</script>
```

GPU sürekli yeni pozisyon hesaplar, CPU sadece `time` artırır. 60 FPS akıcı.

**Kullanıcı kontrolleri:**
- Mod seçici (T1, T2, ...)
- Animation speed slider (0.5x, 1x, 2x)
- Scale slider
- Pause/resume

### 3) Time history playback

**Sorun:** 10K step × 1K node × 3 component × 4 byte = **120 MB**. Browser RAM tavanı.

**3 strateji:**

#### A) Tüm veriyi GPU texture olarak yükle
```glsl
uniform sampler2D historyTex;
uniform float currentStep;
attribute int nodeIndex;

void main() {
  vec2 uv = vec2(currentStep / TOTAL_STEPS, float(nodeIndex) / N_NODES);
  vec3 disp = texture2D(historyTex, uv).rgb;
  vec3 deformed = position + disp * scale;
  gl_Position = ...;
}
```
- GPU texture'da time history saklı
- 60 FPS smooth playback
- Sınır: ~50MB texture'a sığar

#### B) Streaming chunks
- Backend her N saniyelik chunk'ı ayrı dosya olarak yazar
- Browser ihtiyaç oldukça indir (lazy)
- Skip yaparken yeni chunk gelene kadar pause

#### C) Decimation
- 10,000 step → 1,000 step (her 10. step)
- Görsel akıcılık bozulmaz, veri 10× azalır
- Detay zoom'unda tam veri yüklenir

**Faz 2:** A ile başla (basit, küçük modeller). Faz 3: B'ye geç.

### 4) Kesit tesirleri overlay

**Renk mapping ile:**
```glsl
attribute float forceValue;  // M3, V2, N için
uniform float minVal, maxVal;
varying float t;

void main() {
  t = (forceValue - minVal) / (maxVal - minVal);
  ...
}

// Fragment
varying float t;
uniform sampler2D colormap;  // 1D texture (jet, viridis)

void main() {
  vec4 color = texture2D(colormap, vec2(t, 0.5));
  gl_FragColor = color;
}
```

**Kalınlık ile vurgu (ekstra):**
- Beam'leri TubeGeometry olarak çiz (LineSegments yerine)
- Tube radius = `|M3| / max_M3 × max_radius`
- Kullanıcı görsel olarak hangi beam'in büyük momenti olduğunu anlar

**Kullanıcı kontrolleri:**
- Hangi büyüklük (M3, M2, V2, V3, N, T)?
- Min/max range slider
- Colormap dropdown (jet, viridis, spectral, coolwarm)
- Legend (renkli bar + sayısal değerler)

### 5) Shell stress contour

**Per-vertex smoothing (gerçek FEM viz tekniği):**
- Her node'da, o node'a bağlı tüm shell elementlerin ortalama gerilmesi
- Vertex shader'da `varying float stress` interpolate eder
- Fragment'te colormap

```glsl
attribute float vertexStress;
varying float v_stress;

void main() {
  v_stress = vertexStress;
  ...
}

// Fragment
varying float v_stress;
uniform float minStress, maxStress;
uniform sampler2D colormap;

void main() {
  float t = (v_stress - minStress) / (maxStress - minStress);
  gl_FragColor = texture2D(colormap, vec2(t, 0.5));
}
```

Görünüm: smooth gradient, profesyonel FEM viz uygulamaları gibi.

### 6) Mesnet reaksiyonları

3D ok işaretleri:
- Three.js `THREE.ArrowHelper` ya da custom (cone + cylinder)
- **Instancing** ile çok mesnet performanslı
- Renk: çekme yeşil, basınç kırmızı
- Uzunluk: |F| / max_F × user_scale

```vue
<script setup>
const arrows = computed(() =>
  reactions.value.map(r => ({
    pos: new THREE.Vector3(r.x, r.y, r.z),
    dir: new THREE.Vector3(r.fx, r.fy, r.fz).normalize(),
    length: Math.sqrt(r.fx ** 2 + r.fy ** 2 + r.fz ** 2) * scaleFactor,
    color: r.fz > 0 ? 0x10b981 : 0xef4444,
  }))
)
</script>
```

### 7) Pushover hinge formation

**Animasyonlu zaman çizgisi:**
- Her frame'in iki ucundaki hinge state per pushover step
- Renk: yeşil (intact) → sarı (yielded) → kırmızı (failed)
- Pushover step scrubber (0 → N_steps)
- Capacity curve (V_base vs U_roof) yan grafik (Plotly veya canvas)

**Veri formatı:**
```typescript
interface HingeTimeline {
  hinge_id: string  // örn. "F12_I" (frame 12, end I)
  states: Array<{ step: number; state: 'elastic' | 'yielded' | 'failed'; rotation: number }>
}
```

Pushover step değiştiğinde:
- Her hinge için o step'teki state'i bul
- Renk attribute güncelle
- Re-render

### 8) Drift profili

2D side-view chart (Plotly ya da Chart.js):
- X axis: yatay deplasman (mm)
- Y axis: kat seviyesi (m)
- TBDY 2018 sınırı (h/250 vs) yatay çizgi olarak çiz
- Multi-case karşılaştırma (DEAD, EX, EX+EY)

```vue
<script setup>
import Plot from 'plotly.js'

const traces = computed(() => [
  {
    x: storyDrifts.map(d => d.x_drift_mm),
    y: storyHeights.map(h => h),
    name: selectedCase,
    type: 'scatter',
    mode: 'lines+markers',
  },
  {
    // TBDY sınır çizgisi
    x: [tbdyLimit_mm, tbdyLimit_mm],
    y: [0, totalHeight],
    name: 'TBDY 2018 sınır (h/250)',
    line: { dash: 'dash', color: 'red' },
  },
])
</script>
```

## 4.5 Veri formatı — backend → frontend

**Optimum:** JSON yerine binary `Float32Array` (ArrayBuffer).

```
Header (varint):
  - n_nodes: u32
  - n_frames: u32
  - n_cases: u32
  - n_modes: u32

Node coordinates: Float32Array (n_nodes × 3)

Frame connectivity: Uint32Array (n_frames × 2)

Per case:
  case_id: utf-8 string (length-prefixed)
  displacements: Float32Array (n_nodes × 6)   # ux, uy, uz, rx, ry, rz
  reactions: ...
  
Per mode:
  period: f32
  shape: Float32Array (n_nodes × 3)
```

**Avantaj:**
- 3× boyut tasarrufu (vs JSON)
- Parse 5× hızlı (`new Float32Array(buffer)` doğrudan)
- Browser tarafında zero-copy texture upload

**Backend:**
```python
@router.get("/api/.../viz-data")
async def viz_data(...):
    buffer = io.BytesIO()
    buffer.write(struct.pack("<III", n_nodes, n_frames, n_cases))
    np_node_coords.tobytes()
    ...
    return Response(buffer.getvalue(), media_type="application/octet-stream")
```

## 4.6 Performans tahminleri

| Senaryo | FPS (M1 Mac) | FPS (orta laptop) |
|---|---|---|
| 1000 frame deforme | 60 | 60 |
| 5000 frame deforme | 60 | 50 |
| 10000 frame + colormap | 50 | 30 |
| 1000 shell + stress | 60 | 60 |
| Mod animasyon (5000 frame) | 60 | 60 |
| Time history (10K step, stream) | 60 | 40 |

**Sınır:** 50,000+ frame'de FPS düşer → **Level of Detail (LOD)** gerekir:
- Uzaktan: simplified geometry (frame'leri merge et)
- Yakından: detaylı geometry (full beam mesh)

## 4.7 İmplementasyon yol haritası

### Faz 1 (1-2 hafta) — Temel deforme şekil
- Mevcut `Model3DPreview.vue` üzerine yeni sekme
- Statik bir case için deforme görünüm
- Scale slider
- Renk basit (case adına göre)
- Cubic Hermite interpolasyon (eğri kiriş)

### Faz 2 (1-2 hafta) — Mod animasyonu + colormap
- Mod seçici, otomatik salınım
- Frame'leri |M3| max'a göre renklendir
- Colormap legend bar

### Faz 3 (2-3 hafta) — Time history playback
- Scrubber, play/pause
- Stream-based (chunk loading)
- Deprem ivme grafiği eşzamanlı (alt panel)
- Animation speed control

### Faz 4 (2-3 hafta) — Pushover + advanced
- Hinge formation animasyonu
- Capacity curve grafik
- Drift profili 2D plot
- Reaksiyon vektörleri

### Faz 5 (1-2 hafta) — Polish
- Shell stress contour smoothing
- Multi-case karşılaştırma split-view
- Screenshot/video export
- Touch/gesture optimization (tablet)

**Toplam: 7-12 hafta** tek geliştirici.

## 4.8 İleri özellikler (gelecek)

- **VR/AR mode:** WebXR ile yapıyı 3D mekanda gez (Quest, HoloLens)
- **Cross-section sketch:** Beam'e tıkla → 2D donatı şeması overlay
- **Time-lapse build:** Yapıyı kat kat inşa et animasyonu
- **Real-time collaborative:** Birden fazla kullanıcı aynı modeli görür, cursor paylaşımı
- **AI annotation:** Kritik element'leri AI işaretler ("Bu kolon 1.5× kapasite üzerinde")

## 4.9 Implementation Status

- [ ] Faz 1 — Deforme şekil
- [ ] Faz 2 — Mod animasyon + colormap
- [ ] Faz 3 — Time history playback
- [ ] Faz 4 — Pushover + drift + reaksiyon
- [ ] Faz 5 — Polish + multi-case

## Bağlantılar

- TH/Pushover veri kaynağı: [05-time-history.md](./05-time-history.md), [07-pushover.md](./07-pushover.md)
- Hibrit çalışma (browser-side compute): [03-rust-wasm-hybrid.md](./03-rust-wasm-hybrid.md)
