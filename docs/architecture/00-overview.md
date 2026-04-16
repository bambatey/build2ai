# 00 — Genel Mimari Özeti

> **Bu dosya:** Tüm topic'lerin tek bakışta görüldüğü kompakt referans. Detay için her topic'in kendi dosyasına git.

## Hedef Mimarinin Şekli

```
┌─────────────────────────────────────────────────────────────┐
│ KULLANICI TARAYICISI (Mac/Win/Linux)                        │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Vue 3 / Nuxt UI                                         │ │
│ │  - Dashboard, workspace, analiz sayfası                 │ │
│ │  - Chat popup (DSPy backend ile)                        │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Three.js + Custom GLSL Shaders                          │ │
│ │  - Deformed shape, mode shapes                          │ │
│ │  - Time history playback, color contours                │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Rust → WASM Hot Kernels                                 │ │
│ │  - K_local assembly (frame, shell)                      │ │
│ │  - Section forces, recovery                             │ │
│ │  - Newmark step, modal SDOF                             │ │
│ │  - Linear/modal analiz: %90 kullanım browser'da         │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Pyodide (orchestration) + ezdxf                         │ │
│ │  - Generator/editor (rc_frame, add_stories)             │ │
│ │  - DXF üretimi (CAD export)                             │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (10-100KB/req tipik)
                       │ WebSocket (heavy job progress)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ HETZNER CPX41 (16GB / 8 vCPU) — €18/ay                      │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ FastAPI (Python) + uvicorn x2                           │ │
│ │  - AI chat orchestration (DSPy)                         │ │
│ │  - Persistence API (Firestore wrapper)                  │ │
│ │  - Heavy fallback dispatch                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ arq Worker (Python async)                               │ │
│ │  - TH/Pushover heavy jobs (Rust kernel via PyO3)        │ │
│ │  - Çok büyük static (>50K DOF)                          │ │
│ │  - Progress → Redis pubsub → WebSocket                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│ │ Redis        │  │ Nginx        │  │ Rust kernel .so  │   │
│ │ broker+queue │  │ reverse proxy│  │ (PyO3 Python ext)│   │
│ └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ FIREBASE (Managed Services)                                 │
│  - Firestore: model meta + analiz index                     │
│  - Storage: .s2k dosyaları + analiz blobları (gzip)         │
│  - Auth: kullanıcı kimliği                                  │
└─────────────────────────────────────────────────────────────┘
```

## Kararlar — tek bakışta

