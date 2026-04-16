# 02 — Async İş Kuyruğu (Heavy Fallback Mimari)

> **Konu:** Browser'da çalıştırılamayan büyük analizler (TH/Pushover heavy, çok büyük static) için server-side worker pool. arq + Redis seçimi, RabbitMQ alternatifi, job lifecycle.

## 2.1 Ne zaman queue gerekir?

Rust+WASM hibrit mimaride server'a delege edilen işler:

| Senaryo | Browser | Server queue |
|---|---|---|
| Linear static < 5K DOF | ✅ | ❌ |
| Linear static 5K-20K DOF | ⚠️ | ✅ optional |
| Linear static > 20K DOF | ❌ | ✅ |
| Modal < 20K DOF | ✅ | ❌ |
| Modal Time History (orta) | ✅ | ❌ |
| **Direct Time History (büyük)** | ❌ | **✅ ZORUNLU** |
| **Pushover (büyük model)** | ❌ | **✅ ZORUNLU** |
| **Batch analiz** (100 farklı senaryo) | ❌ | **✅ ZORUNLU** |
| AI chat (intent + LLM) | ❌ | ✅ ama queue gerekmez (sync stream) |

Queue ihtiyacı **az ama kritik** — heavy analizler 1-30 dakika sürer, HTTP timeout yer.

## 2.2 Seçenek karşılaştırması

### Karşılaştırma matrisi

| Kriter | Celery+Redis | **arq+Redis** | RabbitMQ+Celery | dramatiq+Redis |
|---|---|---|---|---|
| FastAPI uyumu (async) | Sync bridge gerekir | **Native async** | Sync bridge | İyi |
| Worker RAM | 200-400MB | **50-100MB** | 200-400MB | 100-200MB |
| Broker RAM | Redis ~50MB | Redis ~50MB | RabbitMQ ~500MB+ | Redis ~50MB |
| Setup karmaşıklığı | Orta | **Düşük** | Yüksek | Düşük |
| Monitoring | Flower (web UI) | CLI + redis-cli | RabbitMQ mgmt UI + Flower | dramatiq-dashboard |
| Cron/scheduling | beat (ayrı process) | **Built-in** | beat | apscheduler |
| Complex DAG (chord/group) | ✅ Mükemmel | ⚠️ Sınırlı | ✅ Mükemmel | ✅ İyi |
| Olgunluk | ★★★★★ (12+ yıl) | ★★★★ (6 yıl) | ★★★★★ | ★★★ |
| Bizim için | Overkill | **Sweet spot** | Aşırı overkill | Alternatif |

### Detaylı analiz — arq neden seçildi

**arq avantajları:**
- FastAPI **zaten async** — arq da async-native, sıfır impedance mismatch
- Pydantic ile uyumlu (type-safe job args)
- Redis'i hem broker hem result backend hem pubsub olarak kullanır (tek servis)
- Solo developer için bakım yükü minimum (8-10 yapılandırma yeri vs Celery'nin 50+)
- Job retry, scheduling, cron built-in
- Worker process izole olduğu için crash bir job'u etkiler, system'e zarar vermez

**arq dezavantajları:**
- Web UI yok (Flower yok)
- Complex DAG'lar (chord, group, chain) sınırlı
- Topluluk Celery'den küçük
- Stack Overflow cevap sayısı az

**Bizim için:** Job'lar çoğu **basit** (analiz job, sonuç ver). Kompleks DAG'a ihtiyaç yok. Web UI olmaması Redis CLI ile telafi edilebilir.

### Neden Celery+RabbitMQ değil?

Sap2000 benzeri kurumsal yazılımlarda RabbitMQ klasik. Ama:
- **RAM:** RabbitMQ Erlang VM ~500MB minimum, küçük sunucuda büyük yük
- **Ops karmaşıklığı:** Cluster setup, monitoring, version migration çok dert
- **Single-tenant'a overkill:** Multi-tenant ile multi-region değiliz, RabbitMQ'nun routing avantajları kullanılmaz
- **DevOps zaman:** Solo dev için RabbitMQ konfigüre etmek 1-2 hafta süre alır, Redis 30 dakika

**Karar:** arq + Redis ile başla. İhtiyaç olursa Celery + RabbitMQ'ya geç (broker katmanı abstract'lanabilir).

## 2.3 Mimari plan

