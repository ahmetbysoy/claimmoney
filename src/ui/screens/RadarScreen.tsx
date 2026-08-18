import { useEffect, useMemo, useRef, useState } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useSettingsStore } from '../../store/settingsStore'
import { RadarGauge } from '../components/RadarGauge'
import { MeterBar } from '../components/MeterBar'
import { PriceTicker } from '../components/PriceTicker'

const descriptions: Record<string, string> = {
  OBI: 'İlk emir defteri kademelerindeki alış ve satış likiditesi arasındaki normalize fark.',
  CVD: 'İşlem akışındaki agresif alış ve satış farkının standartlaştırılmış görünümü.',
  VEL: 'Kısa dönem fiyat hareket hızının standartlaştırılmış yönsel katkısı.',
  MIC: 'Mikro fiyat ile işlem fiyatı arasındaki normalize edilmiş sapma.',
  VPIN: 'Hacim kovalarında gözlenen akış toksisitesinin 0–1 arası özeti.',
  DET: 'Aktif mikroyapı dedektörlerinin yönsel bileşik katkısı.'
}

type FeatureCode = keyof typeof descriptions
type FeatureHistory = Record<FeatureCode, number[]>
const initialHistory: FeatureHistory = { OBI: [], CVD: [], VEL: [], MIC: [], VPIN: [], DET: [] }
const append = (values: number[], value: number) => [...values, value].slice(-42)

