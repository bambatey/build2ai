# 03 — Rust + WASM Hibrit Mimari

> **Konu:** Build2AI'ın **uzun vadeli temel mimari kararı** — hot kernel'ler Rust'ta yazılıp hem server (PyO3 binding) hem browser (WASM) tarafından kullanılır. Tek truth-source, native speed her iki tarafta.

> **Bu dosya kritik. Diğer tüm topic'ler buna referans verir.**

## 3.1 Karar verme süreci özeti

3 alternatif tartışıldı:
1. **Numba JIT (server-only)**
2. **Pyodide (browser pure Python, JIT yok)**
3. **Rust + WASM (her iki dünyada native)**

### Neden Numba (server-only) reddedildi
- Browser'da çalışmaz → "lite analyzer in browser" hayali patlar
- Hibrit mimari sahte olur (server + zayıf browser)
- Sürekli server CPU sende, free tier maliyetli
- TH/Pushover sadece server'da, RabbitMQ + worker farm zorunlu

### Neden Pyodide (pure Python) yetersiz
- Pyodide JIT yok, CPython'dan ~3-5× yavaş
- TH 1 dakikalık iş 5 dakika sürer, kullanıcı tab kapatır
- Pushover, büyük modal hiç çalışmaz

### Neden Rust + WASM seçildi
- ✅ **Server'da native speed** (PyO3 binding, Cython'dan hızlı)
- ✅ **Browser'da native speed** (WASM SIMD, JS'den 10-50× hızlı)
- ✅ **Tek truth-source** — algoritma bir yerde yazılır, iki runtime'da çalışır
- ✅ **Memory-safe** — buffer overflow, segfault yok (C/C++ aksine)
- ✅ **Modern toolchain** (cargo, well-documented)
- ⚠️ Maliyet: 1 ay Rust öğrenme + 1 ay setup
- ⚠️ Build pipeline karmaşık (cargo + maturin + wasm-pack)

## 3.2 Mimari görsel

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   src/                                                   │
│   ├── kernels/   ◄── RUST KAYNAK KODU (tek truth-source) │
│   │   ├── frame_3d.rs        (frame stiffness)           │
│   │   ├── shell_q4.rs        (shell stiffness)           │
│   │   ├── assembly.rs        (global K assembly)         │
│   │   ├── solver.rs          (sparse solve wrapper)      │
│   │   ├── recovery.rs        (section forces)            │
│   │   ├── newmark.rs         (TH integration step)       │
│   │   ├── pushover.rs        (hinge state machine)       │
│   │   └── lib.rs             (PyO3 + wasm-bindgen exports)│
│   │                                                      │
│   ├── Cargo.toml                                         │
│   └── ...                                                │
│                                                          │
└──────────────────────────────────────────────────────────┘
                  │                              │
        ┌─────────┴─────────┐          ┌─────────┴─────────┐
        │                   │          │                   │
        ▼                   ▼          ▼                   ▼
   cargo build          maturin build          wasm-pack build
   (native .so)         (Python wheel)         (WASM module)
        │                   │          │                   │
        │                   │          │                   │
        ▼                   ▼          ▼                   ▼
