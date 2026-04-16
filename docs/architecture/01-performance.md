# 01 — Performance Optimizasyon Analizi

> **Konu:** Mevcut analiz pipeline'ının yavaşlığının kök sebebi + 4 farklı optimizasyon stratejisi karşılaştırması + kademeli geçiş planı.

## 1.1 Sorun tespiti

### Şu anki durum (Faz 0, ~Nisan 2026)

Mevcut `services/structural_analysis/` modülü:
- Pure Python + numpy + scipy.sparse
- Linear static + modal + response spectrum + section forces
- Combo'lar tam recompute (lineer süperpoze KULLANILMIYOR)
- `FrameElement3D` dataclass — her case için yeniden inşa edilir
- 12×12 matrix işlemleri Python loop'unda

### Ölçülmüş tipik analiz süresi

300 frame, 90 combo, modal içerikli:
| Aşama | Süre | Optimizasyon potansiyeli |
|---|---|---|
| Parser | 1-3s | Düşük (string parsing) |
| K assembly | 2-5s | Orta (matrix coalescing) |
| Sparse solve (per case) | 0.5-2s × 8 = 16s | Düşük (zaten C-level) |
| Modal eigsh | 5-10s | Düşük (zaten C-level) |
| **Section forces (combo dahil)** | **15-30s** | **Yüksek** |
| Combo expansion (delta) | 5-10s | **Yüksek** (yanlış yöntem) |
| Recovery serialization | 3-8s | Orta (numpy → JSON) |
| Storage upload (gzip) | 5-15s | Düşük (network I/O) |
| Firestore write | 1-3s | Düşük |
| **Toplam** | **~50-90 saniye** | **30-50× hızlandırılabilir** |

## 1.2 Kritik bulgular

### Bulgu 1: Combo'lar tam recompute ediliyor — YANLIŞ
Lineer statik için kombo sonuçları **lineer süperpoze**'dir:
```
U_combo = Σ factor_i × U_base_i
F_combo = Σ factor_i × F_base_i
M_combo = Σ factor_i × M_base_i  ← her case için recompute YERİNE bunu yap
```

90 combo × 200 frame × 5 station = 90,000 hesap. Süperpoze ile **8 case × 200 × 5 = 8000 hesap + 90 zayıf vektör toplama**. **~10× hızlanma**.

### Bulgu 2: FrameElement3D her case için yeniden inşa
`K_local`, `T (transform)`, `length` geometriye/elemana özgü, **case-invariant**. Bunları **frame başına 1 kez** hesapla, cache'le. Sadece `q_eq` ve `u_local` case'e bağlı.

### Bulgu 3: 12×12 matrisleri Python loop'unda
NumPy küçük matris işlemleri için Python overhead **yüksek**. `K @ u` çağrısı 2μs hesap + 8μs Python overhead. 20K çağrı = 200ms overhead, sadece overhead.

**Çözüm:** Tüm frame'leri tek tensor'da:
```python
# (N_frames, 12, 12) × (N_frames, 12) → (N_frames, 12)
f_all = np.einsum('fij,fj->fi', K_all, u_all)
```
Bir tek einsum çağrısı, GPU-style vektörize. **5-10× hızlanma**.

### Bulgu 4: Recovery JSON serialization yavaş
Firestore'a JSON serialize ederken, listemiz dict-of-dicts yapısı. Python json.dumps ~5ms/100KB. Büyük analiz 50MB → 2.5 saniye sadece serialization.

**Çözüm:** Binary format (msgpack ya da Protocol Buffers) → 5× daha hızlı, 3× daha küçük. Ama Firestore JSON ister; bu yüzden Storage offload'a binary format.

## 1.3 Dört optimizasyon stratejisi

### Option A — Algoritmik düzeltme
**Ne:** Yukarıdaki Bulgu 1-2-4'ü Python'da düzelt.
- Combo süperpoze
- K_local + T cache
- Binary serialization Storage'a

**Süre:** 1-2 hafta
**Kazanç:** 5-10× toplam analiz hızı
**Maliyet:** Düşük, sadece refactor
**Riski:** Düşük, mevcut testler korunur

### Option B — Vectorization (NumPy einsum)
**Ne:** Tüm frame'leri tek tensor olarak işle (Bulgu 3).

**Süre:** 1-2 hafta (Option A üstüne)
**Kazanç:** Section forces 30-50× hızlanır (toplam analiz 2-3×)
**Maliyet:** Orta, dataclass → array refactor
**Riski:** Bug riski yüksek, debug zor

### Option C — JIT (Numba)
**Ne:** Hot loop'lara `@njit` decorator.

**Süre:** 1-2 hafta + dataclass refactor (1 hafta)
**Kazanç:** Hot path 50-100× hızlanır (Direct TH için zorunlu)
**Maliyet:**
- Docker image +130MB (llvmlite + numba)
- İlk request 5-10s warmup (LLVM compile)
- numpy version pin (numba ↔ numpy uyumsuzluğu)
- Browser'da çalışmaz (Pyodide-numba olgun değil)
**Riski:** Hibrit mimari hayalini bozar — JIT sadece server'da çalışır.

### Option D — Rust kernel (PyO3 + WASM)
**Ne:** Hot fonksiyonlar Rust'ta yazılır, hem server (PyO3) hem browser (wasm-pack) tarafından çağırılır.

