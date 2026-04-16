# 07 — Pushover Analizi (Statik İtme)

> **Konu:** Yapının deprem performansını ölçmek için statik nonlineer artımlı analiz. TBDY 2018 §5.6 uyumlu, mafsal modeli + capacity curve + performans noktası.

## 7.1 Pushover'ın temel fikri

**Statik nonlineer artımlı analiz.** Yapıya bir lateral yük dağılımı uygulanır, şiddeti kademeli artırılır. Her adımda:
1. Sistem yeni denge konumuna gelir (deplasman artar)
2. Bazı kesitler akma sınırını aşar → **plastik mafsal** oluşur
3. Mafsal noktasında dönme rotation başlar, sertlik düşer
4. Yeni K matrisi ile devam edilir
5. Eninde sonunda yapı **mekanizma** haline gelir (göçer)

**Çıktı: Capacity curve** — taban kesme kuvveti (V_base) vs çatı deplasmanı (U_roof). Bu eğri yapının deprem kapasitesini özetler.

```
V_base
  |        ┌─────────●  Failure
  |       /
  |      /
  |     /  ← Hardening (k_p slope)
  |    /
  |   ●  Yield (M_y)
  |  /
  | /  ← Elastic (K)
  |/
  └─────────────────── U_roof
        Capacity Curve
```

## 7.2 Plastik mafsal modeli (TBDY 2018 §15.B)

Her frame elemanın iki ucunda **moment-rotasyon** ilişkisi tanımlanır:

```
M
 |     ┌────────────●  CP (Collapse Prevention)
 |    /│            ●  LS (Life Safety)
 |   / │            ●  IO (Immediate Occupancy)
 |  /  │
 | /   │ k_p (post-yield slope)
 |/    │
 ●─────┴──────────────── θ (rotation)
M_y   θ_y         θ_p  θ_u
       ← elastic →
              ← plastic →
```

**TBDY 2018 performans seviyeleri:**

| Seviye | Türkçe | İngilizce | Plastik dönme sınırı |
|---|---|---|---|
| **MN** | Sınırlı Hasar | IO (Immediate Occupancy) | θ_p ≤ 0.005 rad |
| **GV** | Belirgin Hasar | LS (Life Safety) | θ_p ≤ θ_GV |
| **GÖ** | Göçme Önleme | CP (Collapse Prevention) | θ_p ≤ θ_GÖ |
| **Göçme** | — | Failure | θ_p > θ_GÖ |

θ_GV ve θ_GÖ kesit ve donatı parametrelerine bağlıdır:

### θ_GV formülü (TBDY 2018 Denklem 15B.1)
```
θ_GV = 0.6 × ([1 + 1.3 × ω_we / ω_ws] - 1) × Φ_y × L_p
```
Burada:
- ω_we = enine donatı mekanik oranı  
- ω_ws = standart enine donatı oranı
- Φ_y = akma eğrilik
- L_p = plastik mafsal uzunluğu

### θ_GÖ formülü (TBDY 2018 Denklem 15B.2)
```
θ_GÖ = 0.75 × θ_GV × ductility factor
```

Bu hesaplar **kesit, malzeme, donatı detaylarına bağlı** — her frame için ayrı.

### Hinge state machine

```
       (M_y aşıldı)
ELASTIC ──────────────→ YIELDED
                          │
                          │  (θ artar, M ≈ M_y + k_p × Δθ)
                          ▼
                       HARDENING
                          │
                          │  (θ_u'ya ulaşıldı)
                          ▼
                       FAILED (M = 0, hinge serbest)
```

## 7.3 Algoritma

### Yük dağılım örüntüsü

3 seçenek (TBDY 2018 §5.6.2):

1. **Üniform:** Her kata aynı F_i = m_i × g (basit ama gerçekçi değil)
2. **Birinci mod şekli orantılı:** F_i = m_i × φ_1,i (en yaygın, gerçekçi)
3. **Modal kombine (MPA — Modal Pushover Analysis):** Birden fazla mod katkısı (yüksek katlar için TBDY öneriyor)

İlk mod yöntemi en yaygın, başlangıç için yeter.

### Displacement-controlled algoritma

