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




- [ ] Faz 2: Rust kernel'ler
  - [ ] Build pipeline (cargo + maturin + wasm-pack)
  - [ ] frame_local_stiffness
  - [ ] section_forces
  - [ ] PyO3 binding
  - [ ] wasm-pack browser export

bunları yapmadık di mi daha yani hala 01-performance.md yi btiirmeye çalışıcaz snra da 03'e geçicez
Düzelteyim — aslında o iki checklist aynı işi anlatıyor, farklı perspektiflerden.

01-performance.md Faz 2 = 03-rust-wasm-hybrid.md
01-performance.md §1.7 Faz 2 kısmı → o topic'in perspektifinden "performance için ne yapılacak" özeti
03-rust-wasm-hybrid.md → aynı işin mimari detaylı planı (Cargo.toml örneği, PyO3 binding, wasm-pack, CI/CD, test stratejisi, risk)
Fiziksel olarak tek iş: build2ai-kernels/ Cargo workspace kurup pilot kernel yazmak. O iş tamamlandığında her iki dosyadaki Faz 2 checkbox'ları aynı anda işaretlenir.

Yol haritasında neredeyiz

✅ 1️⃣  01 Performance — Faz 1 (algoritmik + Rust-ready refactor)  ← BİTTİ
⬜  2️⃣  03 Rust+WASM = 01 Faz 2                                    ← SIRADAKI
⬜  3️⃣  04 Shader viz
⬜  4️⃣  02 arq+Redis
⬜  5️⃣  05+07 TH+Pushover
⬜  6️⃣  06 DXF + Reinforcement
Yani 01'de yapılacak başka iş yok — Faz 1'in kalan maddesi (numpy-array-first conversion) bilinçli olarak 03'e bağlandı (Rust zaten o formatı istiyor, iki kez refactor etmemek için).

Başlayacağımız yer
Sıradaki: 03 Rust+WASM pilot kernel. Konkre ilk işler:

build2ai-kernels/ yeni crate oluştur (cargo init --lib)
Cargo.toml — PyO3 + numpy + ndarray feature flag'leri
maturin kurulumu (Python wheel builder)
Pilot: frame_local_stiffness Rust'a port (zaten pure fonksiyon olarak hazır)
Python tarafında characterization test — frame_local_stiffness_rust(args) == frame_local_stiffness_python(args) bit-for-bit
İlk wheel 1-2 haftada çıkar. Başlayalım mı? Yoksa displacements/reactions endpoint'lerini de önce aynı mantıkla optimize edip "prod sağlamlaştırma" sprint'i kapatalım mı?

04-shader-visualization.md
peki biz hangi noktada lineer analiz gibi şu an yaptığımız analizleri user broswer üzerinden handle edip karmaşık işlemleri push over anlaysis gibi kısımları server side halletmeye başlaycağız ya da dökümanalrda öyle bir plan yok mu acaba
Plan var ve çok net, şu an 03-rust-wasm-hybrid.md §3.7 ve 02-scaling-arq-redis.md §2.1 ikilisinde tanımlı. Özet:

Hybrid dispatch kuralı (doküman, §3.7)

const COMPLEXITY_THRESHOLD = 5000  // DOF

if (complexity < 5000) → browser (WASM)
else                   → server (arq queue + Rust PyO3)
Kademeli açılış
Analiz tipi	Browser	Server	Zorunlu server
Linear static < 5K DOF	✅		
Linear static 5K-20K DOF	⚠️	✅ opt	
Linear static > 20K DOF	❌	✅	
Modal < 20K DOF	✅		
Modal Time History (orta)	✅		
Direct Time History (büyük)	❌		ZORUNLU
Pushover (büyük model)	❌		ZORUNLU
Timeline'da tam yeri

✅ Faz 1        Her şey server-side (şimdiki durum — FastAPI pipeline)
                ↓
⬜ Faz 2 / 03   Rust+WASM kernel'ler yazılır
   ├─ Adım 1-2: Server-side PyO3 (backend hızlanır, hâlâ server'da)
   └─ Adım 3:   WASM bundle frontend'e entegre edilir
                ↓
                **İŞTE BU ANDA** browser-side dispatch başlar
                — küçük model browser'da, büyük model server'a fallback
                ↓
⬜ Faz 2 / 02   arq+Redis queue kurulur (heavy fallback altyapısı)
⬜ Faz 3 / 05   Modal TH → browser-side (küçük-orta model)
                Direct TH → server-side zorunlu, queue üzerinden
⬜ Faz 3 / 07   Pushover nonlineer → server-side zorunlu
Pratik olarak ne zaman hissedilecek?
3-4 ay sonra: 03'ün Adım 3'ü bittiğinde. O güne kadar kullanıcının "Analiz Et" butonu hep server'ı çalıştırıyor. Adım 3 merge olduğu gün, küçük model açan kullanıcı /analyze endpoint'ini hiç çağırmayacak — browser WASM'ı local'de çalıştırıp sonucu gösterecek. Kullanıcı bunu "süper hızlı oldu" olarak fark eder, altyapı fark etmez.

6-8 ay sonra: TH/Pushover geldiğinde queue devreye girer. Heavy job submit edilir, WebSocket üzerinden progress gelir, bittiğinde 3D viz açılır (docs/architecture/02-scaling-arq-redis.md §2.4).

Yani şu sırayla patlar
Server-side Rust (hâlâ server) → pipeline 10-100× hızlanır
Browser-side WASM → küçük modeller için server'a hiç gitmez
arq+Redis + TH/Pushover → heavy işler queue'dan background'da çalışır
Hepsi bağımsız mikro-kazanç veriyor, sıra da budur. Yani: 03 Adım 3 = kullanıcı browser'da analiz yapabileceği an.