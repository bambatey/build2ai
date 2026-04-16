# 05 — Time History Analizi

> **Konu:** Yapısal dinamik analiz — yer hareketi (deprem ivme kaydı) altında yapının zaman içindeki tepkisi. İki yöntem: Modal Superposition (lineer) ve Direct Integration (nonlineer).

## 5.1 Temel teori

Yapısal dinamik denklemi:
```
M ü(t) + C u̇(t) + K u(t) = F(t)
```

Burada:
- **M** = kütle matrisi (sparse, çoğunlukla diagonal lumped)
- **C** = sönüm matrisi (genelde Rayleigh: `αM + βK`)
- **K** = rijitlik matrisi (sparse)
- **u(t)** = yer değiştirme vektörü (zaman fonksiyonu)
- **F(t)** = dış kuvvet vektörü

Deprem analizi için tipik yükleme:
```
F(t) = -M r a_g(t)
```

`r` = baz hareketi yönündeki birim vektör (X yönü deprem için tüm X DOF'ları 1, diğerleri 0).
`a_g(t)` = yer ivmesi zaman geçmişi (örn. Düzce, Erzincan, Kobe kayıtları).

## 5.2 Yöntem seçimi

### Karar matrisi
| Senaryo | Tercih edilen yöntem |
|---|---|
| Lineer yapı + küçük deplasman | **Modal Superposition** |
| Lineer yapı + sönüm modlar arası coupled | Direct Integration (Newmark) |
| Nonlineer (mafsal, perde duvar yumuşaması) | **Direct Integration** (HHT-α) |
| Yüksek frekans ısrar gerekli | Direct (Modal mod truncation hatası) |
| Embarrassingly parallel ihtiyacı | **Modal** (her mod ayrı) |
| Hızlı yaklaşık çözüm | Modal |
| Tam-doğru çözüm | Direct |

## 5.3 Modal Time History (Modal Superposition)

### Algoritma özeti

Sistemi **modal koordinatlarda decouple et**. Her mod bağımsız bir SDOF olur.

#### Adım 1 — Modal analiz (önceden)
```
K φ_i = ω_i² M φ_i  →  modlar φ_i, frekanslar ω_i
```

Mod sayısı: TBDY 2018 §4.7.3'e göre **kütle katılımı %95** olana kadar (genelde 12-50 mod).

#### Adım 2 — Modal participation factor
Her mod için:
```
m_i = φ_iᵀ M φ_i           (modal kütle)
L_i = φ_iᵀ M r              (excitation factor)
Γ_i = L_i / m_i              (participation factor)
```

`m_i` = mass-orthogonal normalleştirme için.
`Γ_i` = i. modun deprem yer hareketinden ne kadar etkilendiği.

#### Adım 3 — Modal damping
Genelde her mod için ξ = 0.05 (TBDY 2018 standart):
```
c_i = 2 × ξ × ω_i × m_i
```

#### Adım 4 — Her mod için SDOF integration
Decoupled SDOF denklemi:
```
m_i × q̈_i(t) + c_i × q̇_i(t) + k_i × q_i(t) = -Γ_i × m_i × a_g(t)

Yani:
q̈_i(t) + 2ξω_i × q̇_i(t) + ω_i² × q_i(t) = -Γ_i × a_g(t)
```

Her mod için Newmark-β (β=¼, γ=½):
```
For t = 0, Δt, 2Δt, ..., T_end:
  Solve SDOF Newmark step → q_i(t+Δt), q̇_i(t+Δt), q̈_i(t+Δt)
  Save q_i(t)
```

#### Adım 5 — Mod toplama (superposition)
```
For her t:
  U(t) = Σ_i  φ_i × q_i(t)
  V(t) = Σ_i  φ_i × q̇_i(t)
  A(t) = Σ_i  φ_i × q̈_i(t)
```

Sonra recovery (kesit tesirleri) for each U(t).

### SDOF Newmark step (en kritik kernel)

```rust
// RUST KERNEL — bu en sık çağrılan fonksiyon
// Per mode (50 mod) × per time step (10K) = 500K çağrı
fn modal_sdof_step(
    omega: f64,        // mod frekansı
    xi: f64,           // sönüm oranı
    gamma_i: f64,      // participation factor
    a_g_n: f64,        // current ground acceleration
    a_g_n1: f64,       // next ground acceleration
    q_n: f64,          // q(t_n)
    qdot_n: f64,       // q̇(t_n)
    qddot_n: f64,      // q̈(t_n)
    dt: f64,
) -> (f64, f64, f64) {
    let beta = 0.25;
    let gamma = 0.5;
    
    let omega2 = omega * omega;
    let c = 2.0 * xi * omega;
    
    // Effective stiffness
    let k_eff = omega2 + gamma / (beta * dt) * c + 1.0 / (beta * dt * dt);
    
    // Effective force
    let f_n1 = -gamma_i * a_g_n1;
    let f_eff = f_n1
        + (1.0 / (beta * dt * dt)) * q_n
        + (1.0 / (beta * dt)) * qdot_n
        + (1.0 / (2.0 * beta) - 1.0) * qddot_n
        + c * (gamma / (beta * dt) * q_n
                + (gamma / beta - 1.0) * qdot_n
                + dt * (gamma / (2.0 * beta) - 1.0) * qddot_n);
    
    // Solve
    let q_n1 = f_eff / k_eff;
    
    // Update ü, u̇
    let qddot_n1 = (1.0 / (beta * dt * dt)) * (q_n1 - q_n)
                    - (1.0 / (beta * dt)) * qdot_n
                    - (1.0 / (2.0 * beta) - 1.0) * qddot_n;
    let qdot_n1 = qdot_n + (1.0 - gamma) * dt * qddot_n + gamma * dt * qddot_n1;
    
    (q_n1, qdot_n1, qddot_n1)
}
```

50 mod × 10K step = 500K çağrı. Rust'ta her çağrı ~100ns = **toplam 50ms**. Python'da ~1μs = 500ms. Her ikisi de hızlı, ama Rust GPU'ya yakın hızda.

### Avantajlar
- ✅ **Embarrassingly parallel** — her modu ayrı thread/worker'da çöz
- ✅ **Çok hızlı** — N_dof yerine N_mode SDOF (50 vs 5000 = 100×)
- ✅ **Kararlı** — SDOF Newmark β=¼ unconditionally stable
- ✅ **Hafıza dostu** — sadece modal koordinatlar sakla, son adımda U(t) hesapla

### Sınırları
- ❌ Nonlineer çalışmaz (modlar K sabit varsayar)
- ❌ Mod truncation hatası (üst modlar atılırsa yüksek frekans kaybedilir)
- ❌ Coupling sönüm modelleri zorlaşır (Rayleigh çoğu zaman yeter)

## 5.4 Direct Integration Time History

**Kullanım:** Nonlineer sistem (mafsal, perde duvar yumuşaması, izolatör), ya da yüksek-frekans önemli.

### Newmark-β yöntemi (klasik)

Time step Δt = 0.005-0.02 s tipik. Her step'te tam sistem çözülür.

**Newmark approximations:**
```
u̇_{n+1} = u̇_n + (1-γ)Δt ü_n + γΔt ü_{n+1}
u_{n+1} = u_n + Δt u̇_n + (½-β)Δt² ü_n + βΔt² ü_{n+1}
```

**Parametre seçimi:**
| β | γ | İsim | Kararlılık |
|---|---|---|---|
| 1/4 | 1/2 | Average acceleration | **Unconditionally stable (en yaygın)** |
| 1/6 | 1/2 | Linear acceleration | Conditional (Δt ≤ T_min/π√3) |
| 0 | 1/2 | Central difference | Conditional, explicit |

### Algoritma

```
HAZIRLIK (her analiz başında bir kere):
  1. M, C, K matrisleri assemble (lineerse)
     Rayleigh: C = α₀ M + α₁ K
  2. Effective stiffness:
     K_eff = K + (γ/(βΔt)) C + (1/(βΔt²)) M
  3. K_eff'i factorize et (sparse LU) — lineerse bir kez yapılır, çok hızlanma
  4. Initial koşullar: u_0 = 0, u̇_0 = 0
     M ü_0 = F_0 - C u̇_0 - K u_0 → ü_0 (initial acceleration)

HER ZAMAN ADIMI (n = 0, 1, ..., N-1):
  1. Effective force:
     F_eff = F_{n+1} 
              + M [ (1/(βΔt²))u_n + (1/(βΔt))u̇_n + (1/(2β)-1)ü_n ]
              + C [ (γ/(βΔt))u_n + (γ/β-1)u̇_n + Δt(γ/(2β)-1)ü_n ]
     
  2. Çöz: u_{n+1} = K_eff^-1 × F_eff
     (LU faktorize edilmişse sadece backsub → hızlı)
  
  3. Hız ve ivme güncelle:
     ü_{n+1} = (1/(βΔt²))(u_{n+1} - u_n) - (1/(βΔt))u̇_n - (1/(2β)-1)ü_n
     u̇_{n+1} = u̇_n + (1-γ)Δt ü_n + γΔt ü_{n+1}
  
  4. (Optional) Recovery: per-element forces
  
  5. (Optional) Progress notify (Redis pubsub)
```

### Nonlineer durum

K her step'te değişir (mafsal aktivasyonu, perde yumuşaması). **K_eff her step'te yeniden faktorize edilmeli** → çok yavaş.

Newton-Raphson iterasyonu:
1. Predictor: ΔU = K_eff^-1 ΔF
2. Compute element forces with new U
3. Check yield criteria (hinge state machine)
4. Compute residual force
5. If ||residual|| < tol → converged
6. Else: update K, iterate

**Nonlineer maliyeti:** ~3-10× lineer (her step'te 2-5 iterasyon). 30 dakikalık lineer analiz **2-5 saat nonlineer** olabilir.

### HHT-α (Hilber-Hughes-Taylor) — modern alternatif

Newmark'ın gelişmiş hali, **numerical damping** ile yüksek-frekans kararsızlığı söndürür:
```
M ü_{n+1} + (1+α)C u̇_{n+1} - α C u̇_n + (1+α)K u_{n+1} - α K u_n = F_{n+α}
```

α ∈ [-1/3, 0] tipik **-0.05'tan -0.1'e**. Kararlı + dissipative.

OpenSees, ANSYS, ABAQUS default'u HHT-α'dır.

### Rust kernel — Newmark step

```rust
// RUST KERNEL — Direct TH her time step çağrılır
// 10,000 step × 1 çağrı = 10K çağrı, ama her çağrı sparse solve yapıyor
fn newmark_beta_step(
    K_eff: &SparseMatrix,        // pre-factorized sparse
    M: &SparseMatrix,
    C: &SparseMatrix,
    F_n1: &Vector,                // current external force
    u_n: &Vector, udot_n: &Vector, uddot_n: &Vector,
    beta: f64, gamma: f64, dt: f64,
) -> (Vector, Vector, Vector) {
    let n = u_n.len();
    
    // F_eff = F_{n+1} + M[...] + C[...]
    let mut f_eff = Vector::zeros(n);
    for i in 0..n {
        let m_term = (1.0 / (beta * dt * dt)) * u_n[i]
                    + (1.0 / (beta * dt)) * udot_n[i]
                    + (1.0 / (2.0 * beta) - 1.0) * uddot_n[i];
        let c_term = (gamma / (beta * dt)) * u_n[i]
                    + (gamma / beta - 1.0) * udot_n[i]
                    + dt * (gamma / (2.0 * beta) - 1.0) * uddot_n[i];
        f_eff[i] = F_n1[i] + (M @ m_term)[i] + (C @ c_term)[i];
    }
    
    // Solve K_eff × u_{n+1} = f_eff (pre-factorized → backsub)
    let u_n1 = sparse_lu_backsub(K_eff_factorized, &f_eff);
    
    // Update ü, u̇
    let mut uddot_n1 = Vector::zeros(n);
    let mut udot_n1 = Vector::zeros(n);
    for i in 0..n {
        uddot_n1[i] = (1.0 / (beta * dt * dt)) * (u_n1[i] - u_n[i])
                     - (1.0 / (beta * dt)) * udot_n[i]
                     - (1.0 / (2.0 * beta) - 1.0) * uddot_n[i];
        udot_n1[i] = udot_n[i]
                   + (1.0 - gamma) * dt * uddot_n[i]
                   + gamma * dt * uddot_n1[i];
    }
    
    (u_n1, udot_n1, uddot_n1)
}
```

## 5.5 Damping (sönüm) modeli

### Rayleigh (en yaygın)
```
C = α₀ M + α₁ K
```

İki frekansta hedef sönüm oranı `ξ` veriliyor (genelde T₁ ve T₃):
```
α₀ = 2ξ × (ω₁ ω₂) / (ω₁ + ω₂)
α₁ = 2ξ / (ω₁ + ω₂)
```

Ara modlarda ξ otomatik düşer (Rayleigh "U-shape" özelliği).
TBDY 2018 §4.7.3 ξ = 0.05 önerir.

**Avantajları:**
- Sparse C kalır (M ve K sparse, lineer kombinasyon sparse)
- Klasik, well-tested

**Dezavantajları:**
- Sadece 2 modda tam sönüm; diğer modlarda yaklaşık
- Çok yüksek frekanslarda fazla sönüm

### Modal damping
Sadece Modal TH'da kullanılabilir. Her mod için ξ_i ayrı ayrı belirlenir. Daha esnek ama Direct TH'da uygulanamaz (C explicit ifade edilemez).

### Caughey serisi
Rayleigh'in genellemesi:
```
C = M Σ_i a_i (M^-1 K)^i
```

Tipik 4-5 mod için tam doğru sönüm verir. Karmaşık, nadir kullanılır.

## 5.6 Yer hareketi formatı

### PEER NGA (Pacific Earthquake Engineering Research Center)
- Standart akademik kayıt formatı
- Header (kayıt info, dt, npts) + ASCII ivme değerleri
- 3 kanal: NS, EW, UD (north-south, east-west, up-down)

### TBDY 2018 §2.4
- En az 11 deprem kaydı (Türkiye için)
- AFAD/PEER veritabanı
- Spektral uyumlu (target spectrum'a göre scale)
- Dual ve random sırayla 1.4× scale

### Bizim format (önerilen)
```json
{
  "name": "Düzce 1999 NS",
  "dt": 0.005,
  "n_pts": 6000,
  "scale_factor": 1.0,
  "values": [0.001, 0.003, ...]   // m/s² cinsinden
}
```

Storage'a binary olarak kaydet: 6000 float = 48KB.

## 5.7 Recovery — her step için kesit tesirleri

**Sorun:** 10K step × 500 frame × 5 station × 6 component = **150 milyon değer = 600MB float32**.

### Strateji: Envelope (max/min)
Her frame, her station, her component için:
```
M_max = max over t of M(t)
M_min = min over t of M(t)
t_at_max = argmax t
t_at_min = argmin t
```

150M değer → 30K değer. Detay isteyince kullanıcı belirli frame için tam time series'i çekebilir (lazy load).

### Strateji 2: Down-sampling
Tüm time history'yi sakla ama 10× azalt (her 10. step). 60MB. Detail zoom için tam veri lazy load.

### Strateji 3: Compressed time series
Float32 → binary protocol buffer ya da Zstandard sıkıştırma. ~3-5× azalma.

**Önerim:** Envelope default + tam veri opt-in (kullanıcı isterse).

## 5.8 İmplementasyon yol haritası

### Faz 1 (1-2 hafta): Modal Time History
- **Önkoşul:** Modal analiz (var)
- SDOF Newmark integrator → 100 satır Python kod
- Mod toplama → vectorize numpy
- Ground motion file parser (PEER NGA + custom)
- Envelope recovery
- **Browser-side**: WASM kernel ile 5K DOF'ya kadar çalışır

### Faz 2 (2-3 hafta): Direct Integration Lineer
- Newmark-β step (lineer, K_eff pre-factorize)
- Rayleigh damping
- Sparse LU pre-factorization (scipy.sparse.linalg.splu)
- Envelope recovery
- Progress streaming (worker → Redis pubsub → WebSocket)
- **Server-side** (büyük model)

### Faz 3 (3-4 hafta): Nonlineer (mafsal modeli)
- Plastik mafsal kütüphanesi → [07-pushover.md](./07-pushover.md) ile ortak
- Hinge state machine
- Newton-Raphson her step
- HHT-α'ya geçiş (kararlılık)
- Convergence kontrolü

### Faz 4 (2 hafta): Performance — Rust
- `modal_sdof_step` → Rust kernel
- `newmark_beta_step` → Rust kernel
- Sparse solve → suitesparse C bindings (PyO3)
- 100× hızlanma

### Faz 5 (1-2 hafta): Visualization
- Time history playback (Topic 4)
- Envelope renkleri (Topic 4)
- Dynamic drift profile

**Toplam: 8-12 hafta** lineer kapsam + 3-4 hafta nonlineer ekstra.

## 5.9 Validation — characterization tests

Her algoritma adımı için **golden test** (referans çıktı ile karşılaştırma):

| Test | Referans |
|---|---|
| SDOF Newmark step | Closed-form Duhamel integral |
| Modal participation factor | Hand calc + SAP2000 |
| Direct TH lineer | OpenSees, SAP2000, ya da literatür örnekleri |
| Direct TH nonlineer | OpenSees |
| HHT-α numerical damping | Spectral analiz benchmark |

Tolerans: rel error < 1e-6 (lineer), < 1e-3 (nonlineer iteration tolerance içinde).

## 5.10 Implementation Status

- [ ] Faz 1 — Modal TH
  - [ ] SDOF Newmark integrator (Python)
  - [ ] Ground motion parser (PEER NGA)
  - [ ] Mod toplama
  - [ ] Envelope recovery
  - [ ] Frontend integration (browser-side small model)
- [ ] Faz 2 — Direct TH Lineer
  - [ ] Newmark-β step (Python prototype)
  - [ ] Rayleigh damping
  - [ ] K_eff pre-factorization
  - [ ] arq worker job
  - [ ] WebSocket progress streaming
- [ ] Faz 3 — Nonlineer
  - [ ] Hinge model (TBDY 2018 §15.B)
  - [ ] State machine
  - [ ] Newton-Raphson
  - [ ] HHT-α step
- [ ] Faz 4 — Rust kernel'leri
- [ ] Faz 5 — Visualization

## Bağlantılar

- Pushover (mafsal modeli ortak): [07-pushover.md](./07-pushover.md)
- Heavy job dispatch: [02-scaling-arq-redis.md](./02-scaling-arq-redis.md)
- Browser-side execution: [03-rust-wasm-hybrid.md](./03-rust-wasm-hybrid.md)
- Time history viz: [04-shader-visualization.md](./04-shader-visualization.md)
