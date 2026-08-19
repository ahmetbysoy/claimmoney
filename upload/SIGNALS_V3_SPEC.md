# Signals V3 — Evidence Tape Specification

**Durum:** Draft / görüşmeye açık  
**Kapsam:** Foundation contrast polish + Signals ekranı yeniden tasarımı  
**Hedef taban:** `0a8de4b` — Chart V3 production baseline  
**Tarih:** 2026-08-19

## 1. Karar özeti

Signals V3, mevcut yoğun sinyal kartı listesini Obsidian/Ion kimliğine sahip bir **Evidence Tape** görünümüne dönüştürür.

Temel model:

1. **Glance:** Yön, zaman, fiyat, skor gücü ve takip durumu.
2. **Detail:** Horizon sonuçları, canlı return, MFE/MAE ve skor bileşenleri.
3. **Evidence:** Filtre kararları, araştırma bağlamı, detector türleri ve strategy version.

İlk sürümde detaylar erişilebilir bir inline disclosure ile açılır. Modal veya gesture zorunluluğu yoktur. Bu tercih; mobil/desktop davranışını aynı semantik DOM üzerinde tutar, stacking problemi üretmez ve klavye kullanımını korur.

## 2. Problem tanımı

Mevcut `SignalsScreen` doğru runtime verisini kullanıyor ancak tek kartta çok fazla bilgiyi aynı görsel ağırlıkla sunuyor:

- BUY/SELL yönü ve zaman,
- fiyat, skor ve güç,
- CVD/OBI/VEL,
- 15s, 30s, 60s, 5m ve 15m horizon sonuçları,
- canlı return, MFE ve MAE,
- takip/kapanış durumu.

Ayrıca `Signal` üzerinde bulunan bazı gerçek kanıt alanları arayüzde hiç gösterilmiyor:

- `calibratedProbability`,
- `filters`,
- genişletilmiş `breakdown` alanları,
- `research` context,
- `strategyVersion`,
- `exchange` ve `symbol` context.

Sonuç olarak ekran hem yoğun hem de veri modelinin sunduğu kanıtı eksik kullanıyor.

## 3. Hedefler

- Bir sinyalin yönü ve mevcut takip durumu bir bakışta anlaşılmalı.
- Destekleyici kanıt açık kullanıcı isteğiyle görünmeli.
- Mevcut gerçek `Signal`, `Tracker` ve `TrackerStats` verileri kullanılmalı.
- Skor gücü ile ampirik olasılık birbirinden açıkça ayrılmalı.
- Olgunlaşmamış horizon, sıfır sonuç gibi gösterilmemeli.
- Örnek sayısı olmayan win-rate/ortalama alanları `0%` yerine `—` göstermeli.
- Mobile yerleşim yalnızca desktop grid'inin tek sütuna düşürülmüş hali olmamalı.
- Ekranın kendine özgü “event/evidence tape” kimliği olmalı; generic panel yığını olmamalı.
- Klavye, ekran okuyucu, touch ve reduced-motion sözleşmeleri korunmalı.
- Kök viewport yatay taşmamalı.

## 4. Non-goals

Signals V3 şunları yapmaz:

- Sinyal motoru, eşikler, FSM veya risk davranışını değiştirmez.
- Canlı strategy weight öğrenmez veya optimize etmez.
- Yeni sinyal, geçmiş sonuç veya fiyat üretmez.
- Profitability veya statistical significance iddiası eklemez.
- Sinyalleri swipe-to-dismiss ile silmez.
- Gesture-only detay veya filtre kontrolü eklemez.
- Olmayan history, timeframe veya korelasyon grafiği üretmez.
- `confidence` değerini kalibre olasılık gibi adlandırmaz.
- Real-money execution kontrolü eklemez.
- Yeni UI/chart dependency eklemeyi gerektirmez.

## 5. Mevcut veri sözleşmesi

### 5.1 Signal

Kullanılabilir gerçek alanlar:

- `id`
- `symbol?`
- `exchange?`
- `side`
- `price`, `priceStr?`
- `confidence`
- `calibratedProbability?`
- `score`
- `breakdown.cvd`
- `breakdown.obi`
- `breakdown.vel`
- opsiyonel `micro`, `vpin`, `detector`, `divergence`
- `filters?`
- `frameId?`
- `strategyVersion?`
- `research?`
- `ts`

### 5.2 Tracker

