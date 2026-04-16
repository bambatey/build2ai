# 06 — DXF/AutoCAD Export (sta4cad-Style)

> **Konu:** Statik proje çıktılarını AutoCAD formatında basma — sta4cad'ın asıl satış argümanı. İki ayrı modül: reinforcement design + drawing generation.

## 6.1 Sta4cad/ProBina'nın gerçek değer önerisi

Bu programlar "kara kutu" gibi görünür ama aslında **2 ayrı modülün üst üste** binmesidir:

```
┌──────────────────────────────────────────┐
│ 1. ANALİZ + DESIGN (asıl değer)          │
│    - Statik analiz                       │
│    - TS 500 + TBDY 2018 design           │
│    - Reinforcement hesabı                │
│    - Detailing kuralları                 │
└─────────────┬────────────────────────────┘
              │ (kesit, donatı, hesap sonuçları)
              ▼
┌──────────────────────────────────────────┐
│ 2. DRAWING GENERATION (görünür yüz)      │
│    - DXF/DWG yazımı                      │
│    - Kat planları, kesitler              │
│    - Donatı detayları                    │
│    - Eleman tabloları                    │
└──────────────────────────────────────────┘
```

**Asıl değer "1. Design".** Drawing format dönüşümü; karmaşık değil. İnsanlar AutoCAD çıktısını gördüğü için "drawing magic" sanır.

## 6.2 Sta4cad teknik altyapısı

- **Sta4cad** (eski, 1995-): ObjectARX (AutoCAD'in C++ API'si) — DWG'yi AutoCAD ile direkt yazıyor
- **ProBina** (modern): muhtemelen DXF text format direkt yazıyor (closed-source, kesin değil)
- **ideCAD**: kendi format'ı var, AutoCAD'e DXF üzerinden export

Modern alternatif: AutoCAD kurulumuna gerek yok. **DXF ASCII text format** Autodesk tarafından dokümante, tüm CAD programları açıyor.

## 6.3 Çıktı dokümanları envanteri

Tipik betonarme proje çıktısı (~40-100 sayfa DXF):

| Sayfa tipi | İçerik | Sayfa sayısı |
|---|---|---|
| **Genel kapak + uyarılar** | Proje bilgisi, mevzuat referansları | 1-2 |
| **Kat planları** (her kat için) | Akslar, kolonlar, kirişler, ölçüler, eleman etiketleri | N_stories + 1 (bodrum) |
| **Kolon detay sayfası** | Yatay kesit + boyuna donatı + etriye + hesap özeti | N_columns / 4 (sayfa başına 4 kolon) |
| **Kiriş açılım sayfası** | Yan görünüş + üst/alt donatı + etriye spacing | N_beams / 3 |
| **Döşeme planı** | Plak donatıları (Q-Q, T-T mesh) | N_stories |
| **Temel planı + detay** | Tekil/sürekli temel ya da raft, alt-üst donatı | 2-5 |
| **Eleman tabloları** | Kolon listesi, kiriş listesi (özet), donatı listesi | 3-5 |
| **Hesap özet sayfası** | Yük, deplasman, drift kontrol tabloları | 2-3 |
| **Antet** her sayfa | Proje adı, ölçek, tarih, sayfa no | her sayfada |

## 6.4 Teknoloji seçimi: ezdxf

### Karşılaştırma
| Kütüphane | Dil | Olgunluk | Pyodide | Bizim için |
|---|---|---|---|---|
| **ezdxf** | Python | ★★★★★ (2024 v1.3+) | ✅ Çalışır | **Seçildi** |
| pydxf | Python | ★★ (eski) | ? | Hayır |
| LibreCAD libraries | C++ | ★★★★ | ❌ | Server-only opsiyonel |
| dxf-writer | JS | ★★ basic | N/A | Yetersiz |
| ifcopenshell | Python | ★★★★★ | ✅ | IFC için (BIM) |

### ezdxf özellikleri
- ✅ Pure Python (no native deps)
- ✅ R12 - R2018 versiyonları
- ✅ Layer, dimension, hatch, block desteği
- ✅ Dimensioning otomatik
- ✅ ~50KB install
- ✅ FreeCAD ve diğer büyük projelerde kullanılıyor
- ✅ **Pyodide'da çalışır** — browser-side DXF üretebiliriz

## 6.5 Hibrit avantajı: Browser-side DXF