```
┌────────────────────────────────────────────────────┐
│  Frontend (browser)                                │
│                                                    │
│  Kullanıcı: "Bu büyük modeli TH ile çöz"           │
│       │                                            │
│       │ POST /api/jobs/heavy-analysis              │
│       │  body: { analysis_type, params, file_id }  │
│       ▼                                            │
│  ┌──────────────────────────┐                      │
│  │ FastAPI                  │                      │
│  │  - validate request      │                      │
│  │  - enqueue job           │                      │
│  │  - return { job_id }     │                      │
│  └──────────┬───────────────┘                      │
│             │                                      │
│             │ enqueue                              │
│             ▼                                      │
│  ┌──────────────────────────┐                      │
│  │ Redis                    │                      │
│  │  - job:queue (sorted set)│                      │
│  │  - job:status:{id}       │                      │
│  │  - pubsub channel        │                      │
│  └──────┬───────────────────┘                      │
│         │ poll                                     │
│         ▼                                          │
│  ┌──────────────────────────┐                      │
│  │ arq Worker (1-N)         │                      │
│  │  - dequeue                │                     │
│  │  - run analysis (Rust)   │                      │
│  │  - publish progress      │                      │
│  │  - upload result Storage │                      │
│  │  - update Firestore      │                      │
│  └──────────────────────────┘                      │
│                                                    │
│  Frontend tekrar:                                  │
│       │                                            │
│       │ WS /api/jobs/{id}/stream                   │
│       │  ←── { type: "progress", percent: 42 }     │
│       │  ←── { type: "complete", result_url: ... } │
│       ▼                                            │
│  3D viz başlar                                     │
└────────────────────────────────────────────────────┘
```

## 2.4 Job lifecycle — detaylı

### 1. Submit
```python
# FastAPI route
@router.post("/api/jobs/heavy-analysis")
async def submit_heavy_job(req: HeavyAnalysisRequest, ctx: ArqRedis = Depends(get_arq)):
    job = await ctx.enqueue_job(
        "run_time_history",
        file_id=req.file_id,
        ground_motion_id=req.gm_id,
        params=req.params.model_dump(),
        _job_timeout=1800,  # 30 dk
    )
    return { "job_id": job.job_id, "status": "queued" }
```

### 2. Worker pickup
```python
# arq worker
async def run_time_history(ctx, file_id: str, ground_motion_id: str, params: dict):
    redis = ctx['redis']
    job_id = ctx['job_id']
    
    # Progress yardımcıları
    async def progress(stage: str, pct: float, msg: str = ""):
        await redis.publish(
            f"job:{job_id}:progress",
            json.dumps({ "stage": stage, "percent": pct, "msg": msg }),
        )
    
    await progress("loading", 0, "Dosya indiriliyor")
    s2k_text = await storage_service.download(...)
    
    await progress("parsing", 5, "Model parse ediliyor")
    model = parse_s2k(s2k_text)
    
    await progress("assembly", 15, "Stiffness matrix")
    K, M = assemble_KM(model)
    
    await progress("modal", 25, "Modal analiz")
    modes = solve_modal(K, M)
    
    await progress("integration", 30, "Time history integrasyonu")
    # Rust kernel via PyO3
    history = rust_lib.newmark_th(K, M, modes, ground_motion, dt=0.005)
    # ... progress 30 → 90 internally
    
    await progress("recovery", 90, "Kesit tesirleri envelope")
    envelope = compute_envelope(history, model)
    
    await progress("upload", 95, "Sonuç kaydediliyor")
    result_path = await storage_service.upload_gzip(...)
    
    # Firestore'a tamamlandı yaz
    await analysis_repository.mark_complete(...)
    
    await progress("complete", 100)
    return { "result_path": result_path, "envelope_summary": ... }
```

### 3. Frontend WebSocket
```typescript
const ws = new WebSocket(`wss://api.../api/jobs/${jobId}/stream`)
ws.onmessage = (e) => {
  const data = JSON.parse(e.data)
  if (data.type === 'progress') {
    progressBar.value = data.percent
    progressText.value = data.msg
  } else if (data.type === 'complete') {
    // Sonucu indir
    fetchAnalysisResult(data.result_url)
    show3DViz()
  }
}
```

### 4. WebSocket sunucusu (FastAPI)
```python
@router.websocket("/api/jobs/{job_id}/stream")
async def job_stream(ws: WebSocket, job_id: str, redis: Redis = Depends(get_redis)):
    await ws.accept()
    pubsub = redis.pubsub()
    await pubsub.subscribe(f"job:{job_id}:progress")
    
    try:
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                await ws.send_text(msg["data"])
                if json.loads(msg["data"])["stage"] == "complete":
                    break
    finally:
        await pubsub.unsubscribe()
        await ws.close()
```

## 2.5 Failure handling

### Retry policy
```python
# arq job tanımı
async def run_time_history(ctx, ...):
    ...