- `signalId`
- `entry`, `entryTs`
- `horizons['15s' | '30s' | '60s' | '300s' | '900s']`
- `live`
- `mfe`
- `mae`
- `closed`
- `lastPriceTs`

### 5.3 TrackerStats

- Horizon başına gerçek `count`, `wins`, `winRate`, `average`, `median`
- `avgMfe`, `avgMae`
- Eski uyumluluk alanları: `win15s`, `win60s`, `win300s`, sample count'lar

Yeni UI mümkün olduğunca `stats.horizons[key]` sözleşmesini doğrudan kullanır.

## 6. Doğruluk kuralları

### 6.1 Güç ve olasılık

- `signal.confidence` etiketi **Skor gücü** olur.
- `%` görseli korunabilir ancak probability dili kullanılmaz.
- `signal.calibratedProbability` yalnızca finite ve null olmayan durumda gösterilir.
- Bu alanın etiketi **Kalibre olasılık** olur.
- Kalibre olasılık yoksa placeholder veya tahmin üretilmez; alan hiç render edilmez.

### 6.2 Horizon sonuçları

- `null` horizon değeri `Bekliyor` olarak gösterilir.
- `0` gerçek bir sonuçtur ve `0.00%` olarak gösterilir.
- Pozitif/negatif ton yalnızca finite olgun değere uygulanır.
- 300s UI etiketi `5m`, 900s etiketi `15m` olabilir; veri anahtarı değişmez.

### 6.3 Özet istatistikleri

- `count === 0` iken win rate ve average `0%` göstermez; `—` gösterir.
- Win rate yanında her zaman `n={count}` bulunur.
- Average ve median yalnızca aynı horizon'ın olgun örneklerinden gelir.
- MFE/MAE yalnızca mevcut tracker implementasyonunun eligible örnek tanımını kullanır.
- “Başarılı”, “kârlı”, “kanıtlandı” gibi metinler kullanılmaz.

### 6.4 Takip durumu

Presentation-only durum türetilir; store'a yeni domain state eklenmez:

- Tracker yok: `Takip başlatılıyor`
- Tracker var, 15s null: `15s bekleniyor`
- Tracker açık: sıradaki null horizon örneğin `60s bekleniyor`
- Tüm horizonlar dolu veya `closed`: `15m tamamlandı`

Bu etiketler yalnızca tracker'ın mevcut gerçek durumunu açıklar.

### 6.5 Test sinyalleri

- `signal.research?.isTest === true` ise açıkça `TEST` badge gösterilir.
- Test sinyalleri normal runtime sinyalinden görsel olarak ayırt edilir.
- Test sinyali sonuçları toplu performans iddiasına dönüştürülmez.

## 7. Foundation contrast polish

Signals V3 öncesinde küçük ve izole bir token düzenlemesi yapılır.

Mevcut ölçüm:

- `--text-muted #786f8c` / `--bg-panel #15121e`: yaklaşık `3.91:1`
- `--accent #8b5cf6` / `--bg-panel #15121e`: yaklaşık `4.36:1`

### 7.1 Token önerisi

- `--text-muted` için başlangıç adayı: `#857b9c`
- Yeni `--accent-text` için başlangıç adayı: `#b8a6f2`
- `--accent` Ion Violet grafik, selection ve dekoratif kullanım için korunur.
- Küçük accent metinleri `--accent-text` kullanır.
- Form/kontrol sınırları gerekli yerlerde en az 3:1 non-text contrast sağlayacak ayrı control-border tokenı kullanabilir.

### 7.2 Kabul kriteri

- Normal boyuttaki muted ve accent metinler kullandıkları ana yüzeylerde en az WCAG AA 4.5:1 kontrast sağlar.
- BUY/SELL/warning semantiği değişmez.
- Renk tek başına durum bildirmez; metin veya ikon eşlik eder.
- Radar ve Chart görsel kimliği regresyona uğramaz.

## 8. Bilgi mimarisi

Ekran sırası:

1. Screen heading ve runtime kayıt durumu
2. Observed outcome rail
3. Direction filter
4. Evidence Tape
5. Gözlemsel veri uyarısı

## 9. Üst özet — Observed Outcome Rail

Dört metrik:

1. **Kayıt** — `signals.length`
2. **Takipte** — `trackers.filter(item => !item.closed).length`
3. **60s win** — `stats.horizons['60s'].winRate`, `n` ile
4. **60s ort.** — aynı horizon'ın `average`, alt metinde `median`