### Performance & Scaling
| Karar | Neden |
|---|---|
| Rust+WASM (Yol C) | Tek truth-source; browser native speed; serverless ölçek |
| arq + Redis | FastAPI async ile uyumlu, hafif (50-100MB worker) |
| Hetzner CPX41 (€18/ay) | 16GB heavy job + AI + persistence için bol |
| ❌ RabbitMQ | Aşırı (500MB+ overhead, single-tenant'a gereksiz) |
| ❌ Numba JIT | Browser'da çalışmaz, hibrit hayal değil olur |
| ❌ Cython | Build pipeline karmaşık, Rust ile aynı maliyet ama az fayda |

### Frontend
| Karar | Neden |
|---|---|
| Vue 3 / Nuxt | Mevcut kod tabanı, Vue ekosistem güçlü |
| three.js + GLSL | En olgun WebGL, custom shader ile sınırsız özelleştirme |
| Pyodide | Browser'da Python çalıştırma — DXF üretimi, AI orchestration |
| Rust → wasm-pack | Tek dilden hem server hem browser hot kernel |

### Backend
| Karar | Neden |
|---|---|
| FastAPI + Pydantic | Async-native, type-safe, OpenAPI |
| DSPy (LLM orchestration) | Structured output + intent classification |
| Firebase managed | Auth + Firestore + Storage; ops yükü minimum |
| PyO3 (Rust → Python bind) | Hot kernel'ler hem server hem browser'da aynı kod |

### Algoritma seçimleri
| Analiz | Yöntem | Neden |
|---|---|---|
| Lineer statik | Sparse direct (scipy zaten) | Olgun, Rust kernel'lerle hızlandır |
| Modal | scipy.sparse.linalg.eigsh | Standart shift-invert |
| Modal Time History | SDOF Newmark (her mod) | Embarrassingly parallel, çok hızlı |
| Direct Time History | Newmark-β (β=¼, γ=½) ya da HHT-α | Unconditionally stable, sönüm dostu |
| Pushover | Displacement-controlled + plastik mafsal | TBDY 2018 §15.B uyumlu |
| Damping | Rayleigh (C = α₀M + α₁K) | Standart, kalibrasyon basit |
| Reinforcement design | TS 500 + TBDY 2018 §7.4, §7.3 | Türkiye standardı zorunlu |

## Kritik Geçiş Noktaları (mile stones)

```
SHIMDI ─────► Faz 1 (1-2 ay)
             ─ Algoritmik optimizasyon (kesit tesirleri 30× hızlanır)
             ─ Combo süperpoze, K cache
             ─ Pure Python kalır
             ─ Hot loop'lar "Rust-ready" yazımına çevrilir

Faz 1 ─────► Faz 2 (3-4 ay)
             ─ İlk Rust kernel'ler (frame stiffness, section forces)  
             ─ PyO3 binding → server side
             ─ wasm-pack → browser side
             ─ arq + Redis altyapısı kurulur
             ─ Shader-based 3D viz başlar
             ─ Hetzner CPX41'e upgrade

Faz 2 ─────► Faz 3 (3-4 ay)
             ─ Time History (Modal + Direct, lineer)
             ─ Pushover engine + TBDY 2018 mafsal kütüphanesi
             ─ Heavy fallback worker'ı çalışmaya başlar
             ─ Browser-side TH/Pushover (orta model)

Faz 3 ─────► Faz 4 (3-4 ay)
             ─ Reinforcement design engine (TS 500 + TBDY)
             ─ DXF export (kat planları + detaylar)
             ─ Sta4cad-rakibi tam ürün
             ─ IFC export (BIM uyumluluk)
```

## Maliyet Özeti

### Geliştirme
- 1 senior dev × 12-15 ay = ~$60-100K (kontrat) ya da kurucunun zamanı
- 1 referans mühendis (validation, danışman) = ~$5-10K

### Aylık operating
| Hizmet | Maliyet |
|---|---|
| Hetzner CPX41 | €18 |
| Firebase (Spark, ilk 5K user) | €0 |
| Firebase (Blaze, sonraki) | ~€10-50 |
| Replicate / OpenRouter (LLM) | ~€20-100 (kullanıma göre) |
| CDN / domain | €5-10 |
| **Toplam başlangıç** | **~€50-100/ay** |
| **Toplam scale** | **~€200-500/ay** |

### Birim ekonomi
- 1000 kullanıcı, ortalama 10 analiz/ay = 10K analiz
- Server CPU başına maliyet: ~€0.0005 (browser yapıyor!)
- Maliyet/kullanıcı: ~€0.05/ay
- Sürdürülebilir: kullanıcı başına €1/ay aldığında 20× margin

## Riskler ve Mitigasyonlar

| Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|
| Rust öğrenme süresi 1 ay'dan uzun | Orta | Yüksek | Faz 1'de pure Python ile prove the algorithm; Rust paralelinde öğren |
| WASM bundle çok büyük (>5MB) | Düşük | Orta | Lazy load + code splitting; sadece açık modülü yükle |
| Browser memory tavanı (büyük model) | Yüksek | Orta | Auto-detect → server fallback'e route et |
| TBDY 2018 mafsal hesabı yanlış | Orta | Çok yüksek | Senior CE engineer review + sta4cad ile cross-check |
| LLM hallucination (yanlış parametre) | Orta | Düşük | DSPy structured output + validator; param dışı isim → reddet |
| Firebase vendor lock-in | Düşük | Düşük | Repository pattern; gerekince başka backend'e geçilebilir |

## Topic Detay Bağlantıları

- [01 — Performance optimizasyon](./01-performance.md)
- [02 — Async kuyruk + worker (arq+Redis)](./02-scaling-arq-redis.md)
- [03 — Rust+WASM hibrit](./03-rust-wasm-hybrid.md)
- [04 — Shader 3D viz](./04-shader-visualization.md)
- [05 — Time History](./05-time-history.md)
- [06 — DXF/AutoCAD export](./06-cad-export.md)
- [07 — Pushover](./07-pushover.md)