```
GİRDİLER:
  - Yapı modeli (M, K, frame'ler, mafsal capacity'leri)
  - Lateral yük dağılım vektörü P (normalleştirilmiş)
  - Kontrol noktası (genelde çatı orta noktası)
  - Hedef deplasman U_target (TBDY 2018 §5.6.5'e göre tahmin)
  - Adım sayısı N_steps (genelde 200-500)

BAŞLATMA:
  Δu = U_target / N_steps         (her adım deplasman artırımı)
  K = K_elastic                   (başlangıç sertliği)
  Hinge_state[h] = ELASTIC        (her hinge için)
  output_curve = []               (V_base, U_roof) çiftleri

DÖNGÜ (her adım k = 1..N_steps):
  ─────────────────────────────────────────────
  1. PREDICTOR
     λ_k = U_target × (k / N_steps)   (current target displacement)
     Solve K × ΔU = ΔF, where ΔF chosen so U_control_node += Δu
     
  2. SOLVE
     ΔU = K^-1 × ΔF
     U_new = U_old + ΔU
  
  3. ELEMENT FORCES (recovery)
     For her frame:
       u_local = T × U_new[code]
       f_local = K_local × u_local - q_eq
       M_at_hinges = f_local[5], f_local[11]  (M3 her uçta)
  
  4. HINGE STATE CHECK + UPDATE
     For her hinge h:
       M_h = abs(M_at_hinge_h)
       
       if Hinge_state[h] == ELASTIC and M_h > M_y:
          # Yeni mafsal aktive oldu!
          
          # Backstep — yük azaltarak tam M = M_y konumuna git
          ratio = (M_y - M_h_prev) / (M_h - M_h_prev)
          λ_actual = λ_prev + ratio × (λ_k - λ_prev)
          U_actual = U_prev + ratio × (U_new - U_prev)
          
          # Hinge durumu güncelle
          Hinge_state[h] = YIELDED
          K = update_K_with_yielded_hinge(h)
          
          # Adımı tekrarla yeni K ile
          ΔU = K^-1 × (ΔF × (1 - ratio))
          ...
       
       elif Hinge_state[h] == YIELDED and θ_h > θ_u:
          # Mafsal kırıldı
          Hinge_state[h] = FAILED
          K = update_K_with_failed_hinge(h)
          # Re-iterate
       
       elif new state → re-form K, re-iterate
  
  5. CONVERGENCE
     Bu adımda hinge durumu sabitlenene kadar 1-3'ü iterate
     Max 20 iterasyon, ||residual|| < tol
  
  6. KAYIT
     V_base = Σ taban reaksiyonu (lateral yön)
     U_roof = U[control_node]
     output_curve.append((U_roof, V_base))
     hinge_history.append([h.state for h in hinges])
     
  7. KAPASİTE KAYBI KONTROLÜ
     Eğer V_base düşmeye başladıysa (negatif slope çok dik) → analizi durdur
     "Yapı çöktü"

ÇIKTI:
  - Capacity curve (V_base vs U_roof)
  - Her adımda hangi hinge aktive oldu (sequence)
  - Her adımda her hinge'in (rotation, moment) durumu
  - Performance level locations (IO, LS, CP geçişleri)
  - Yapı performans seviyesi (TBDY §5.6.5'e göre target displacement'ta)
```

## 7.4 K matrisinin güncellenmesi — kritik detay

Mafsal aktive olunca o noktadaki rotation DOF'u nasıl handle edilir?

### Yöntem 1: Static condensation (hinge release)
- Frame elementinin K_local matrisinde, mafsal'lı uçtaki rotation satır/sütununu sıfırla
- Bu DOF tamamen serbest hale gelir, moment iletmez
- ✅ Basit
- ❌ Enerji disipasyonunu kaçırır

### Yöntem 2: Plastic moment as RHS force
- Mafsal'lı DOF tutulur, K elastic kalır
- M = M_y'lik bir karşı-moment RHS'a eklenir
- ✅ Doğru
- ❌ Her step'te RHS güncellemesi gerekir

### Yöntem 3: Reduced stiffness with hardening
- K_modified[5,5] = k_p (post-yield slope, genelde 0.05 × k_elastic)
- Hinge ne tam serbest ne tam tutulu — yarı-yumuşak
- ✅ **En gerçekçi**
- ❌ K her hinge state değişiminde re-assemble gerekir

**OpenSees ve SAP2000 Yöntem 3'ü kullanır.** Bizim de hedefimiz Yöntem 3.

### Pseudo-code Yöntem 3
```python
def update_K_for_hinge_states(K_elastic, frames, hinge_states):
    """Mevcut hinge state'lerine göre K'yı yeniden assemble et."""
    K = sparse_zeros_like(K_elastic)
    
    for frame in frames:
        K_local = compute_local_stiffness(frame)
        
        for end in ['I', 'J']:
            hinge = frame.hinges[end]
            state = hinge_states[hinge.id]
            
            if state == 'YIELDED':
                # M3 DOF'u modify et — k_p slope (post-yield)
                k_idx = 5 if end == 'I' else 11
                K_local[k_idx, k_idx] *= 0.05  # k_p / k_elastic
                # Diagonal off-diagonal terimleri sıfırla (release benzeri)
                K_local[k_idx, :] = K_local[k_idx, :] * 0.05
                K_local[:, k_idx] = K_local[:, k_idx] * 0.05
            
            elif state == 'FAILED':
                # Tam serbest
                k_idx = 5 if end == 'I' else 11
                K_local[k_idx, :] = 0
                K_local[:, k_idx] = 0
                K_local[k_idx, k_idx] = 1e-9  # numerical stability
        
        # Global'e assemble
        T = transform_matrix(frame)
        K_global = T.T @ K_local @ T
        K[frame.dof_codes, :][:, frame.dof_codes] += K_global
    
    return K
```

