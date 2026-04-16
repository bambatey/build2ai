# Build2AI — Mimari Yol Haritası

Bu klasör, Build2AI'ın **uzun vadeli mimari kararlarını ve teknik araştırma notlarını** barındırır.

> **Bağlam:** Bu dokümanlar, projenin Faz 1 (Python pipeline + lineer statik) sonrasında "her şeyi sapasağlam başından planlayalım" kararıyla yapılmış araştırma ve tasarım notlarıdır. Henüz uygulanmamış kararlar yer alır; kod yazımı bu rehbere göre kademeli ilerleyecektir.

## Doküman İndeksi

> **Not:** Dosya numaraları organizasyon içindir, **implementasyon sırasını göstermez**. Önerilen başlama sırasını ayrı kolonda işaretledik.

| # | Başlık | Başlama sırası | Faz | Özet karar |
|---|---|---|---|---|
| [00](./00-overview.md) | **Genel mimari özeti + karar matrisi** | — | — | Tüm kararların özeti, tek bakışta görmek için |
| [01](./01-performance.md) | **Performance optimizasyon analizi** | **1️⃣ İlk** | Faz 1 | Algoritmik (Option A) → JIT (Option B/C) → Rust (Option D) — kademeli geçiş |
| [02](./02-scaling-arq-redis.md) | **Async iş kuyruğu (heavy fallback)** | 4️⃣ | Faz 2 | **arq + Redis** seçildi (RabbitMQ + Celery alternatifi de korunur) |
| [03](./03-rust-wasm-hybrid.md) | **Rust+WASM hibrit mimari** | **2️⃣** | Faz 2-3 | Hot kernel'ler Rust → server (PyO3) + browser (WASM). Tek truth-source. |
| [04](./04-shader-visualization.md) | **3D analiz görselleştirme** | 3️⃣ | Faz 2 | three.js + custom GLSL shader'lar |
| [05](./05-time-history.md) | **Time History analizi algoritması** | 5️⃣ (07 ile paralel) | Faz 3 | Modal Superposition + Direct Integration (Newmark/HHT-α) |
| [06](./06-cad-export.md) | **DXF/AutoCAD export (sta4cad-style)** | 6️⃣ Son | Faz 3-4 | ezdxf + reinforcement design engine |
| [07](./07-pushover.md) | **Pushover analizi algoritması** | 5️⃣ (05 ile paralel) | Faz 3 | Displacement-controlled + plastik mafsal + TBDY 2018 |

### Sıralama gerekçesi

| Sıra | Topic | Neden bu zaman |
|---|---|---|
| **1️⃣** | 01 — Performance | Şu anki aktif sorunu çözer, momentum + güven verir |
| **2️⃣** | 03 — Rust+WASM | Sonraki tüm performance kazançlarının altyapısı; öğrenme süresi paralel ilerler |
| **3️⃣** | 04 — Shader viz | Kullanıcı deneyimi farkı, satış argümanı; algoritma değişimlerinden bağımsız |
| **4️⃣** | 02 — arq + Redis | TH/Pushover olmadan queue ihtiyacı yok; sync request yeter |
| **5️⃣** | 05 + 07 birlikte | Mafsal modeli + time integrators ortak; ayrı yazmak kod tekrarı |
| **6️⃣** | 06 — DXF + reinforcement | En uzun (12-16 hafta) + en yüksek risk (TBDY validation); önceki her şey hazır olunca |

## Karar İcmali

### Mimari sütunlar
1. **İnce server, zengin client** → kullanıcının PC'si %70-80 hesap yapar
2. **Rust+WASM hot kernel'ler** → tek truth-source, hem server (PyO3) hem browser (WASM)
3. **arq + Redis** → heavy fallback için async kuyruk
4. **Firebase managed services** → persistence, auth, storage
5. **three.js + custom shader** → 3D görselleştirme

### Server kapasite hedefi
- **Şimdi:** Hetzner CPX31 (8GB / 4 vCPU) — €10/ay
- **Production (TH/Pushover dahil):** Hetzner CPX41 (16GB / 8 vCPU) — €18/ay
- 10,000 kullanıcıya kadar tek sunucu yeter (iş browser'da)

### Tahmini geliştirme süresi (tek dev)
| Faz | Modül | Süre |
|---|---|---|
| 1 | Algoritmik optimizasyon | 1-2 hafta |
| 2 | arq + Redis altyapı | 1 hafta |
| 2 | Rust+WASM hibrit (ilk kernel'ler) | 4-6 hafta |
| 2 | Shader-based 3D viz | 6-10 hafta |
| 3 | Time History (Modal + Direct) | 8-11 hafta |
| 3 | Pushover | 8-10 hafta |
| 4 | DXF + Reinforcement design | 13-16 hafta |
| | **Toplam** | **~50-60 hafta (~12-15 ay)** |

## Doküman okuma sırası önerileri

**Yöneticilik / business kararları için:**
- 00 → 06 → README özeti

**Backend geliştirici için:**
- 00 → 01 → 02 → 03 → 05 → 07

**Frontend geliştirici için:**
- 00 → 03 → 04 → 06

**Mühendis (algoritmik detay) için:**
- 05 → 07 → 01

## Bu klasör nasıl güncellenmeli?

- Bir karar değiştiğinde **ilgili topic dosyasını** ve **bu README'deki karar matrisini** güncelle
- Yeni bir araştırma yapıldığında numaralandırılmış yeni dosya ekle (örn. `08-monitoring.md`)
- Implementasyon başlandığında her topic'in altına "Implementation Status" bölümü ekle
- Tüm önemli karar değişimleri commit message'larda belirtilsin

## Bağlantılı dış kaynaklar

- [METHOD.md](../../../sonlu-elemanlar-analizi/METHOD.md) — FEM matematiği
- [PROJ.md](../../../sonlu-elemanlar-analizi/PROJ.md) — proje vizyon notları
- [build2aiapi/README.md](../../../build2aiapi/README.md) — backend pipeline durumu

---

01 ilk → mevcut yavaşlık şikâyetini çözer, momentum verir
03 ikinci → Rust pipeline kurulumu sonraki tüm performance kazançlarının kapısı; ayrıca öğrenme süresi paralel ilerler
04 üçüncü → görsel ürün kullanıcıyı etkiler, satış argümanı; algoritma değişikliklerinden bağımsız ilerleyebilir
02 dördüncü → queue/worker'a TH/Pushover olmadan ihtiyaç yok; o zamana kadar sync request yeter
05 + 07 birlikte → mafsal kütüphanesi, time integrators ortak; tek seferde yazmak kod tekrarı önler
06 son → en uzun + en risk yüksek (TBDY validation kritik); önceki her şey hazır olduğunda yapılmalı

*Son güncelleme: 2026-04-16 (mimari plan oturumu)*
