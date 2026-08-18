import { useMemo, useState } from 'react'
import { useDataStore } from '../../store/dataStore'

const fmtPct = (value: number | null | undefined) => value == null ? '…' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`

function HorizonBadge({ label, value }: { label: string; value: number | null }) {
  const tone = value == null ? 'neutral' : value > 0.02 ? 'buy' : value < -0.02 ? 'sell' : 'neutral'
  return <span className={`status-badge status-badge--${tone}`}>{label}: {fmtPct(value)}</span>
}

export function SignalsScreen() {
  const signals = useDataStore(state => state.signals)
  const trackers = useDataStore(state => state.trackers)
  const stats = useDataStore(state => state.stats)
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL')
  const trackerMap = useMemo(() => new Map(trackers.map(tracker => [tracker.signalId, tracker])), [trackers])
  const visible = filter === 'ALL' ? signals : signals.filter(signal => signal.side === filter)

  return (
    <section className="screen" data-testid="screen-signals">
      <div className="screen-heading">
        <div className="screen-heading__copy"><p className="eyebrow">Olay günlüğü</p><h1>Sinyaller</h1><p className="screen-heading__description">Teyitli yön değişimleri ve olgunlaşan forward-return ölçümleri.</p></div>
        <span className="status-badge">{signals.length} kayıt</span>
      </div>

      <div className="signal-summary-grid">
        <div className="panel panel--flat summary-stat"><span className="eyebrow">Olgun örnek</span><strong className="numeric">{stats.count}</strong></div>
        <div className="panel panel--flat summary-stat"><span className="eyebrow">60s win</span><strong className="numeric">{(stats.win60s * 100).toFixed(0)}%</strong></div>
        <div className="panel panel--flat summary-stat"><span className="eyebrow">60s ort.</span><strong className={`numeric ${stats.avg60s >= 0 ? 'text-buy' : 'text-sell'}`}>{fmtPct(stats.avg60s)}</strong></div>
        <div className="panel panel--flat summary-stat"><span className="eyebrow">MFE / MAE</span><strong className="numeric"><span className="text-buy">{fmtPct(stats.avgMfe)}</span> / <span className="text-sell">{fmtPct(stats.avgMae)}</span></strong></div>
      </div>

      <div className="panel signal-log">
        <div className="panel__header signal-log__toolbar">
          <div className="segmented" aria-label="Sinyal yönü filtresi">
            {(['ALL', 'BUY', 'SELL'] as const).map(value => <button key={value} type="button" className="segmented__button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'ALL' ? 'Tümü' : value === 'BUY' ? 'Alım' : 'Satım'}</button>)}
          </div>
          <span className="text-muted">{visible.length} sonuç</span>
        </div>

        {visible.length === 0 ? <div className="empty-state"><div><h2>Bu filtrede sinyal yok</h2><p className="text-secondary">Bileşik skor eşik ve kalite filtrelerini geçtiğinde burada listelenir.</p></div></div> : (
          <div className="signal-list" role="list">
            {visible.map(signal => {
              const tracker = trackerMap.get(signal.id)
              const tone = signal.side === 'BUY' ? 'buy' : 'sell'
              return <article key={signal.id} className="signal-card" data-tone={tone} role="listitem">
                <div className="signal-card__header"><span className={`status-badge status-badge--${tone}`}>{signal.side === 'BUY' ? 'ALIM' : 'SATIM'}</span><time className="mono" dateTime={new Date(signal.ts).toISOString()}>{new Date(signal.ts).toLocaleString('tr-TR')}</time></div>
                <div className="signal-card__core"><div><span className="eyebrow">Fiyat</span><strong className="numeric">{signal.priceStr || signal.price}</strong></div><div><span className="eyebrow">Skor</span><strong className="numeric">{signal.score.toFixed(2)}</strong></div><div><span className="eyebrow">Güç</span><strong className="numeric">{signal.confidence}%</strong></div></div>
                <progress className="confidence-progress" value={signal.confidence} max="100" aria-label={`Sinyal gücü yüzde ${signal.confidence}`} />
                <div className="signal-breakdown"><span>CVD {signal.breakdown.cvd.toFixed(2)}</span><span>OBI {signal.breakdown.obi.toFixed(2)}</span><span>VEL {signal.breakdown.vel.toFixed(2)}</span></div>
                {tracker ? <div className="tracker-block"><div className="tracker-horizons"><HorizonBadge label="15s" value={tracker.horizons['15s']} /><HorizonBadge label="30s" value={tracker.horizons['30s']} /><HorizonBadge label="60s" value={tracker.horizons['60s']} /><HorizonBadge label="5m" value={tracker.horizons['300s']} /><HorizonBadge label="15m" value={tracker.horizons['900s']} /></div><div className="tracker-live"><span>Canlı <b className={tracker.live >= 0 ? 'text-buy' : 'text-sell'}>{fmtPct(tracker.live)}</b></span><span>MFE <b className="text-buy">{fmtPct(tracker.mfe)}</b></span><span>MAE <b className="text-sell">{fmtPct(tracker.mae)}</b></span><span>{tracker.closed ? 'Kapatıldı' : 'Takipte'}</span></div></div> : <p className="text-muted">Takip başlatılıyor…</p>}
              </article>
            })}
          </div>
        )}
      </div>
      <div className="notice">Forward return metrikleri gözlemseldir. Geçmiş performans, gelecekteki sonucu veya kârlılığı garanti etmez.</div>
    </section>
  )
}