┌─────────────────────┐         ┌─────────────────────────┐
│  SERVER (Python)    │         │  BROWSER (TS + Pyodide) │
│                     │         │                         │
│  from build2ai_kernels    │   import init, * from       │
│       import (             │       'build2ai-wasm'       │
│         frame_stiffness,   │                             │
│         section_forces,    │   await init()              │
│         newmark_step,     │   const K = frame_stiffness(│
│       )                   │     E, A, Iy, Iz, J, L,     │
│                            │     omega                   │
│  K = frame_stiffness(...)  │   )                         │
│  forces = ...              │                             │
└─────────────────────┘         └─────────────────────────┘
```

## 3.3 Hangi fonksiyonlar Rust'a gider?

### Tier 1 — Mutlaka (Faz 2)
| Fonksiyon | Çağrı sayısı | Rust kazanç |
|---|---|---|
| `frame_local_stiffness` | per frame, per case | 100× |
| `assemble_global_stiffness` | per case | 30× |
| `solve_sparse_partitioned` | per case | 5-10× (zaten C) |
| `compute_section_forces_per_station` | per frame × case × station | 100× |

### Tier 2 — TH/Pushover gelince (Faz 3)
| Fonksiyon | Çağrı sayısı | Rust kazanç |
|---|---|---|
| `newmark_beta_step` | per time step (10K+) | 100× |
| `hht_alpha_step` | per time step | 100× |
| `modal_sdof_integrate` | per mode × per step | 50× |
| `pushover_hinge_check` | per hinge × per step | 50× |
| `update_K_with_yielded_hinges` | per state change | 30× |

### Tier 3 — Şimdilik Python kalır (Faz 1+2)
| Fonksiyon | Neden Python |
|---|---|
| `parse_s2k` | String parsing, I/O bound |
| `validate_model` | Mantık ağırlıklı |
| `serialize_to_json` | Python json zaten C |
| `firestore_write` | I/O |
| `dspy_intent_classify` | LLM call |

## 3.4 Build pipeline

### Klasör yapısı
```
build2ai-kernels/
├── Cargo.toml                    # Rust paket tanımı
├── pyproject.toml                # Python wheel build (maturin)
├── src/
│   ├── lib.rs                    # PyO3 + wasm-bindgen exports
│   ├── frame_3d.rs               # Pure Rust algoritma
│   ├── ...
├── tests/                        # Rust unit tests
├── benches/                      # Criterion benchmarks
├── pkg/                          # wasm-pack output (browser)
└── target/                       # cargo build output
```

### Cargo.toml örneği
```toml
[package]
name = "build2ai-kernels"
version = "0.1.0"
edition = "2021"

[lib]
name = "build2ai_kernels"
crate-type = ["cdylib", "rlib"]

[dependencies]
ndarray = "0.15"
nalgebra = "0.32"
sprs = "0.11"        # sparse matrix
faer = "0.16"        # modern dense linalg

# PyO3 (Python binding) — sadece server build'inde
pyo3 = { version = "0.21", features = ["extension-module"], optional = true }
numpy = { version = "0.21", optional = true }

# wasm-bindgen — sadece browser build'inde
wasm-bindgen = { version = "0.2", optional = true }
js-sys = { version = "0.3", optional = true }

[features]
default = []
python = ["pyo3", "numpy"]
wasm = ["wasm-bindgen", "js-sys"]

[profile.release]
opt-level = 3
lto = true            # link-time optimization
codegen-units = 1     # tek-unit aggressive opt
```

### Build commands
```bash
# Server (Python wheel)
maturin develop --release --features python
# → backend Python projesinden:
#   from build2ai_kernels import frame_local_stiffness

# Browser (WASM)
wasm-pack build --target web --release --features wasm -- --no-default-features
# → frontend'den:
#   import init, { frame_local_stiffness } from './pkg/build2ai_kernels'
```

### CI/CD — multi-platform
```yaml
# .github/workflows/release.yml
jobs:
  build-python-wheels:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        python-version: [3.11, 3.12, 3.13]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: PyO3/maturin-action@v1
        with:
          args: --release --features python
  
  build-wasm:
    runs-on: ubuntu-latest
    steps:
      - uses: jetli/wasm-pack-action@v0.4.0
      - run: wasm-pack build --target web --release --features wasm
      - uses: actions/upload-artifact@v3
        with:
          name: wasm-package
          path: pkg/
```

## 3.5 PyO3 binding örneği

```rust
// src/lib.rs
use pyo3::prelude::*;
use numpy::{PyArray2, IntoPyArray, PyReadonlyArray1};

#[pyfunction]
fn frame_local_stiffness<'py>(
    py: Python<'py>,
    e: f64,
    a: f64,
    iy: f64,
    iz: f64,
    j: f64,
    iyz: f64,
    length: f64,
) -> &'py PyArray2<f64> {
    let k = frame_3d::compute_local_stiffness(e, a, iy, iz, j, iyz, length);
    k.into_pyarray(py)
}

#[pyfunction]
fn section_forces_batch<'py>(
    py: Python<'py>,
    f_local: PyReadonlyArray1<f64>,    // (12,)
    q: PyReadonlyArray1<f64>,           // (6,)
    length: f64,
    n_stations: usize,
) -> &'py PyArray2<f64> {
    let stations = recovery::compute_stations(
        f_local.as_slice().unwrap(),
        q.as_slice().unwrap(),
        length,
        n_stations,
    );
    stations.into_pyarray(py)
}

#[pymodule]
fn build2ai_kernels(_py: Python, m: &PyModule) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(frame_local_stiffness, m)?)?;
    m.add_function(wrap_pyfunction!(section_forces_batch, m)?)?;
    Ok(())
}
```

Python tarafında kullanım:
```python
import numpy as np
from build2ai_kernels import frame_local_stiffness, section_forces_batch

