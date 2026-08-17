import { useDataStore } from '../../store/dataStore'

const number = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : '—'
export function MicrostructureScreen() {
  const frame = useDataStore(state => state.frame)
  const book = useDataStore(state => state.book)
  const detectors = useDataStore(state => state.detectorSignals)
  const metrics = useDataStore(state => state.metrics)
  const regime = useDataStore(state => state.regime)
  const cross = useDataStore(state => state.crossExchange)
  const arbitrage = useDataStore(state => state.arbitrage)
  const telemetry = useDataStore(state => state.telemetry)
  const features = frame ? [
    ['CVD z', frame.cvdZ], ['OBI', frame.obi], ['Velocity z', frame.velocityZ], ['Micro', frame.microDev],
    ['VPIN', frame.vpin], ['Detector', frame.detectorScore], ['Vol bps', frame.volatility], ['Divergence', frame.divergence]
  ] as const : []
  return <div className="scrollbar-thin" style={{ padding: 14, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <section style={card}><div style={title}>DATA QUALITY & REGIME</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><b style={{ color: metrics.quality === 'good' ? 'var(--green)' : 'var(--amber)' }}>{metrics.quality.toUpperCase()}</b><b>{regime.regime.toUpperCase()} • {(regime.confidence * 100).toFixed(0)}%</b></div>
      <div style={muted}>{regime.reasons.join(' • ')}</div>
      {metrics.filterReasons.map(reason => <div key={reason} style={{ ...muted, color: 'var(--red)' }}>× {reason}</div>)}
    </section>

    <section style={card}><div style={title}>FEATURE FRAME</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>
      {features.map(([label, feature]) => <div key={label} style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,.7)', border: `1px solid ${feature.valid ? 'var(--border-soft)' : 'var(--amber)'}` }}>
        <div style={muted}>{label}</div><b>{number(feature.value, 3)}</b><span style={{ float: 'right', fontSize: 9, color: feature.valid ? 'var(--green)' : 'var(--amber)' }}>{feature.valid ? 'VALID' : `${(feature.warmup * 100).toFixed(0)}%`}</span>
      </div>)}
    </div></section>

    <section style={card}><div style={title}>ORDER BOOK • {book.synced ? 'SYNCED' : 'RESYNC'}</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
      <div><div style={{ ...muted, color: 'var(--green)' }}>BIDS</div>{book.bids.slice(0, 8).map(level => <div key={level.price} style={row}><span>{level.price}</span><span>{number(level.qty, 4)}</span></div>)}</div>
      <div><div style={{ ...muted, color: 'var(--red)' }}>ASKS</div>{book.asks.slice(0, 8).map(level => <div key={level.price} style={row}><span>{level.price}</span><span>{number(level.qty, 4)}</span></div>)}</div>
    </div></section>

    <section style={card}><div style={title}>CROSS EXCHANGE {arbitrage.valid ? `• +${number(arbitrage.spreadPct, 3)}%` : ''}</div>
      {(Object.entries(cross)).map(([exchange, quote]) => <div key={exchange} style={row}><b>{exchange.toUpperCase()}</b><span>{quote.status} • {number(quote.bid)} / {number(quote.ask)} • {quote.latencyMs}ms</span></div>)}
    </section>

    <section style={card}><div style={title}>DETECTOR TIMELINE</div>{detectors.length === 0 ? <div style={muted}>Aktif detector sinyali yok.</div> : detectors.slice(0, 20).map(signal => <div key={signal.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border-soft)' }}><b style={{ color: signal.bias === 'bullish' ? 'var(--green)' : signal.bias === 'bearish' ? 'var(--red)' : 'var(--amber)' }}>{signal.type} • {signal.confidence.toFixed(0)}</b><div style={muted}>{signal.description}</div></div>)}</section>
    <section style={card}><div style={title}>TELEMETRY</div>{telemetry.length === 0 ? <div style={muted}>Hata yok.</div> : telemetry.slice(-10).reverse().map(event => <div key={`${event.ts}-${event.code}`} style={row}><b>{event.level}</b><span>{event.code}: {event.message}</span></div>)}</section>
  </div>
}
const card = { padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.72)', border: '1px solid var(--border-soft)' }
const title = { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: 'var(--purple-deep)', letterSpacing: .5 }
const muted = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginTop: 4 }
const row = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 9 }