export function RadarScreen() {
  const metrics = useDataStore(state => state.metrics)
  const engineState = useDataStore(state => state.engineState)
  const signals = useDataStore(state => state.signals)
  const price = useDataStore(state => state.price)
  const regime = useDataStore(state => state.regime)
  const symbol = useDataStore(state => state.symbol)
  const book = useDataStore(state => state.book)
  const lastUpdate = useDataStore(state => state.lastUpdate)
  const threshold = useSettingsStore(state => state.threshold)
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null)
  const [history, setHistory] = useState<FeatureHistory>(initialHistory)
  const detailRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const openFeature = (index: number) => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelectedFeature(index)
  }
  const closeFeature = () => {
    setSelectedFeature(null)
    window.requestAnimationFrame(() => restoreFocusRef.current?.focus())
  }

  useEffect(() => {
    setHistory(previous => ({
      OBI: append(previous.OBI, metrics.obi), CVD: append(previous.CVD, metrics.cvdZ),
      VEL: append(previous.VEL, metrics.velocityZ), MIC: append(previous.MIC, metrics.microDev),
      VPIN: append(previous.VPIN, metrics.vpin), DET: append(previous.DET, metrics.detectorScore)
    }))
  }, [metrics.obi, metrics.cvdZ, metrics.velocityZ, metrics.microDev, metrics.vpin, metrics.detectorScore])

  useEffect(() => {
    if (selectedFeature === null) return
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeFeature(); return }
      if (event.key !== 'Tab' || !detailRef.current) return
      const focusable = [...detailRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [selectedFeature])

  const score = metrics.score
  const confidence = Math.min(100, Math.round((Math.abs(score) / 3) * 100))
  const side: 'BUY' | 'SELL' | 'NEUTRAL' = score > threshold ? 'BUY' : score < -threshold ? 'SELL' : 'NEUTRAL'
  const tone = side === 'BUY' ? 'buy' : side === 'SELL' ? 'sell' : 'neutral'
  const bestBid = book.bids[0]?.price ?? 0
  const bestAsk = book.asks[0]?.price ?? 0
  const spreadBps = price > 0 && bestAsk >= bestBid ? (bestAsk - bestBid) / price * 10_000 : 0
  const lastSignal = signals[0]

  const features = useMemo(() => [
    { code: 'OBI' as const, label: 'Order book imbalance', value: metrics.obi, min: -1, max: 1, priority: 'critical' as const, history: history.OBI, description: 'Likidite yönü' },
    { code: 'CVD' as const, label: 'Cumulative volume delta', value: metrics.cvdZ, min: -3, max: 3, priority: 'critical' as const, history: history.CVD, description: 'Agresif akış z-skoru' },
    { code: 'VEL' as const, label: 'Price velocity', value: metrics.velocityZ, min: -3, max: 3, history: history.VEL, description: 'Kısa dönem hız' },
    { code: 'MIC' as const, label: 'Microprice deviation', value: metrics.microDev, min: -1, max: 1, history: history.MIC, description: 'Defter kaynaklı sapma' },
    { code: 'VPIN' as const, label: 'Flow toxicity', value: metrics.vpin, min: 0, max: 1, note: metrics.vpinLabel, tone: metrics.vpin >= 0.7 ? 'warning' as const : 'neutral' as const, history: history.VPIN, description: 'Hacim toksisitesi' },
    { code: 'DET' as const, label: 'Detector pressure', value: metrics.detectorScore, min: -1, max: 1, history: history.DET, description: 'Aktif olay bileşimi' }
  ], [history, metrics])
  const selected = selectedFeature === null ? null : features[selectedFeature]
  const qualityLabel = metrics.quality === 'good' ? 'SAĞLIKLI' : metrics.quality === 'warming' ? 'ISINIYOR' : metrics.quality === 'degraded' ? 'ZAYIF' : 'GEÇERSİZ'

  return (
    <section className="screen radar-screen" data-testid="screen-radar" data-market-tone={tone}>
      <div className="screen-heading radar-heading">
        <div className="screen-heading__copy">
          <p className="eyebrow">ION FLOW / LIVE</p>
          <h1>Market radar</h1>
          <p className="screen-heading__description">Likidite, agresif akış ve mikro fiyatın tek karar alanında birleşimi.</p>
        </div>
        <div className="radar-heading__state" data-tone={tone}>
          <span className="radar-heading__pulse" aria-hidden="true" />
          <span><small>REJİM</small><strong>{regime.regime.toUpperCase()}</strong></span>
          <span><small>GÜVEN</small><strong className="numeric">{(regime.confidence * 100).toFixed(0)}%</strong></span>
        </div>
      </div>

      <div className="radar-market-tape" aria-label="Canlı piyasa özeti">
        <div className="radar-market-tape__price"><PriceTicker price={price} symbol={symbol} /></div>
        <div><span>BID</span><strong className="numeric text-buy">{bestBid ? bestBid.toFixed(2) : '—'}</strong></div>
        <div><span>ASK</span><strong className="numeric text-sell">{bestAsk ? bestAsk.toFixed(2) : '—'}</strong></div>
        <div><span>SPREAD</span><strong className="numeric">{spreadBps.toFixed(2)} bps</strong></div>
        <div><span>DATA</span><strong className={metrics.quality === 'good' ? 'text-buy' : 'text-warning'}>{qualityLabel}</strong></div>
        <div title={lastUpdate ? `Son güncelleme ${new Date(lastUpdate).toLocaleTimeString('tr-TR')}` : undefined}><span>REJİM</span><strong>{regime.regime.toUpperCase()}</strong></div>
      </div>

      <div className="radar-bento">
        <article className="radar-command" data-tone={tone}>
          <div className="radar-command__header">
            <div><p className="eyebrow">SIGNAL CORE</p><h2>Composite pressure</h2></div>
            <span className="radar-command__sequence mono">SEQ / {String(signals.length).padStart(3, '0')}</span>
          </div>
          <RadarGauge score={score} confidence={confidence} threshold={threshold} side={side} engineState={engineState} />
          <div className="radar-command__decision" data-tone={tone}>
            <div><span>MODEL KARARI</span><strong>{side === 'BUY' ? 'ALIM BASKISI' : side === 'SELL' ? 'SATIM BASKISI' : 'BEKLE / NÖTR'}</strong></div>
            <div><span>EŞİĞE UZAKLIK</span><strong className="numeric">{Math.max(0, threshold - Math.abs(score)).toFixed(2)}</strong></div>
          </div>
        </article>

        <div className="radar-critical-stack" aria-label="Öncelikli model girdileri">
          {features.slice(0, 2).map((feature, index) => <MeterBar key={feature.code} {...feature} onClick={() => openFeature(index)} />)}
        </div>

        <div className="radar-supporting-rail" aria-label="Destekleyici model girdileri">
          {features.slice(2).map((feature, index) => <MeterBar key={feature.code} {...feature} onClick={() => openFeature(index + 2)} />)}
        </div>
      </div>

      <div className="radar-context-strip">
        <div><span className="eyebrow">SON TEYİT</span><strong className={lastSignal?.side === 'BUY' ? 'text-buy' : lastSignal?.side === 'SELL' ? 'text-sell' : ''}>{lastSignal ? lastSignal.side : 'SİNYAL YOK'}</strong><small>{lastSignal ? new Date(lastSignal.ts).toLocaleTimeString('tr-TR') : 'Filtreler ve eşik izleniyor'}</small></div>
        <div><span className="eyebrow">AKTİF FİLTRE</span><strong>{metrics.filterReasons.length ? `${metrics.filterReasons.length} VETO` : 'TEMİZ'}</strong><small>{metrics.filterReasons[0] ?? 'Kalite filtresi geçildi'}</small></div>
        <div><span className="eyebrow">MODEL</span><strong>6-FACTOR / V2</strong><small>Açıklanabilir ağırlıklı skor</small></div>
      </div>

      {selected && (
        <div className="metric-detail" role="dialog" aria-modal="true" aria-labelledby="metric-detail-title">
          <button type="button" className="metric-detail__backdrop" aria-label="Detayı kapat" onClick={closeFeature} />
          <div ref={detailRef} className="metric-detail__panel">
            <div className="metric-detail__header"><div><p className="eyebrow">FEATURE / {selected.code}</p><h2 id="metric-detail-title">{selected.label}</h2></div><button ref={closeRef} type="button" className="button button--ghost" onClick={closeFeature}>Kapat</button></div>
            <div className="metric-detail__body">
              <strong className="metric-detail__value numeric">{selected.value.toFixed(4)}</strong>
              <p>{descriptions[selected.code]}</p>
              <div className="metric-detail__facts"><span>Aralık <b className="numeric">{selected.min} — {selected.max}</b></span><span>Canlı örnek <b className="numeric">{selected.history.length}</b></span></div>
              <p className="text-muted">Bu özellik bileşik kararın yalnızca bir girdisidir; tek başına işlem emri değildir.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
