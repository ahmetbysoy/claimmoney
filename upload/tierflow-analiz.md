# Tierflow — Kod Analizi & Geliştirme Yol Haritası

Repo: `ahmetbysoy/tierflow` (TS/React, Binance/OKX order flow trading terminali, BOZOK_PRO'dan extract edilmiş modüller)

---

## 1. Mevcut Mimari — Modül Listesi

### Veri Katmanı
- **`WsManager`** (`ws/wsManager.ts`) — OKX/Binance arası WS adapter switch, exponential backoff reconnect, tab visibility pause/resume.
- **`OrderBookDiff`** (`book/orderBookDiff.ts`) — Map tabanlı incremental orderbook, `lastUpdateId` sequence kontrolü, mikroyapı metrikleri (spread, mid, OBI, microprice, bid/ask slope, heatmap history).
- **`CrossExchangePoller`** (`crossExchange/crossExchange.ts`) — Bybit/OKX/MEXC REST polling, arbitraj spread hesabı.

### İndikatör Katmanı (saf fonksiyonlar)
- **`cvd.ts`** — `calcCVD`, `calcCVDNorm`, `calcCVDZ`, `calcCVDZMulti` (multi-timeframe confluence), `detectDivergence` (adaptif eşikli fiyat/CVD diverjansı).
- **`imbalance.ts`** — `calcOBIRaw` (mesafe ağırlıklı order book imbalance), `updateOBI` (EMA smoothing).
- **`velocity.ts`** — `calcVelocity`, `calcVelocityZ` (fiyat hızı z-score).
- **`VPIN`** sınıfı (`vpin.ts`) — dinamik bucket boyutlu toxic flow ölçümü (Low/Medium/Toxic).

### Akış / Mikroyapı Katmanı
- **`FlowEngine`** (`flow/flowEngine.ts`) — zaman/hacim bazlı delta mumları, pressure/strength, absorption tespiti.
- **`DetectorSuite`** (`detectors/detectorSuite.ts`) — 9 dedektör: Wall, Compression, Skew, Liquidity Void, Ladder, Spoofing (2 türü), Iceberg, Flow Pattern (delta expansion + CVD divergence), Liquidation Cluster.

### Karar Katmanı
- **`filters.ts`** — `isFlatMarket` (ATR-adaptif yatay piyasa filtresi), `hasOBIConfluence`, `hasConfluence` (2/3 onay kuralı), `isHighArbitrageSpread`, `applyFilters` (hepsini birleştiren gate).
- **`SignalEngine`** (`engine.ts`) — tablo tabanlı FSM (`IDLE→ARMED→FIRED→COOLDOWN`), histerezis, `computeScore`/`computeConfidence`.
- **`TradePlanGenerator`** (`tradePlan.ts`) — sinyal confluence → Entry/SL/TP1/TP2/RR planı, Kelly kriterine dayalı pozisyon boyutlandırma, sinyal decay, narrative üretimi.

### Simülasyon / Ölçüm Katmanı
- **`PaperTradingEngine`** (`paperTrading.ts`) — plandan otomatik giriş, SL/TP takibi, PF/Sharpe/maxDD/equity curve.
- **`SignalTracker`** (`signalTracker.ts`) — sinyal başına forward-return (15s/30s/60s/300s/900s), MFE/MAE.

### Orkestrasyon
- **`dataStore.ts`** (zustand) — tüm yukarıdaki sınıfları instantiate edip trade/depth event'lerinde sırayla besliyor.

---

## 2. Mevcut Bağlanma Mantığı (dataStore.ts akışı)

```
WsManager (trade/depth event)
   │
   ├─ trade geldiğinde:
   │    tradeBuffer.push
   │    → calcCVDNorm/calcCVDZ, calcVelocity/Z, calcOBIRaw/updateOBI
   │    → flowEngine.updateBucket()
   │    → vpin.update()
   │    → globalTracker.updatePrice()
   │    → computeScore() → applyFilters() → engine.tick() → sinyal
   │    → tradePlanGenerator.generateTradePlan() → paperTradingEngine.simulateFromPlan()
   │
   └─ depth geldiğinde:
        orderBook.applySnapshot/applyDiff → recompute() → micro:update
        → detectorSuite.setData(book, micro, vpin, flowCandles, cvdHistory, liq, trades)
        → detectorSuite.run() → 9 dedektör → emit('signal:add')
              → tradePlanGenerator.addSignal(sig)
```

**Sorun:** İki ayrı skor üretim yolu var — (A) indikatör tabanlı `computeScore` → `SignalEngine.tick`, (B) `DetectorSuite` → `TradePlanGenerator.scoreSignals`. Bunlar birbirinden bağımsız çalışıyor, aralarında geri besleme yok. `detectorScore` sadece `computeScore`'a bir ağırlık (w6) olarak giriyor ama DetectorSuite'in ürettiği MicroSignal'lar `TradePlanGenerator` içinde ayrıca skorlanıyor. Yani aynı bilgi iki farklı karar mekanizmasında paralel işleniyor, senkronize değil.

## 3. Önerilen Mantıksal Bağlantı (Tek Karar Ağacı)

```
                    ┌─────────────┐
                    │  WsManager  │
                    └──────┬──────┘
              ┌────────────┴────────────┐
        trade event                depth event
              │                          │
   ┌──────────▼──────────┐    ┌──────────▼──────────┐
   │ CVD/OBI/Velocity/VPIN│    │   OrderBookDiff      │
   │ (indikatör katmanı)  │    │   (micro:update)     │
   └──────────┬──────────┘    └──────────┬──────────┘
              │                          │
              │                 ┌────────▼────────┐
              │                 │  DetectorSuite   │
              │                 │  (9 dedektör)    │
              │                 └────────┬────────┘
              │                          │
              └────────────┬─────────────┘
                            ▼
                 ┌─────────────────────┐
                 │  ScoreAggregator     │ ← YENİ: tek merkezi skor
                 │  (indikatör z-skor + │
                 │   detector confluence│
                 │   ağırlıklı birleşim)│
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │   applyFilters()     │ ← flat market, OBI, confluence, spread gate
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │   SignalEngine FSM    │
                 └──────────┬──────────┘
                            ▼
                 ┌─────────────────────┐
                 │ TradePlanGenerator    │ ← walls (DetectorSuite'ten), Kelly sizing
                 └──────────┬──────────┘
                     ┌──────┴──────┐
                     ▼             ▼
           PaperTradingEngine  SignalTracker
                     └──────┬──────┘
                            ▼
                 ┌─────────────────────┐
                 │  PerformanceFeedback  │ ← YENİ: winRate/PF'yi hem Kelly'ye
                 │  Loop                 │   hem de dedektör confidence'larına
                 └─────────────────────┘   geri besle (ağırlık öğrenmesi)
```

Kilit fikir: `DetectorSuite` sinyalleri artık sadece `TradePlanGenerator`'a değil, aynı zamanda `computeScore`'un `detectorScore` girdisine de confluence-ağırlıklı olarak besleniyor zaten (w6) — ama bunu **çift yönlü** yapmak lazım: `TradePlanGenerator.scoreSignals()` çıktısı da `SignalEngine`'in threshold/hysteresis kararına dahil edilmeli. Şu an SignalEngine tamamen `computeScore`'a bağımlı, DetectorSuite skorundan bihaber FSM state değiştiriyor.

---

## 4. Fonksiyon/Sınıf Bazlı Detaylı Geliştirme Fikirleri

### 4.1 `WsManager`
- Şu an tek sembol/tek kaynak. **Çoklu sembol multiplexing** ekle: tek WS bağlantısından birden fazla sembolü dinleyip `Map<symbol, adapter>` ile yönet — tarama (screener) modu için gerekli.
- Reconnect backoff sabit `Math.pow(2, n)` — 30sn cap var ama jitter sadece 500ms. Binance/OKX rate-limit ban'larında (418/429) `Retry-After` header'ını okuyup backoff'u ona göre ayarla.
- `hiddenPaused` mantığı iyi ama arka planda geldiğinde eski veriyle skorlama tutarsızlığı olabilir — resume anında **snapshot resync zorunlu tut** (şu an sadece reconnect tetikleniyor, orderbook'un stale olup olmadığı `isStale()` ile kontrol edilmiyor burada).

### 4.2 `OrderBookDiff`
- `microprice` hesabı iyi ama **VWAP-tabanlı microprice** (ilk N seviye ağırlıklı) eklenebilir — tek seviye best bid/ask'e duyarlı, spoof'a karşı kırılgan.
- `rollingSlope` sadece qty'ye bakıyor, price-level'daki **cluster yoğunluğunu** (level başına notional konsantrasyonu) ayrı bir metrik olarak çıkar — DetectorSuite'teki wall/ladder dedektörleri bunu tekrar hesaplıyor, burada bir kere hesaplanıp paylaşılabilir (DRY).
- `heatHistory` sınırsız büyüyebilir riski var (`heatmapWindowSec * 10` frame — 30s*10=300 frame, kabul edilebilir ama sembol değişiminde `reset()` çağrılmazsa memory leak). `dataStore`'da symbol switch akışını kontrol et.

### 4.3 CVD (`cvd.ts`)
- `calcCVDZMulti` iyi bir başlangıç (20/60 confluence). **3. timeframe ekle (240 period)** — üç timeframe'in hepsi aynı yönde ise "trend-aligned" bayrağı, sadece 20/60 ise "scalp-only" bayrağı ile ayrı ağırlıklandır.
- `detectDivergence` fiyat/CVD'nin sadece son 20s'lik pencerede tepe/dip kıyası yapıyor — **RSI-tarzı gizli/regüler diverjans ayrımı** yok. Regular divergence (trend dönüşü) ile hidden divergence (trend devamı) ayrı sinyal tipleri olarak çıkarılabilir, DetectorSuite'in `CVD_BEARISH_DIVERGENCE`'ı ile birleştirilebilir (şu an ikisi bağımsız, aynı olayı iki kere üretiyor olabilir → dedup gerekebilir).
- `adaptiveThreshold` güzel ama tamamen CVD std + price ATR ortalaması; **volume regime** (düşük likidite coin'lerde false-positive) faktörünü eklemek gerekir.

### 4.4 OBI (`imbalance.ts`)
- `decay=0.003` sabit — bu **sembole göre adaptif olmalı** (BTC'de 0.3% mesafe geniş, low-cap'te dar kalabilir). `spread/mid` oranına göre decay'i dinamikleştir.
- Sadece top-of-book ağırlıklı; **imbalance momentum** (OBI'nin kendi türevi, OBI_z gibi) eklenmemiş — CVD'de z-score var, OBI'de yok, tutarsızlık.

### 4.5 Velocity (`velocity.ts`)
- Basit fiyat hızı — **ivme (acceleration = d(velocity)/dt)** eklenmemiş. Ani hızlanma/yavaşlama (momentum exhaustion) tespiti için ikinci türev faydalı olur.
- `calcVelocityZ` window=30 sabit, multi-timeframe yok (CVD'de var, burada yok) — tutarlılık için aynı confluence mantığı (kısa/uzun) uygulanabilir.

### 4.6 `VPIN`
- Dinamik bucket boyutu (`rollingVol * 0.001`) mantıklı ama **volatilite rejimine göre** de ayarlanabilir — yüksek volatilitede daha küçük bucket, informed flow'u daha hızlı yakalar.
- `label` eşikleri (0.3/0.7) sabit — sembol bazlı kalibrasyon yok. Backtestle her sembol için persentil bazlı dinamik eşik (örn. son 1000 bucket'ın p70/p90'ı) hesaplanabilir.
- VPIN toxic olduğunda mevcut sistemde **pozisyon boyutunu otomatik küçültme** yok — `TradePlanGenerator`'a VPIN toxic durumunda Kelly fraction'ı düşüren bir çarpan eklenmeli (adverse selection riski).

### 4.7 `FlowEngine`
- `absorption` tespiti (yüksek hacim + düşük fiyat hareketi) iyi ama sadece boolean — **absorption strength** (0-100) skoru üretip `computeScore`'a girdi olarak eklenebilir (şu an sadece detector tarafında kullanılmıyor, kayıp bilgi).
- `volumeTarget` sabit 1M — DetectorSuite'teki `wallNotionalMultiplier` gibi **medyan işlem hacmine göre adaptif** yapılabilir.
- Time-mode'dan volume-mode'a otomatik geçiş: düşük volatilite dönemlerinde time-based mumlar boş kalabilir, **hybrid mode** (hangisi önce dolarsa kapat) eklenebilir.

### 4.8 `DetectorSuite` (en kritik dosya — 9 dedektör)
1. **Wall Detection** — `refreshCount` iyi bir ek. Öneri: wall'ın **fiyata göre relative konumu** (mid'e mesafe) confidence hesabına dahil değil; yakın wall'lar uzaklardan daha anlamlı olmalı.
2. **Compression** — sadece `compressionActive` boolean state; **sıkışma süresi** de tutulup süre arttıkça confidence yükseltilebilir (patlama olasılığı süreyle korele).
3. **Skew** — basit notional oranı; **zaman içindeki skew trendini** (skew momentum) eklemek anlık gürültüyü azaltır.
4. **Liquidity Void** — sadece ilk 10 seviyede tek gap arıyor (`break` var, ilk bulduğunda duruyor) — **birden fazla void'i** toplayıp en büyüğünü seçmek daha isabetli olur.
5. **Ladder** — sadece bid tarafı kontrol ediliyor (`this.state.walls.bid`), **ask tarafı ladder'ı hiç kontrol edilmiyor** — bariz eksik, simetrik olarak eklenmeli.
6. **Spoofing** — iki alt-tip (pull + high-refresh) var, iyi. Ama `priceDist > 0.0015` sabit eşik sembole göre kalibre değil.
7. **Iceberg** — `recentTrades.slice(-80)` sabit pencere; **zaman bazlı pencere** (son N saniye) daha tutarlı olur, çünkü işlem hızı sembole göre çok değişir.
8. **Flow Patterns** — delta expansion + CVD divergence burada da var (cvd.ts'teki `detectDivergence` ile örtüşüyor, bkz 4.3). **Tek bir divergence modülüne konsolide et.**
9. **Liquidation Cluster** — `liquidations` verisi `setData`'dan geliyor ama repo'da liquidation WS feed'i bağlayan bir adapter görünmüyor (kontrol edilmeli — muhtemelen boş array geliyor, dedektör hiç tetiklenmiyor olabilir).

**Genel öneri:** `emitSignal` her dedektörden bağımsız event atıyor, `TradePlanGenerator.addSignal`'daki dedup 10sn+0.05% ile sınırlı. **Dedektörler arası confluence matrisi** eklenebilir (örn. wall + skew + spoofing aynı anda aynı yönde tetiklenirse ekstra confidence bonusu) — şu an sadece `scoreSignals()` ağırlıklı toplam yapıyor, kombinasyon bonusu yok.

### 4.9 `filters.ts`
- `isFlatMarket` ATR-adaptif — iyi. Ama **hacim bazlı flat filtresi** yok (fiyat hareket etmiyor ama hacim de düşükse farklı, hacim yüksek ama fiyat sabitse absorption — flowEngine'in absorption'ı ile birleştirilebilir).
- `hasConfluence` sabit minZ=0.30, 2/3 kural — **VPIN'i de confluence'a dahil et** (4. indikatör), 2/4 veya 3/4 gibi ağırlıklı bir oy sistemine geçilebilir.
- `applyFilters` sırayla erken çıkıyor (ilk fail eden reason döner) — debug için **tüm filtrelerin sonucunu** (hangi geçti hangi geçmedi) toplu döndürmek UI/log açısından faydalı olur.

### 4.10 `SignalEngine`
- FSM tasarımı temiz (tablo-driven, XState'e geçişe hazır). `WAITING_CONFIRMATION` state'i yorum satırında planlanmış ama implement edilmemiş — **öncelikli geliştirme**: FIRED öncesi bir "onay bekleme" state'i eklemek, tek tick'lik yanlış pozitifleri azaltır.
- `hysteresis` sabit 0.35 — **volatiliteye adaptif hysteresis** (ATR'ye göre) tutarlılığı artırır.
- `cooldownMs=18000` sabit — sembolün ortalama sinyal sıklığına göre dinamikleştirilebilir (çok hareketli coin'de kısa, sakin coin'de uzun).

### 4.11 `TradePlanGenerator`
- `scoreSignals()` sadece son 30sn'lik sinyalleri topluyor, DetectorSuite'in ürettiği sinyal tipleri arasında **ağırlık farkı yok** (tüm sinyal tipleri eşit confidence formülüyle toplanıyor) — spoofing gibi daha "gürültülü" sinyal tipleri ile wall gibi daha "güvenilir" tipler için **tip bazlı çarpan** eklenmeli.
- Kelly hesabı (`calculateMicroOptimizer`) cold-start winRate=0.42 makul. Ama **sembol bazlı ayrı performans havuzu** yok — tüm semboller aynı `performance` objesini paylaşıyorsa (dataStore'a bakmak lazım) BTC'nin performansı altcoin kararını etkiler, riskli.
- `generateTradePlan` wall'lara göre SL/TP ayarlıyor — **likidasyon haritasını** (DetectorSuite'in `LIQUIDATION_CLUSTER`'ı) TP hedefi olarak da kullanmak mantıklı (likidasyon kümesi = magnet fiyat seviyesi).

### 4.12 `PaperTradingEngine`
- SL/TP kontrolü `update(price)` her tick'te lineer kontrol ediyor — pozisyon sayısı arttıkça O(n) ama küçük ölçekte sorun değil.
- **Kısmi kapama yok**: TP1'e ulaşınca pozisyon direkt "tp1" ile tamamen kapanıyor gibi görünüyor (`close` çağrılıyor) — TP1'de %50 kapatıp kalanını TP2'ye taşıyan **partial exit** mantığı gerçekçi trading'e daha yakın olur.
- Sharpe/PF hesapları closedPositions üzerinden her `close()`'da O(n) yeniden hesaplanıyor — pozisyon sayısı arttıkça (maxClosedHistory=500) performans sorunu olabilir, **incremental (running) hesaplama**ya çevrilebilir.

### 4.13 `SignalTracker`
- Forward-return ölçümü (15s-15dk) analiz için değerli. **Bu veriyi TradePlanGenerator'ın confidence formülüne geri besleyen bir öğrenme döngüsü yok** — en büyük eksik. `getStats()` çıktısı (win rate per horizon) sadece raporlama için kullanılıyor, karar mekanizmasına girmiyor. Öneri: her N sinyalde bir `win60s` oranı düşükse ilgili sinyal tipinin/detector'ün ağırlığını otomatik azalt (basit bir online learning / bandit yaklaşımı).

### 4.14 `CrossExchangePoller`
- REST polling 3sn — arbitraj sinyali için biraz yavaş, ama WS'e geçmek (Bybit/OKX/MEXC ticker stream) karmaşıklığı artırır; mevcut kullanım (arbitraj context) için REST kabul edilebilir.
- `getMaxSpread()` sadece bid/ask spread'e bakıyor, **fee + funding rate farkını** hesaba katmıyor — gerçek arbitraj fırsatı için gerekli.

---

## 5. Öncelik Sırası (Pratik Yol Haritası)

1. **Ladder dedektöründe ask tarafı eksikliğini düzelt** (4.5) — tek satırlık bariz bug.
2. **CVD divergence duplikasyonunu birleştir** (cvd.ts + detectorSuite.ts) — çift sinyal, karışıklık kaynağı.
3. **DetectorSuite skoru ↔ SignalEngine arasında tek karar ağacı kur** (bölüm 3) — mimarideki en büyük yapısal eksik.
4. **SignalTracker → TradePlanGenerator geri besleme döngüsü** (4.13) — sistemi statik kural setinden adaptif hale getirir.
5. **VPIN toxic durumunda Kelly fraction düşürme** (4.6) — risk yönetimi iyileştirmesi, düşük efor/yüksek etki.
6. **WAITING_CONFIRMATION state'ini implement et** (4.10) — zaten planlanmış, kod hazır altyapıya sahip.

Hangi maddeden başlamak istersin, direkt patch yazabilirim.