Kurallar:

- `n=0` ise sonuç `—`.
- Rail mobilde ekran dışına root overflow üretmez.
- Gerekirse kendi içinde erişilebilir yatay scroll olabilir; sticky kart kullanılmaz.
- Summary, geleceğe yönelik karar veya başarı claim'i içermez.

## 10. Evidence Tape

### 10.1 Görsel kimlik

- Dikey event spine
- BUY için emerald event node
- SELL için red event node
- Test sinyali için ek `TEST` metni; yalnızca renk farkı kullanılmaz
- Ion Violet yalnızca selection, disclosure ve model/evidence vurgu rengi
- Kartlar nested panel yığını gibi görünmez; tape üzerinde event row olarak davranır

### 10.2 Glance row

Her event'in kapalı durumunda görünür:

- BUY/SELL badge
- Absolute timestamp
- Fiyat
- Signed score
- Skor gücü
- Takip durumu
- Varsa calibrated-probability badge
- Detayı aç/kapat butonu

Buton metni:

- Kapalı: `Kanıtı göster`
- Açık: `Kanıtı gizle`

Buton `aria-expanded` ve `aria-controls` kullanır.

### 10.3 Detail layer

Açıldığında üç bölüm görünür.

#### A. Outcome matrix

- 15s
- 30s
- 60s
- 5m
- 15m
- Live
- MFE
- MAE

Bekleyen horizon açıkça `Bekliyor` gösterir.

#### B. Model evidence

Her zaman:

- CVD
- OBI
- Velocity

Yalnızca mevcutsa:

- Microprice
- VPIN
- Detector
- Divergence

Sıfır finite bir kanıt değeridir; saklanmaz.

#### C. Approval and research context

Yalnızca veri varsa:

- Hard-veto ve soft-penalty filter kararları
- Regime ve regime confidence
- Data quality
- Detector türleri
- Volatility bps
- Spread bps
- VPIN
- Strategy version
- Symbol / exchange
- Frame ID, kullanıcıya yararlı olacaksa kısaltılmış teknik reference olarak

Filter kararı için pass/fail metni bulunur; salt yeşil/kırmızı nokta kullanılmaz.

## 11. Filtreleme

İlk Signals V3 sürümünde yalnızca mevcut ve anlaşılır yön filtresi korunur:

- Tümü
- Alım
- Satım

Değişiklikler:

- Kontroller role/button + `aria-pressed` kullanır.
- Mobilde yatay chip düzeni olabilir ancak üç kontrol de gesture olmadan görünür/erişilir kalır.
- Sonuç sayısı live region değildir; gereksiz screen-reader gürültüsü oluşturmaz.
- Yeni maturity/search/sort filtresi bu sürümün kapsamına eklenmez.

## 12. Responsive davranış

### 12.1 Desktop, `> 900px`

- Outcome rail dört sütun.
- Tape merkezi içerik genişliğini kullanır.
- Glance row: yön/zaman, fiyat/skor, takip durumu, disclosure aksiyonu şeklinde yatay hierarchy.
- Açık detail layer iki kolon olabilir:
  - sol: outcomes
  - sağ: evidence ve research context
- Açılmış kart ekrandan taşmaz; uzun detector/filter listesi wrap eder.

### 12.2 Tablet, `521–900px`

- Outcome rail iki sütun.
- Glance row iki satıra geçer.
- Detail layer tek kolon veya dengeli iki kolon; içerik min-width zorlamaz.

### 12.3 Mobile, `<= 520px`

- En kritik glance alanları ilk viewport'ta görünür.
- Fiyat, skor gücü ve takip durumu 2x2 metrik düzenine geçebilir.
- Disclosure butonu minimum 44px touch target olur.
- Detail layer dikey akar.
- Horizon sonuçları 2 veya 3 sütunlu semantic grid olur; root yatay scroll üretmez.
- Sticky bottom nav tarafından son içeriğin kapanmaması için mevcut shell safe-area/padding sözleşmesi korunur.

## 13. Accessibility