Her hinge state değişimde bu fonksiyon çağrılır → K re-assemble edilir → yeni LU faktorize edilir → solve continue.

## 7.5 Newton-Raphson iteration

Pushover için her step'te genelde 1-5 iterasyon:

```python
def pushover_step(U_old, dU_target, K_current):
    # Predictor
    F_pred = K_current @ dU_target
    
    for iteration in range(MAX_ITER):  # genelde 5-10
        # Solve
        dU = sparse_solve(K_current, F_pred)
        U_new = U_old + dU
        
        # Compute element forces
        forces = compute_element_forces(U_new)
        
        # Check hinge states
        new_states = check_hinge_states(forces, hinge_capacities)
        
        if new_states == old_states:
            # Converged
            return U_new, K_current, new_states
        
        # State changed → re-form K
        K_current = update_K_for_hinge_states(K_elastic, frames, new_states)
        old_states = new_states
        # Re-solve with new K
    
    raise ConvergenceError(f"Pushover step did not converge in {MAX_ITER} iterations")
```

## 7.6 Eşdeğer SDOF dönüşümü → Performans noktası

Pushover sonucu olan multi-DOF capacity curve'i, **eşdeğer SDOF**'a dönüştürmek gerekir performance evaluation için (TBDY 2018 §5.6.5):

### 1) Modal kütle ve participation factor
```
m* = Σ m_i × φ_1,i        (etkin modal kütle)
Γ* = (Σ m_i × φ_1,i) / (Σ m_i × φ_1,i²)
```

### 2) SDOF dönüşümü
```
U_sdof = U_roof / Γ*       (eşdeğer SDOF deplasmanı)
F_sdof = V_base / Γ*       (eşdeğer SDOF kuvveti)
```

### 3) Bilineer idealizasyon (TBDY §5.6.5)
Capacity curve'ı bilineer modele yaklaştır:
```
F
|
|       ┌──────●  F_max (yapısal kapasite)
|      /
|     /
|    ●  F_y (akma)
|   /
|  /
| /  ← K_e (initial elastic)
|/
└─────────────── U
   U_y      U_max
```

Eşit alan kuralı: F_y × U_y / 2 + F_y × (U_max - U_y) = ∫ F dU (orjinal eğri)

### 4) Effective period
```
T_eff = 2π × √(m* / K_e)
```

### 5) Spektral demand (TBDY §2.3)
T_eff için tasarım spektrumundan:
```
S_de(T_eff) = spektral deplasman talebi
```

### 6) Target displacement (TBDY §5.6.5)
```
U_target = S_de(T_eff) × Γ* × C1
```
C1 = nonlineer-lineer dönüşüm faktörü (genelde 1.0 - 1.5).

### 7) Performance check
Capacity curve'da `U_target` noktasında:
- Hinge'lerin durumu kontrol edilir
- Tüm kolonların θ < θ_GV → yapı GV (Belirgin Hasar) seviyesinde
- Tüm kirişlerin θ < θ_GÖ → ...
- TBDY §5.6 Tablo 5.3 / Tablo 5.4 ile kontrol

## 7.7 İmplementasyon yol haritası

### Faz 1 (2-3 hafta): Çekirdek Pushover engine
- Düz mafsal modeli (yield only, no degradation)
- Yöntem 1 (static condensation) ile K update — basit
- Capacity curve çıktısı
- **Validation:** OpenSees veya SAP2000 ile karşılaştır (1 referans bina)

### Faz 2 (2 hafta): TBDY 2018 mafsal kütüphanesi
- Tablo 15B.1, 15B.2 implementasyonu
- Kesit + donatı → θ_y, θ_GV, θ_GÖ otomatik
- Performans level otomatik
- **Validation:** TBDY uzmanı ile 5 örnek

### Faz 3 (2 hafta): Hardening + degradation (Yöntem 3)
- K_modified ile gerçekçi
- Newton-Raphson her step
- Convergence kontrolü
- Backstepping (state transition)

### Faz 4 (1-2 hafta): Performans noktası + raporlama
- N2 yöntemi (Eurocode 8 alternatif)
- TBDY §5.6.5 metodu
- Hinge sequence raporu
- Performance level haritası (kat × eleman)
- TBDY uyumluluk raporu otomatik

### Faz 5 (1 hafta): Visualization (Topic 4'ten)
- Capacity curve grafik (Plotly)
- Hinge formation animasyonu (3D, Topic 4)
- Drift profile