K = frame_local_stiffness(E=30e6, A=0.16, Iy=2.13e-3, Iz=2.13e-3,
                          J=0.4e-3, Iyz=0, length=3.0)
# K is np.ndarray (12, 12), zero-copy from Rust

stations = section_forces_batch(f_local, q, length=6.0, n_stations=5)
# stations is np.ndarray (5, 6) — x, P, V2, V3, T, M2, M3
```

## 3.6 wasm-bindgen örneği

```rust
// src/lib.rs (cont.)
use wasm_bindgen::prelude::*;
use js_sys::Float64Array;

#[wasm_bindgen]
pub fn frame_local_stiffness_wasm(
    e: f64, a: f64, iy: f64, iz: f64, j: f64, iyz: f64, length: f64,
) -> Float64Array {
    let k = frame_3d::compute_local_stiffness(e, a, iy, iz, j, iyz, length);
    let flat: Vec<f64> = k.into_iter().collect();
    let array = Float64Array::new_with_length(144);
    array.copy_from(&flat);
    array
}
```

Frontend tarafında kullanım:
```typescript
import init, { frame_local_stiffness_wasm } from 'build2ai-wasm/build2ai_kernels'

await init()  // WASM modülünü yükle (~500KB)

const k = frame_local_stiffness_wasm(
  30e6, 0.16, 2.13e-3, 2.13e-3, 0.4e-3, 0, 3.0
)
// k is Float64Array (144,) — reshape to (12, 12) ile kullan
```

## 3.7 Hibrit dispatch — frontend tarafı

Frontend "küçük model browser, büyük model server" mantığını handle eder:

```typescript
// app/composables/useAnalysis.ts
const COMPLEXITY_THRESHOLD = 5000  // DOF

async function runAnalysis(model: ModelDTO, type: AnalysisType) {
  const complexity = estimateComplexity(model, type)
  
  if (complexity < COMPLEXITY_THRESHOLD) {
    // Browser-side
    return await runInBrowser(model, type)
  } else {
    // Server-side via queue
    const job = await api.submitHeavyJob(model.fileId, type)
    return await pollOrStream(job.jobId)
  }
}

async function runInBrowser(model: ModelDTO, type: AnalysisType) {
  const wasm = await import('build2ai-wasm')
  await wasm.init()
  
  // Tüm pipeline browser'da
  const K = wasm.assemble_global_stiffness(model)
  const U = wasm.solve_sparse(K, F)
  const forces = wasm.compute_section_forces(U, model)
  
  return { U, forces }
}
```

## 3.8 Memory ortaklığı (zero-copy)

PyO3 ve wasm-bindgen **zero-copy** array geçirebilir:
- Rust → Python: `IntoPyArray` shared memory pointer
- Rust → JS: `Float64Array.copy_from` minimum copy
- Python → Rust: `PyReadonlyArray` shared

Bu çok önemli: 100MB array'i kopyalamadan göndermek **0ms vs 100ms** farkı.

## 3.9 Test stratejisi

### Rust unit tests
```rust
// src/frame_3d.rs
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn frame_stiffness_matches_sea_book_golden() {
        let k = compute_local_stiffness(30e6, 0.16, 2.13e-3, 2.13e-3, 0.4e-3, 0.0, 3.0);
        let golden = load_golden_json("frame3d_golden.json");
        assert_close(k, golden, tol=1e-9);
    }
}
```

### Python characterization tests
```python
def test_pyo3_binding_matches_pure_python():
    """Rust binding ile pure Python implementasyonu aynı sonuç vermeli."""
    args = (30e6, 0.16, 2.13e-3, 2.13e-3, 0.4e-3, 0, 3.0)
    
    k_python = pure_python_local_stiffness(*args)
    k_rust = build2ai_kernels.frame_local_stiffness(*args)
    
    np.testing.assert_allclose(k_python, k_rust, rtol=1e-12)