**Süre:** 4-6 hafta (Rust öğrenme + setup + ilk kernel'ler)
**Kazanç:**
- Server'da Numba'dan da hızlı (50-100×, AOT compiled)
- Browser'da native speed (sadece Pyodide pure Python ~5× yavaş)
- **Tek truth-source** — algoritma bir yerde, iki runtime'da çalışır
**Maliyet:**
- Build pipeline: cargo + maturin + wasm-pack
- Multi-arch için CI/CD karmaşıklaşır
- Rust öğrenme süresi 1 ay
**Riski:** Yüksek upfront yatırım, ama sonsuza kadar getiri

## 1.4 Kararlar

### Final karar: **Kademeli A → D**

```
Faz 1 (şimdi, 1-2 hafta):
  Option A — Algoritmik optimizasyon
    ✓ Combo süperpoze
    ✓ K_local + T cache
    ✓ 3 station default (5 yerine)
    ✓ Binary storage offload (msgpack)
  
  + REFACTOR — Hot loop'ları Rust-friendly yaz
    ✓ Dataclass yerine pure numpy array
    ✓ Function-pure (no side effects)
    ✓ Tek tip (float64 sabit)
    ✓ Hot path'te dict lookup yok (preprocessed array index)

Faz 2 (TH/Pushover öncesi, 4-6 hafta):
  Option D — Rust kernel'ler  
    ✓ frame_local_stiffness (Rust)
    ✓ assemble_global (Rust)
    ✓ section_forces (Rust)
    ✓ newmark_step (Rust — TH için)
    ✓ PyO3 binding → server
    ✓ wasm-pack → browser
```

### Neden Option C (Numba) atlandı?

Hibrit mimari hedefiyle çelişir. Detay: [03-rust-wasm-hybrid.md](./03-rust-wasm-hybrid.md)

Kısaca:
- Numba browser'da çalışmaz → "lite analyzer in browser" hayali patlar
- Aynı çabayı Rust'a yatırmak iki runtime kazandırır
- Numba'nın tek avantajı (kolay setup) Rust pipeline kurulduktan sonra anlamsız

## 1.5 Refactor checklist (Faz 1)

Bu checklist Faz 1 sırasında uygulanırsa Faz 2 (Rust geçişi) **2 hafta** süresine düşer.

### Hot path identification
Her hot loop için bir flag koy: `# RUST_KERNEL_CANDIDATE`

```python
# RUST_KERNEL_CANDIDATE
def compute_local_stiffness_3d(E, A, Iy, Iz, J, L, omega):
    """12×12 K_local for frame element."""
    ...
```

### Pure function rule
Hot loop'lar **pure** olmalı (input → output, no side effects, no global state):

```python
# YANLIŞ (mevcut)
class FrameElement3D:
    def local_stiffness(self):
        E = self.material.E
        ...

# DOĞRU (Rust-ready)
def local_stiffness_3d(E: float, A: float, Iy: float, Iz: float,
                      J: float, L: float, omega: float) -> np.ndarray:
    ...
```

### Numpy-array-first
Dataclass ya da dict yerine **typed numpy array**'ler:

```python
# YANLIŞ
nodes: dict[int, NodeDTO]

# DOĞRU (Rust-ready)
node_coords: np.ndarray   # (N_nodes, 3) float64
node_id_to_idx: dict[int, int]   # sadece preprocessing'te kullan
```

### Tek precision
Hot path'te **tek tip kullan**: `float64` ya da `float32`. Karışık tip Rust'ta sorun yaratır.

### No exceptions in hot path
Try/except hot loop'ta yavaş + Rust'a port zor. Hatayı caller'a delege et.

```python
# YANLIŞ
def compute_forces(K, u):
    try:
        return K @ u
    except LinAlgError:
        return None

# DOĞRU
def compute_forces(K, u):
    return K @ u   # caller'da catch et
```

## 1.6 Beklenen sonuçlar

| Aşama | Şimdi | Faz 1 (Option A) | Faz 2 (Option D) |
|---|---|---|---|
| Lineer static + modal + section forces | 60s | 8-12s | 1-2s |
| Direct TH (10K step, 1K DOF) | uygulanamaz | uygulanamaz | 30-60s |
| Pushover (500 step) | uygulanamaz | uygulanamaz | 60-90s |

## 1.7 Implementation Status

- [x] Faz 1: Algoritmik optimizasyon
  - [x] Combo süperpoze (zaten pipeline `_combine`'de yapılıyor — U/P/q lineer birleştiriliyor)
  - [x] K_local cache (`elements/frame_kernel.py` — K_local + K_local_released + T + TE + sw_w frame başına 1×)
  - [x] Station count default 3 (`recovery/element_forces.py` `n_stations=3`)
  - [x] Binary serialization (msgpack) — `storage_service.upload_msgpack_gzip`, yeni kayıtlar `.mpack.gz`, eski `.json.gz` geriye uyumlu
- [x] Faz 1: Rust-friendly refactor
  - [x] Hot path identification (`# RUST_KERNEL_CANDIDATE` işaretleri: frame_3d, load_assembler, element_forces hot kernel'leri)
  - [x] Pure function conversion (`frame_local_stiffness`, `frame_element_axes_transform`, `node_euler_transform`, `frame_local_to_global_transform`, `direction_cosines`, `condense_released_dofs`, `_local_load_vector`, `_distributed_to_local_q_pure`, `_self_weight_local_q_pure`)
  - [ ] numpy-array-first conversion (dataclass→ndarray bulk refactor — Faz 2'de Rust port'la birlikte)
- [ ] Faz 2: Rust kernel'ler
  - [ ] Build pipeline (cargo + maturin + wasm-pack)
  - [ ] frame_local_stiffness
  - [ ] section_forces
  - [ ] PyO3 binding
  - [ ] wasm-pack browser export

## Bağlantılar

- Hibrit mimari: [03-rust-wasm-hybrid.md](./03-rust-wasm-hybrid.md)
- Time History (Rust kernel'leri kullanır): [05-time-history.md](./05-time-history.md)
- Pushover (Rust kernel'leri kullanır): [07-pushover.md](./07-pushover.md)