- `screen-signals` test ID korunur.
- Sinyal listesi `role="list"`, event `article role="listitem"` olarak kalır.
- Her article erişilebilir adı yön, fiyat ve zaman bağlamını içerir.
- Disclosure gerçek `button` olur.
- `aria-expanded`, `aria-controls` ve benzersiz detail ID kullanılır.
- Strength görseli custom ise `role="meter"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` kullanır.
- Table kullanılmayan metric grid'ler table rolü taklit etmez.
- Pozitif/negatif değerlerde işaret (`+/-`) ve metin bulunur; renk tek sinyal değildir.
- Focus ring Ion Violet ile görünür kalır.
- Browser zoom engellenmez.
- Aç/kapa işlemi focus'u kaybettirmez.
- Reduced motion'da event glow ve disclosure transition kaldırılır.

## 14. Motion

İzin verilen motion:

- Mount sonrası gerçekten eklenen yeni sinyalde tek seferlik 140–180ms edge glow
- Disclosure açılışında kısa opacity/translate transition
- Hover/focus state transition

Yasak motion:

- İlk render'daki tüm geçmiş kartların animasyonu
- Perpetual pulse
- Return veya fiyat sayılarını tween etme
- Confetti
- Auto-scroll
- Reduced-motion tercihinde zorunlu hareket

Yeni sinyal glow'u veri anlamını değiştirmez ve yeni event ID'si üzerinden tetiklenir.

## 15. Empty, loading ve error durumları

### Sinyal yok

- Başlık: `Onaylı sinyal bekleniyor`
- Açıklama: kalite, filtre ve confirmation pipeline'ını kısa ve doğru açıklar.

### Filtre sonucu yok

- Başlık: `Bu yönde sinyal yok`
- Aktif filtrenin temizlenmesi için açık `Tümünü göster` butonu bulunabilir.

### Tracker henüz yok

- Kart saklanmaz.
- Outcome bölümünde `Takip başlatılıyor` gösterilir.

### Opsiyonel context yok

- Boş placeholder grid üretilmez.
- İlgili bölüm veya satır render edilmez.

## 16. Önerilen component yapısı

```text
SignalsScreen
├── SignalOutcomeRail
├── SignalDirectionFilter
└── SignalEvidenceTape
    └── SignalEvidenceItem
        ├── SignalGlance
        ├── SignalStrengthMeter
        └── SignalEvidenceDetail
            ├── SignalOutcomeGrid
            ├── SignalBreakdownGrid
            └── SignalResearchContext
```

Presentation helper'ları ayrı saf modüle taşınabilir:

```text
src/ui/presentation/signalPresentation.ts
```

Önerilen saf fonksiyonlar:

- `formatSignedPercent`
- `formatSignalPrice`
- `deriveTrackerStatus`
- `getNextPendingHorizon`
- `getVisibleBreakdown`
- `getSignalContextRows`
- `buildOutcomeSummary`

Bu katman domain state üretmez ve store'u değiştirmez.

## 17. State yönetimi

Local UI state:

- `filter: 'ALL' | 'BUY' | 'SELL'`
- `expandedIds: Set<string>` veya tek açık kart kararı

İlk öneri: **aynı anda tek açık kart**.

Gerekçeler:

- Mobilde aşırı uzun sayfa oluşmasını engeller.
- Kullanıcı hangi evidence event'ini incelediğini kaybetmez.
- State basit kalır: `expandedId: string | null`.

Yeni sinyal geldiğinde mevcut açık kart otomatik kapanmaz ve auto-scroll yapılmaz.

## 18. Styling mimarisi

- Screen-specific sınıflar `src/styles/screens.css` Signals bölümünde kalır.
- Paylaşılan strength meter veya disclosure control gerçekten reusable ise `components.css`'e alınır.
- Global selector eklenmez.
- Mevcut Signals selector'ları kontrollü biçimde kaldırılır; eski ve yeni iki sistem paralel bırakılmaz.
- `progress` browser görünümüne bağlı kalınmayacaksa custom meter semantiği test edilir.
- Obsidian yüzeyleri, Ion Violet accent ve BUY/SELL tokenları korunur.

Önerilen ana sınıflar:

```text
.signals-screen
.signal-outcome-rail
.signal-outcome-stat
.signal-filter-bar
.signal-evidence-tape
.signal-evidence-item
.signal-glance
.signal-glance__metrics
.signal-lifecycle
.signal-evidence-detail
.signal-outcome-grid
.signal-breakdown-grid
.signal-context-list
.signal-strength-meter
```

## 19. Test planı

### 19.1 Unit/presentation tests