ezdxf Pyodide'da çalıştığı için:
- **Design hesabı:** Rust kernel (browser, hızlı)
- **DXF generation:** Pyodide + ezdxf (browser, server'a 0 byte gitmez)
- Kullanıcı "DXF indir" tıklayınca: tam yerel hesap → Blob → download

**Pazarlama avantajları:**
- "Modeliniz hiç bulutumuza gelmez"
- "Anında DXF üretir, server bekleme yok"
- Kurumsal IP koruması

## 6.6 Asıl iş: Reinforcement Design

Sta4cad'ın değerinin **%80'i** burada. Yapılması gerekenler:

### 6.6.1 Kiriş design (TS 500 / TBDY 2018)

#### Eğilme donatısı

```
For her span × (top, bottom):
  M_design (analiz çıktısı)
  ↓
  ρ = M_design / (b × d² × f_cd)   (TS 500 §7.4)
  
  Mu_balance = ε_cu × E_s × b × d² × f_cd × ...
  ↓
  ρ_balance hesapla
  ρ_max = 0.85 × ρ_balance         (sünek tasarım için)
  ρ_min = 0.8 × f_ctd / f_yd       (TS 500 §7.4.1)
  
  if ρ < ρ_min:
    A_s = ρ_min × b × d
  elif ρ > ρ_max:
    raise DesignError("Çift donatılı tasarım gerekli")
  else:
    A_s,req = ρ × b × d
  
  → Bar selection (Ø12, Ø14, Ø16, Ø18, Ø20, Ø22, Ø25)
  → Min bar count satisfying A_s,prov ≥ A_s,req
```

#### Kesme donatısı (etriye)

```
V_design (analiz çıktısı)
↓
V_c = 0.65 × f_ctd × b × d        (beton kesme dayanımı)
V_w = max(0, V_d - V_c)            (etriyenin taşıyacağı)
↓
A_sw / s = V_w / (f_ywd × d)       (etriye alanı / spacing oranı)
↓
Ø8 etriye seç → A_sw = 50 mm² (Ø8 çift bacaklı)
s = A_sw × f_ywd × d / V_w

# TBDY 2018 §7.4.5 ductility:
# Plastik mafsal bölgesi (mesnetten 2h içinde):
s_max = min(d/4, 8 × Ø_min, 100mm)
# Diğer bölge:
s_max = min(d/2, 200mm)
s_final = min(s_calc, s_max)
```

#### Detaylama
- Pas payı: 25-40mm (TS 500 §3.3.4)
- Bindirme uzunlukları (TS 500 §9.7): L_b = α × Ø × f_yd / (4 × f_bd)
- Bindirme bölgesi: basit kiriş orta 1/3, sürekli kiriş mesnet
- Çiroz donatıları (continuity bars)
- Kanca açıları (135° standartı)

### 6.6.2 Kolon design (eksenel + iki yönlü eğilme)

#### Boyuna donatı

```
N_design, M_design_x, M_design_y (analiz çıktısı)
↓
P-M etkileşim diyagramı kontrolü:
  Boyutsuz çıkış: ν = N/(b×h×f_cd), μ_x = M_x/(b×h²×f_cd), μ_y = M_y/(h×b²×f_cd)
  Donatı yüzdesi ρ_l deneyerek interaction diagram'da güvenli bölge
↓
ρ_min = 0.01 (TS 500 §7.3.4)
ρ_max = 0.04 (TBDY 2018 §7.3.2 — sünek bölge max)
↓
Symmetric reinforcement:
  Genelde her köşede 1 + ara çubuklar (kolonun her yüzünde min 3 bar)
↓
Bar count = perimeter × spacing kuralları
Min bar mesafesi: max(40mm, 1.5 × Ø, max_aggregate_size + 5mm)
```

#### Etriye

```
TBDY 2018 §7.3.4 sıkı sarılma bölgesi (kolon üst-alt 1/6 yükseklik veya min 50cm):
  s_max = min(b_w/3, 6 × Ø_min, 100mm)
Diğer bölge:
  s_max = min(b_w/2, 8 × Ø_min, 200mm)

Etriye Ø en az Ø8.

# Kapasite hesabı için minimum etriye:
A_sh ≥ k1 × s × b_c × (f_ck/f_yd) × [(A_g/A_c) - 1]
(TBDY 2018 Denklem 7.3)
```

### 6.6.3 Diğer hesap modülleri

- **Kapasite tasarım kontrolü** (TBDY §7.4.5): Σ M_kolon ≥ 1.2 × Σ M_kiriş
- **Burulma donatısı** (T büyükse): TS 500 §7.5
- **Punching shear** (döşeme-kolon birleşim): TS 500 §8.5
- **Foundation design**:
  - Tekil temel: q_t × A ≥ N (zemin emniyet gerilmesi)
  - Sürekli temel: kiriş gibi tasarla
  - Mat (raft): plak gibi tasarla, soft-soil etkisi

### 6.6.4 İş yükü tahmini

Kiriş + kolon design sıfırdan:
- Algoritma yazımı: 2 hafta
- TS 500 + TBDY parametre tabloları: 1 hafta
- Validation (sta4cad ile karşılaştırma): 2 hafta
- Detaylama edge case'ler: 1 hafta
- **Toplam: 6 hafta**

Sonra: foundation, slab, wall — her biri 2-3 hafta ek.

**Tam reinforcement engine: ~12-16 hafta** (3-4 ay).

## 6.7 Drawing Generation — teknik plan

### Klasör yapısı
```
src/services/cad_export/
├── __init__.py
├── styles.py                # Layer, dimension, text style tanımları
├── blocks.py                # Reusable bloklar (grid bubble, ok)
├── plan_view.py             # Kat planı çizici
├── beam_detail.py           # Kiriş açılım çizici
├── column_detail.py         # Kolon detay çizici
├── slab_plan.py             # Döşeme donatı çizici
├── schedule_table.py        # Eleman tablo çizici
├── title_block.py           # Antet çizici
├── reinforcement_design.py  # TS 500 + TBDY design
└── exporter.py              # Top-level: model + design → multi-sheet DXF
```

### Layer organization (CAD standartı)

```
Layer Adı           Renk    LineType    Kullanım
─────────────────  ──────  ──────────  ─────────────────────
0                   White   Continuous  Default
GRID                Cyan    Center      Akslar
GRID-BUBBLE         Cyan    Continuous  Aks kabarcıkları
GRID-TEXT           Cyan    Continuous  Aks etiketleri (A, B, 1, 2)
COLUMN              Red     Continuous  Kolon poligonları
COLUMN-HIDDEN       Red     Hidden      Üst kat kolon
BEAM                Green   Continuous  Kiriş çizgileri (orta hat)
BEAM-EDGE           Green   Continuous  Kiriş kenar çizgileri
SLAB                Yellow  Continuous  Döşeme kenarları
DIMENSION           Blue    Continuous  Ölçü çizgileri
TEXT                White   Continuous  Genel metin
TITLE-BLOCK         White   Continuous  Antet çerçevesi
REBAR               Magenta Continuous  Donatı çubukları
STIRRUP             Magenta Continuous  Etriye
SECTION-HATCH       Gray    Hatch       Kesit tarama
```

CAD operatörü layer'ları açıp kapatarak farklı görünümler alır (mimar, statik, donatı).

### Sayfa boyutu + ölçek
- Sayfa: A2 (594×420mm) ya da A3 (420×297mm)
- Plan ölçekleri: 1/50, 1/100, 1/200
- Detay ölçekleri: 1/20, 1/25, 1/50
- Antet sağ alt köşede (TR standardı)

### Block tasarımı

```python
import ezdxf

def create_grid_bubble_block(doc, label):
    """Aks kabarcığı: çember + içinde harf/sayı."""
    block = doc.blocks.new(name=f"GRID_{label}")
    block.add_circle((0, 0), radius=0.5)
    block.add_text(
        label,
        dxfattribs={"height": 0.3, "layer": "GRID-TEXT"},
    ).set_pos((0, 0), align="MIDDLE_CENTER")
    return block

# Plan'da kullanım:
msp.add_blockref("GRID_A", insert=(x_start, y_top + 1.0))
msp.add_blockref("GRID_1", insert=(x_start - 1.0, y_top))
```

### Plan view algoritması

```python
def draw_plan_view(msp, model, story_index, dimensions):
    z_story = model.story_levels[story_index]
    
    # 1) Akslar
    for x_axis in model.grid_x_axes:
        msp.add_line(
            (x_axis, model.bbox.y_min - 1, z_story),
            (x_axis, model.bbox.y_max + 1, z_story),
            dxfattribs={"layer": "GRID"},
        )
    # Y aksları benzer
    
    # 2) Aks kabarcıkları
    for i, x_axis in enumerate(model.grid_x_axes):
        msp.add_blockref(
            f"GRID_{string.ascii_uppercase[i]}",
            insert=(x_axis, model.bbox.y_max + 1.5),
        )
    # Y bubble: 1, 2, 3, ...
    
    # 3) Kolonlar
    for col in model.columns_at_story(story_index):
        b, h = col.section.t2, col.section.t3
        x, y = col.x, col.y
        msp.add_lwpolyline(
            [(x - b/2, y - h/2), (x + b/2, y - h/2),
             (x + b/2, y + h/2), (x - b/2, y + h/2)],
            close=True,
            dxfattribs={"layer": "COLUMN"},
        )
        msp.add_text(
            f"S{col.id}: {int(b*100)}×{int(h*100)}",
            dxfattribs={"layer": "TEXT", "height": 0.15},
        ).set_pos((x, y - h/2 - 0.3), align="MIDDLE_CENTER")
    
    # 4) Kirişler
    for beam in model.beams_at_story(story_index):
        # Centerline
        msp.add_line(beam.start, beam.end, dxfattribs={"layer": "BEAM"})
        # Edge lines (offset half-width)
        ...
        # Etiket
        ...
    
    # 5) Ölçüler (auto)
    for dim in dimensions:
        msp.add_aligned_dim(
            p1=dim.point1,
            p2=dim.point2,
            distance=dim.offset,
            dxfattribs={"layer": "DIMENSION"},
        )
    
    # 6) Story başlık
    msp.add_text(
        f"KAT {story_index + 1} PLANI ÖLÇEK 1/100",
        dxfattribs={"height": 0.5, "layer": "TEXT"},
    ).set_pos((model.bbox.x_min, model.bbox.y_max + 3))
```

### Beam reinforcement detail

```python
def draw_beam_detail(msp, beam, design_result):
    L = beam.length
    h = beam.section.t3
    b = beam.section.t2
    
    # 1) Yan görünüş (length × height, scale 1/25)
    msp.add_lwpolyline(
        [(0, 0), (L, 0), (L, h), (0, h)],
        close=True,
        dxfattribs={"layer": "BEAM-EDGE"},
    )
    
    # 2) Üst donatı (top reinforcement)
    cover = 0.04
    for bar in design_result.top_bars:
        x_start, x_end = bar.x_start, bar.x_end
        y = h - cover
        msp.add_line((x_start, y), (x_end, y), dxfattribs={"layer": "REBAR"})
        # Etiket: "3Ø16 L=560cm"
        msp.add_text(
            f"{bar.count}Ø{bar.diameter} L={bar.length*100:.0f}cm",
            dxfattribs={"height": 0.05, "layer": "TEXT"},
        ).set_pos((x_start + (x_end - x_start)/2, y + 0.05), align="MIDDLE_CENTER")
    
    # 3) Alt donatı benzer
    
    # 4) Etriye (vertical lines at design spacing)
    s = design_result.stirrup_spacing
    for x in range(0, int(L*100), int(s*100)):
        msp.add_line((x/100, cover), (x/100, h - cover), dxfattribs={"layer": "STIRRUP"})
    
    # 5) Cross-section view (üstüne, scale 1/10)
    cross_x = L + 2  # plan'ın yanında
    cross_y = 0
    # Rectangle b × h
    msp.add_lwpolyline(
        [(cross_x, cross_y), (cross_x + b, cross_y),
         (cross_x + b, cross_y + h), (cross_x, cross_y + h)],
        close=True,
        dxfattribs={"layer": "BEAM-EDGE"},
    )
    # Top bars (dots)
    for x_pos in design_result.top_bar_positions_in_section:
        msp.add_circle(
            (cross_x + x_pos, cross_y + h - cover),
            radius=design_result.top_bar_diameter / 2 / 100,
            dxfattribs={"layer": "REBAR"},
        )
    # Bottom bars benzer
    # Stirrup (rectangle inside)
    ...
    
    # 6) Section labels
    msp.add_text("KESİT A-A", ...)
    
    # 7) Bar list table (sağ tarafta)
    table_x = cross_x + b + 2
    msp.add_text("Pos | Dia | Length | Count | Total", ...)
    for i, bar in enumerate(design_result.all_bars):
        row_y = cross_y - i * 0.3
        msp.add_text(
            f"{i+1} | Ø{bar.diameter} | {bar.length*100}cm | {bar.count} | {bar.length*bar.count*100}cm",
            ...,
        )
```

## 6.8 IFC Export (BIM, opsiyonel)

**Industry Foundation Classes** — ISO 16739, BIM exchange standardı.

### Avantajlar
- **Tekla, Revit, ArchiCAD** otomatik açar
- **Mimari + statik + mekanik** tek dosyada
- BIM ihale şartları için zorunlu
- Modelin "anlamsal" yapısı korunur (kolon = IfcColumn, beam = IfcBeam, vs)

### ifcopenshell library
- Python pure
- 2024 v0.7+
- Pyodide uyumlu (büyük: ~5MB)

### Çıktı örneği
```python
import ifcopenshell

ifc = ifcopenshell.file(schema="IFC4")

# Project + site + building
project = ifc.create_entity("IfcProject", Name="My Building")
...

# Story
story = ifc.create_entity("IfcBuildingStorey", Name="1. Kat", Elevation=3.0)

# Column
col = ifc.create_entity("IfcColumn", Name="S1",
                        ObjectPlacement=...,
                        Representation=...,
                        )
# Material assignment, ...

ifc.write("model.ifc")
```

**İş yükü:** 2-3 hafta (modelden IFC mapping).

## 6.9 İmplementasyon yol haritası

### Faz 1 (2 hafta): Geometri-only DXF
- Layer setup, blok library
- Kat planı (akslar + kolonlar + kirişler + ölçüler)
- Antet
- Eleman tabloları (donatısız: sadece geometri)
- Multi-sheet (her kat ayrı)
- **Output:** AutoCAD'de açılır, mimar/inşaat firmasına yetebilir geometri kontrol için

### Faz 2 (6-8 hafta): Reinforcement Design Engine
- En zor kısım, sta4cad'ın asıl değeri
- **Validation kritik:** TBDY uzmanı ile 5-10 referans proje karşılaştır
- Tolerans: %2 fark kabul (yuvarlama farklılıkları)

### Faz 3 (3-4 hafta): Reinforcement Drawings
- Kiriş açılım sayfaları
- Kolon detay sayfaları
- Donatı tabloları
- Bar bending schedules

### Faz 4 (2-3 hafta): IFC export
- ifcopenshell entegrasyonu
- Model → IFC mapping
- Tekla/Revit'te test açma

### Faz 5 (1-2 hafta): UI + UX
- "Çizimleri Oluştur" butonu workspace'te
- Preview (PDF render of DXF)
- Template seçimi (TR standart, EU standart)
- Antet özelleştirme (logo, mühendis adı)

**Toplam tam pipeline: ~13-16 hafta** (3-4 ay).

## 6.10 Karşılaştırma — bizim avantajlarımız vs sta4cad

| Kriter | Sta4cad/ProBina | Build2AI (hedef) |
|---|---|---|
| Lisans | 3000-5000 EUR perpetual | SaaS aylık (10-50 EUR?) |
| Platform | Windows-only | Web (any OS) |
| Setup | Kurulum, dongle | Tarayıcı aç |
| AI desteği | Yok | Chat ile model edit |
| Online viz | Yok | 3D web view |
| Collaboration | Tek kullanıcı dosyası | Bulut + paylaşım |
| Output | DXF/DWG | DXF + IFC + PDF |
| Update | 1-2 yılda bir | Sürekli |
| Browser-side | Hayır | **Evet** (Pyodide ile DXF tarayıcıda üretilir) |

Bu değer önerisi güçlü. DXF export tamamlandıktan sonra ciddi rakip oluruz.

## 6.11 Risk + mitigasyon

| Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|
| TBDY hesabı yanlış | Orta | **Çok yüksek** | Senior CE eng review + 10 referans proje cross-check sta4cad |
| ezdxf Pyodide'da çalışmaz (gelecekte) | Düşük | Yüksek | Server fallback (zaten implementasyon hazır) |
| AutoCAD'te DXF açıldığında bozuk | Düşük | Orta | Test suite: 5 farklı CAD program (AutoCAD, BricsCAD, ZWCAD, FreeCAD, Solid Edge) ile doğrula |
| Detaylama Türkiye standardından sapma | Yüksek | Orta | Detay listesi → expert review checklist |
| Donatı tablosu format hatası | Düşük | Düşük | Standart şablon |

## 6.12 Implementation Status

- [ ] Faz 1 — Geometri DXF
  - [ ] Layer + style setup
  - [ ] Block library
  - [ ] Plan view per story
  - [ ] Element labels
  - [ ] Dimensions (auto)
  - [ ] Title block
  - [ ] Multi-sheet exporter
- [ ] Faz 2 — Reinforcement Design Engine
  - [ ] Beam flexural design
  - [ ] Beam shear/stirrup design
  - [ ] Column P-M-M interaction
  - [ ] Column stirrup design
  - [ ] Capacity design check (kapasite tasarımı)
  - [ ] Slab design
  - [ ] Foundation design
- [ ] Faz 3 — Reinforcement Drawings
  - [ ] Beam detail page
  - [ ] Column detail page
  - [ ] Slab plan
  - [ ] Bar bending schedule
- [ ] Faz 4 — IFC export
- [ ] Faz 5 — UI/UX

## Bağlantılar

- Browser-side execution (Pyodide): [03-rust-wasm-hybrid.md](./03-rust-wasm-hybrid.md)
- Generator (mevcut): `build2aiapi/src/services/structural_generator/`