### Faz 6 (1-2 hafta): Rust kernel
- `pushover_hinge_check` Rust'a port
- `update_K_for_hinge_states` Rust'a port
- 30-50× hızlanma

**Toplam: 9-12 hafta** Pushover.

## 7.8 TH ve Pushover ortak altyapı

```
src/services/nonlinear_analysis/
├── hinge_models/
│   ├── moment_rotation.py    (M-θ backbone curves — ortak)
│   ├── tbdy_2018_15b.py      (Türk yönetmeliği tabloları)
│   ├── fema_356.py           (FEMA mafsal modeli — alternatif)
│   └── state_machine.py      (hinge state machine — ortak)
├── time_integrators/
│   ├── newmark_beta.py       (Newmark-β step)
│   ├── hht_alpha.py          (HHT-α step)
│   └── duhamel.py            (Modal SDOF closed-form)
├── solvers/
│   ├── modal_th.py           (Modal Time History orchestratörü)
│   ├── direct_th.py          (Direct Integration TH)
│   └── pushover.py           (Displacement-controlled Pushover)
├── damping/
│   ├── rayleigh.py
│   └── modal_damping.py
└── recovery/
    ├── envelope.py           (max/min over time)
    └── full_history.py       (tüm time series, lazy)
```

**Paylaşımlı çekirdek:** TH ve Pushover aynı `hinge_models`'i, aynı `time_integrators`'ı kullanır. DRY.

## 7.9 Test stratejisi

### Characterization tests (golden output)
| Test | Referans |
|---|---|
| Single hinge cantilever pushover | Closed-form (manual) |
| 2-story 1-bay frame pushover | OpenSees |
| 5-story RC building pushover | SAP2000 |
| TBDY example building (mevzuat ekinde olan) | TBDY 2018 EK-G örnek |

Tolerans: 
- Yield deplasmanı: ±5%
- Yield kuvveti: ±5%
- Capacity curve şekli: visual + RMS error %10

### Engineering review checklist
- [ ] Mafsal sıralaması (sequence) mantıklı mı? (Genelde önce kiriş ucu, sonra kolon dibi)
- [ ] Strong-column-weak-beam sağlanıyor mu? (TBDY §7.4.5 kapasite tasarımı)
- [ ] Story drift profili tek-kat mekanizmasına işaret ediyor mu? (Tehlikeli, sünek değil)
- [ ] Capacity curve smooth mu? (Backstepping doğru çalışıyor)

## 7.10 Risk + mitigasyon

| Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|
| TBDY mafsal hesabı hatalı | Orta | **Çok yüksek** | Senior CE eng review + 5+ referans bina cross-check |
| K update yanlış (numerical instability) | Orta | Yüksek | Convergence kontrolü, max iter, fallback algoritma |
| Backstepping infinite loop | Düşük | Yüksek | Max backstep count + adaptive step size |
| Hinge yorumu yanlış (yield criterion) | Orta | Yüksek | TBDY 2018 §15.B'yi kelime kelime uygula + test |
| Performance level rapor yanlış | Düşük | Orta | Validate dengesi |

## 7.11 Implementation Status

- [ ] Faz 1 — Çekirdek engine
  - [ ] Hinge state machine (Python)
  - [ ] Static condensation update K
  - [ ] Displacement-controlled outer loop
  - [ ] Backstepping (state transition exact)
  - [ ] Capacity curve output
- [ ] Faz 2 — TBDY 2018 mafsal kütüphanesi
  - [ ] θ_GV, θ_GÖ formülleri (Denklem 15B.1, 15B.2)
  - [ ] Plastik mafsal uzunluğu L_p
  - [ ] Kapasite tasarım kontrolü
- [ ] Faz 3 — Reduced stiffness (Yöntem 3)
  - [ ] K modify with k_p slope
  - [ ] Newton-Raphson iteration
  - [ ] Convergence kontrolü
- [ ] Faz 4 — Performans noktası
  - [ ] Eşdeğer SDOF dönüşümü
  - [ ] Bilineer idealizasyon
  - [ ] T_eff hesabı
  - [ ] Target displacement (TBDY §5.6.5)
  - [ ] Performance level rapor
- [ ] Faz 5 — Visualization (Topic 4)
- [ ] Faz 6 — Rust kernel'leri

## Bağlantılar

- Time History (mafsal modeli ortak): [05-time-history.md](./05-time-history.md)
- Pushover viz: [04-shader-visualization.md](./04-shader-visualization.md)
- Heavy job dispatch: [02-scaling-arq-redis.md](./02-scaling-arq-redis.md)
- Browser-side execution: [03-rust-wasm-hybrid.md](./03-rust-wasm-hybrid.md)
- Reinforcement design (mafsal capacity'leri için): [06-cad-export.md](./06-cad-export.md)