- `null` horizon → `Bekliyor`
- Gerçek `0` horizon → `0.00%`
- Pozitif/negatif signed formatting
- Tracker yok/açık/closed lifecycle etiketleri
- Sonraki bekleyen horizon seçimi
- `count=0` summary → `—`, `n=0`
- `calibratedProbability` yoksa probability satırı yok
- Opsiyonel breakdown'da finite `0` korunur
- Test signal badge derivation

### 19.2 Component/browser tests

- Gerçek/injected signal listede görünür.
- Tümü/Alım/Satım filter pressed state doğru çalışır.
- Disclosure klavye ile açılır ve kapanır.
- `aria-expanded` doğru değişir.
- Açılan detail'de horizon, evidence ve mevcut context görünür.
- Skor gücü probability olarak adlandırılmaz.
- Kalibre olasılık yalnızca veri varsa görünür.
- Custom strength meter erişilebilir meter semantiğine sahiptir.
- Aynı anda tek detail açıktır.
- Desktop ve mobile root overflow yoktur.
- 200% browser zoom'da ana işlevler erişilebilir kalır.
- Reduced-motion altında yeni event transition kapalıdır.
- Mevcut symbol normalization, paper plan ve tüm lazy-screen testleri bozulmaz.

### 19.3 Regression komutları

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --audit-level=high`
- `npm run test:e2e`
- Production deploy sonrası production health + focused Signals E2E

## 20. Acceptance criteria

Signals V3 tamamlanmış sayılırsa:

- [ ] Foundation muted/accent text kontrastı AA hedefini sağlar.
- [ ] Mevcut Obsidian/Ion Radar ve Chart görsel regresyona uğramaz.
- [ ] `screen-signals` contract'ı korunur.
- [ ] Evidence Tape generic panel yığınına dönüşmez.
- [ ] Glance görünümde yön, zaman, fiyat, skor gücü ve takip durumu bulunur.
- [ ] Detail kullanıcı isteğiyle açılır; gesture zorunlu değildir.
- [ ] Beş horizon null/zero ayrımını doğru gösterir.
- [ ] MFE/MAE/live yalnızca gerçek tracker verisinden gelir.
- [ ] Breakdown'ın mevcut opsiyonel alanları doğru kullanılır.
- [ ] Filters, research context ve strategy version yalnızca mevcutsa gösterilir.
- [ ] Confidence ile calibrated probability açıkça ayrılır.
- [ ] `n=0` iken outcome yüzdesi uydurulmaz.
- [ ] Test sinyali açıkça etiketlenir.
- [ ] Mobile root overflow yoktur.
- [ ] Touch target, focus, keyboard ve reduced-motion sözleşmeleri geçer.
- [ ] Unit, build, audit ve desktop/mobile Playwright yeşildir.
- [ ] Profitability, execution veya statistical significance claim'i eklenmez.

## 21. Uygulama sırası

### S0 — Foundation contrast

1. Mevcut ana yüzeylerde token contrast ölçümü
2. `text-muted`, `accent-text` ve gerekirse control border düzenlemesi
3. Radar/Chart/Navigation focused visual regression

### S1 — Presentation helpers

1. Saf formatter ve lifecycle derivation fonksiyonları
2. Unit testler
3. Domain/store değişikliği olmadığının doğrulanması

### S2 — Signals component decomposition

1. Outcome rail
2. Direction filter
3. Evidence Tape glance rows
4. Disclosure state ve detail layer
5. Empty/filter states

### S3 — Responsive Obsidian/Ion styling

1. Desktop hierarchy
2. Tablet reflow
3. Mobile content adaptation
4. Reduced-motion
5. Overflow ve zoom kontrolü

### S4 — Browser regression

1. Injected BUY/SELL coverage
2. Filter ve disclosure accessibility
3. Desktop/mobile screenshots
4. Full local validation
5. Commit/push/deploy
6. Production health ve focused Signals QA

## 22. Sonraki ekranlara aktarılacak pattern

Signals V3 ile doğrulanan şu pattern'ler daha sonra Microstructure V3'te yeniden kullanılabilir:

- Glance/detail/evidence katmanları
- Inline accessible disclosure
- Outcome/context row primitives
- Gerçek state değişiminde tek seferlik luminance feedback
- Mobile içerik adaptasyonu
- Opsiyonel context'i yalnız mevcutsa gösterme

Microstructure için historical detector timeline veya heatmap bu spec'in parçası değildir; önce gerçek runtime history retention sözleşmesi gerekir.
