import { useMemo } from 'react'
import { useDataStore } from '../../store/dataStore'

const number = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—'

export function MicrostructureScreen() {
  const frame = useDataStore(state => state.frame)
  const book = useDataStore(state => state.book)
  const detectors = useDataStore(state => state.detectorSignals)
  const metrics = useDataStore(state => state.metrics)
  const price = useDataStore(state => state.price)
  const markPrice = useDataStore(state => state.markPrice)
  const regime = useDataStore(state => state.regime)
  const cross = useDataStore(state => state.crossExchange)
  const arbitrage = useDataStore(state => state.arbitrage)
  const telemetry = useDataStore(state => state.telemetry)
  const maxQty = useMemo(() => Math.max(1, ...book.bids.slice(0, 10).map(level => level.qty), ...book.asks.slice(0, 10).map(level => level.qty)), [book])
  const features = frame ? [
    ['CVD z', frame.cvdZ], ['OBI', frame.obi], ['Velocity z', frame.velocityZ], ['Micro', frame.microDev],
    ['VPIN', frame.vpin], ['Detector', frame.detectorScore], ['Vol bps', frame.volatility], ['Divergence', frame.divergence]
  ] as const : []

  return (
    <section className="screen" data-testid="screen-microstructure">
      <div className="screen-heading"><div className="screen-heading__copy"><p className="eyebrow">Likidite</p><h1>Mikroyapı</h1><p className="screen-heading__description">Özellik kalitesi, derinlik, borsalar arası kotasyon ve dedektör telemetrisi.</p></div><span className={`status-badge ${book.synced ? 'status-badge--buy' : 'status-badge--warning'}`}>{book.synced ? 'Defter senkron' : 'Resync bekleniyor'}</span></div>

      <div className="micro-stats">
        <div className="panel panel--flat micro-stat"><span className="eyebrow">Veri kalitesi</span><strong className={metrics.quality === 'good' ? 'text-buy' : 'text-warning'}>{metrics.quality}</strong><small>{regime.regime} · {(regime.confidence * 100).toFixed(0)}%</small></div>
        <div className="panel panel--flat micro-stat"><span className="eyebrow">İşlem / Mark</span><strong className="numeric">{number(price)}</strong><small className="numeric">Mark {markPrice > 0 ? number(markPrice) : '—'} · yürütülemez</small></div>
        <div className="panel panel--flat micro-stat"><span className="eyebrow">Arbitraj görünümü</span><strong className={arbitrage.valid ? 'text-accent' : ''}>{arbitrage.valid ? `${number(arbitrage.spreadPct, 3)}%` : 'Geçersiz'}</strong><small>{arbitrage.valid ? `${arbitrage.buyExchange} → ${arbitrage.sellExchange}` : 'Geçerli borsa çifti yok'}</small></div>
      </div>

      {metrics.filterReasons.length > 0 && <div className="notice notice--warning">{metrics.filterReasons.join(' · ')}</div>}

      <div className="panel feature-frame">
        <div className="panel__header"><div><p className="eyebrow">Feature frame</p><h2>Model veri sağlığı</h2></div><span className="status-badge">{features.filter(([, feature]) => feature.valid).length}/{features.length} geçerli</span></div>
        <div className="feature-health-grid">
          {features.map(([label, feature]) => <div key={label} className="feature-health" data-valid={feature.valid}><span>{label}</span><strong className="numeric">{number(feature.value, 3)}</strong><small>{feature.valid ? 'Geçerli' : `${(feature.warmup * 100).toFixed(0)}% ısınma`}</small></div>)}
          {!features.length && <div className="empty-state"><p>İlk özellik çerçevesi bekleniyor.</p></div>}
        </div>
      </div>

      <div className="panel order-book">
        <div className="panel__header"><div><p className="eyebrow">Emir defteri</p><h2>İlk sekiz kademe</h2></div></div>
        <div className="book-grid">
          <div className="book-side book-side--bid"><div className="book-side__head"><span>Alış miktarı</span><span>Fiyat</span></div>{book.bids.slice(0, 8).map(level => <div className="book-level" key={level.price}><progress value={level.qty} max={maxQty} aria-label={`Alış ${level.qty}`} /><span className="numeric">{number(level.qty, 4)}</span><strong className="numeric">{number(level.price)}</strong></div>)}</div>
          <div className="book-side book-side--ask"><div className="book-side__head"><span>Fiyat</span><span>Satış miktarı</span></div>{book.asks.slice(0, 8).map(level => <div className="book-level" key={level.price}><strong className="numeric">{number(level.price)}</strong><span className="numeric">{number(level.qty, 4)}</span><progress value={level.qty} max={maxQty} aria-label={`Satış ${level.qty}`} /></div>)}</div>
        </div>
      </div>

      <div className="micro-lower-grid">
        <div className="panel"><div className="panel__header"><div><p className="eyebrow">Cross exchange</p><h2>Kotasyonlar</h2></div></div><div className="compact-rows">{Object.entries(cross).map(([exchange, quote]) => <div className="compact-row" key={exchange}><strong>{exchange.toUpperCase()}</strong><span className="numeric">{quote.status} · {number(quote.bid)} / {number(quote.ask)} · {quote.latencyMs}ms</span></div>)}</div></div>
        <div className="panel"><div className="panel__header"><div><p className="eyebrow">Dedektörler</p><h2>Aktif olaylar</h2></div></div><div className="compact-rows">{detectors.length === 0 ? <div className="empty-state compact-empty"><p>Aktif dedektör sinyali yok.</p></div> : detectors.slice(0, 20).map(signal => <div className="compact-row detector-row" data-bias={signal.bias} key={signal.id}><div><strong>{signal.type}</strong><p>{signal.description}</p></div><span className="numeric">{signal.confidence.toFixed(0)}</span></div>)}</div></div>
      </div>

      {telemetry.length > 0 && <div className="panel"><div className="panel__header"><div><p className="eyebrow">Sistem</p><h2>Son telemetri</h2></div></div><div className="compact-rows">{telemetry.slice(-10).reverse().map(event => <div className="compact-row" key={`${event.ts}-${event.code}`}><strong>{event.level}</strong><span>{event.code}: {event.message}</span></div>)}</div></div>}
      <div className="notice notice--warning">Dedektörler heuristik piyasa durumu özetleridir; manipülasyon veya kârlılık iddiası değildir.</div>
    </section>
  )
}