class WorkerSettings:
    functions = [run_time_history]
    max_tries = 3              # Otomatik retry
    job_timeout = 1800          # 30 dk
    keep_result_forever = False
    keep_result = 3600          # Sonuç 1 saat Redis'te kalır
```

### Failure modlları + handling
| Failure | Action |
|---|---|
| Worker crash mid-job | Redis 30 sn sonra requeue, başka worker alır |
| Job timeout (30 dk +) | Otomatik fail, kullanıcıya "model çok büyük" |
| Out of memory | Worker process restart, bu job fail kalır |
| Bad input (parse fail) | Hemen fail, retry yapma |
| LLM API down (eğer AI gerekiyor) | Retry 3 kez, sonra fail |
| Storage upload timeout | Retry 5 kez (geçici network) |

### Dead letter
Final fail olan job'lar Redis'te `failed_jobs:` set'ine yazılır. Ops dashboard bunları görür, manuel inceler.

## 2.6 Worker scaling

### İlk başlangıç
**Tek worker.** Hetzner CPX41'de:
- Main FastAPI: 2 vCPU, 1.5GB RAM
- Redis: 0.5GB
- Worker (arq): 4-6 vCPU, 6-8GB RAM
- Buffer: 2-3GB

Tek worker'ın eş zamanlı job sınırı 1 (CPU bound). Yani 30 dakikalık 4 job = 2 saat queue waiting.

### Scaling stratejisi
- **Vertical:** CPX51 (16 vCPU, 32GB) — €36/ay → 2-3 worker eş zamanlı
- **Horizontal:** Workers-only ek sunucu (CPX31, €10/ay) — Redis'e bağlanıp job çekerler

### Otomatik scaling (ileri faz)
Hetzner Cloud API ile **on-demand worker spawn**:
```
queue_length > 5 → yeni worker droplet aç
queue_length == 0 ve 5 dk → workers'ı kapat
```

İlk faz için OVERKILL. Manuel monitoring yeterli.

## 2.7 Monitoring

### Critical metrics
| Metric | Hedef | Alarm |
|---|---|---|
| Queue length | < 3 | > 10 ise alert |
| Average job duration | < 10 dk | > 20 dk ise alert |
| Failure rate | < 5% | > 10% ise alert |
| Worker memory | < 6GB | > 7.5GB ise alert |
| Redis memory | < 200MB | > 500MB ise alert |

### Tooling
- **arq CLI:** `arq --check` — worker health
- **Redis CLI:** `redis-cli --scan`, `redis-cli MONITOR`
- **Prometheus + Grafana** (ileri faz, queue metrik dashboard)
- **Sentry** (hata tracking)
- **Logflare/Logtail** (centralized logging)

## 2.8 Docker compose örneği

```yaml
version: '3.8'

services:
  app:
    build: ./backend
    command: uvicorn main:app --host 0.0.0.0 --workers 2
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          memory: 1.5G

  worker:
    build: ./backend
    command: arq worker.WorkerSettings
    environment:
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 6G

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          memory: 512M

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app

volumes:
  redis-data:
```

## 2.9 Maliyet analizi

### Hetzner CPX41 (16GB / 8 vCPU) — €18/ay
- App + Worker + Redis + Nginx hepsi sığar
- 1 worker = ~10 heavy job/saat throughput
- Daily cap: 240 heavy job
- Bu kapasite ~50-100 aktif kullanıcıya yeter (kullanıcı başına haftada 1-2 heavy job)

### Scale up tetikleyiciler
- Daily heavy job > 300 → 2. worker (vertical: CPX51 €36)
- Daily heavy job > 700 → 3. worker (horizontal: ek CPX31 €10)
- Daily heavy job > 1500 → managed Redis cluster + 5 worker farm

### Karşılaştırma — Numba/server-only mimari (eğer Yol C seçilmeseydi)
- Sürekli %80+ server CPU yükü
- 2× sunucu lazım her 1000 user için
- Aylık maliyet: €200-500 (vs Yol C €18-50)

## 2.10 Implementation Status

- [ ] arq + Redis Docker compose kurulumu
- [ ] FastAPI `/api/jobs/heavy-analysis` endpoint
- [ ] WebSocket `/api/jobs/{id}/stream` (Redis pubsub)
- [ ] arq worker template (run_time_history, run_pushover)
- [ ] Failure handling + retry logic
- [ ] Frontend job submission UI
- [ ] Frontend progress bar + WebSocket client
- [ ] Monitoring (Prometheus opsiyonel)

## Bağlantılar

- Time History job içeriği: [05-time-history.md](./05-time-history.md)
- Pushover job içeriği: [07-pushover.md](./07-pushover.md)
- Server kapasite: [00-overview.md](./00-overview.md)