```

### Browser integration tests
- Playwright ile WASM yüklenir, küçük model çalışır, sonuç assert edilir

## 3.10 Performans tahminleri

### Frame stiffness (12×12 matris)
| Implementation | Süre |
|---|---|
| Pure Python | ~10μs |
| Numpy einsum | ~5μs |
| Numba @njit | ~0.2μs (warmup sonrası) |
| Rust (PyO3) | ~0.1μs |
| Rust (WASM) | ~0.15μs |

### Section forces 200 frame × 90 case × 5 station
| Implementation | Süre |
|---|---|
| Mevcut (Pure Python) | ~30s |
| Algoritmik düzeltme (Option A) | ~5s |
| Rust kernel + algoritmik | ~0.3s |

### Direct Time History (10K step, 5K DOF)
| Implementation | Süre |
|---|---|
| Pure Python | ~30 dk (uygulanamaz) |
| Numba | ~3 dk |
| Rust (server) | ~30 sn |
| Rust (WASM, browser) | ~45 sn |

## 3.11 Risk + mitigasyon

| Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|
| Rust öğrenme süresi 1 ay'dan uzun | Orta | Yüksek | Faz 1'de pure Python ile algoritmayı kanıtla; Rust paralelinde öğren; Rustlings.io interaktif |
| WASM bundle çok büyük (>5MB) | Düşük | Orta | wasm-opt sıkıştırma, code splitting (sadece açık modülü yükle) |
| PyO3 ABI uyumsuzluk | Düşük | Yüksek | Pin Python version (3.12), CI'da test |
| Multi-arch wheel build (M1 + x86) | Orta | Düşük | maturin-action GitHub Actions hazır |
| Hot kernel API değişimi → her iki taraf etkilenir | Yüksek | Orta | Versiyon kontrol, semver, breaking changes review |
| Rust panic → Python segfault | Düşük | Yüksek | `panic = "abort"` yerine `panic = "unwind"`; PyO3 panic catch |

## 3.12 Aşamalı geçiş

### Adım 1 (4-6 hafta): Pilot kernel
- En basit fonksiyon: `frame_local_stiffness`
- Cargo + maturin + wasm-pack pipeline kurulumu
- PyO3 binding + Python tarafında çağrı
- Characterization test
- **Başarı kriteri:** mevcut Python implementasyonu ile bit-for-bit uyumlu

### Adım 2 (3-4 hafta): Tier 1 kernel'ler
- `assemble_global_stiffness` (sparse coo format)
- `compute_section_forces_per_station`
- Mevcut Python pipeline'ı kademeli olarak Rust'a yönlendir
- Hibrit: bazı kısımlar Rust, bazıları Python

### Adım 3 (2-3 hafta): WASM browser entegrasyonu
- Frontend'e WASM bundle entegre
- Küçük model için browser-side dispatch
- Backend fallback (büyük model)

### Adım 4 (TH gelince, 4-6 hafta): Tier 2 kernel'ler
- `newmark_beta_step`
- Modal SDOF integration
- Pushover hinge check

### Adım 5 (production hardening, 2-3 hafta)
- Error handling (Rust panic → Python exception)
- Memory profiling
- Bench suite + regression tests
- Documentation

**Toplam: 15-22 hafta** Rust pipeline tamamlama. TH/Pushover algoritmalarıyla paralel.

## 3.13 Rust öğrenme yol haritası (paralel)

| Hafta | Konu | Kaynak |
|---|---|---|
| 1 | Temel sözdizimi, ownership | Rustlings.io |
| 2 | Trait, generic, error handling | Rust Book ch 1-9 |
| 3 | Lifetime, borrow checker | Rust Book ch 10 + LifetimeKata |
| 4 | numpy/ndarray Rust ekosistemi | ndarray docs + faer |
| 5 | PyO3 entegrasyonu | PyO3 user guide |
| 6 | wasm-bindgen | wasm-pack book |

Paralel olarak Faz 2 başlangıcında üretken olunur.

## 3.14 Implementation Status

- [ ] Rust workspace setup (Cargo.toml + maturin + wasm-pack)
- [ ] Pilot kernel: `frame_local_stiffness`
- [ ] PyO3 binding + Python characterization test
- [ ] CI/CD multi-platform wheel build
- [ ] Tier 1 kernel'ler (assembly, section forces)
- [ ] WASM build + frontend bundle
- [ ] Browser-side dispatch logic
- [ ] Tier 2 kernel'ler (newmark, pushover)
- [ ] Production hardening (panic handling, profiling)

## Bağlantılar

- Hot kernel detayları: [01-performance.md](./01-performance.md)
- TH algoritması (Rust kullanır): [05-time-history.md](./05-time-history.md)
- Pushover algoritması (Rust kullanır): [07-pushover.md](./07-pushover.md)
- Server kapasite (Rust ile düşürülmüş): [00-overview.md](./00-overview.md)
