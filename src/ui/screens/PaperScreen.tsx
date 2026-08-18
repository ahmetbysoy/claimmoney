import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useMarketRuntime } from '../../app/RuntimeContext'
import { downloadJson, downloadText, LocalSessionRepository, type SessionSnapshot } from '../../performance/persistence'
import { ManualClock } from '../../application/clock'
import { MarketRuntime } from '../../application/marketRuntime'
import { MarketReplay, parseJsonLines } from '../../testing/replay/marketReplay'

const fmt = (value: number | undefined, digits = 2) => value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits)

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'buy' | 'sell' }) {
  return <div className="portfolio-metric"><span className="eyebrow">{label}</span><strong className={`numeric ${tone ? `text-${tone}` : ''}`}>{value}</strong></div>
}

export function PaperScreen() {
  const runtime = useMarketRuntime()
  const enabled = useSettingsStore(state => state.paperTradingEnabled)
  const setEnabled = useSettingsStore(state => state.setPaperTradingEnabled)
  const plan = useDataStore(state => state.plan)
  const size = useDataStore(state => state.positionSize)
  const orders = useDataStore(state => state.paperOrders)
  const open = useDataStore(state => state.openPositions)
  const closed = useDataStore(state => state.closedPositions)
  const performance = useDataStore(state => state.paperPerformance)
  const fileInput = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState('')

  const equityPoints = useMemo(() => {
    const values = performance.equity.length ? performance.equity : [1000]
    const min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max - min)
    return values.map((value, index) => `${values.length === 1 ? 0 : index / (values.length - 1) * 100},${38 - (value - min) / span * 34}`).join(' ')
  }, [performance.equity])

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget, file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      try {
        const session = JSON.parse(text) as SessionSnapshot
        if (session?.version === 1 && typeof session.sessionId === 'string' && typeof session.payload === 'object') {
          await new LocalSessionRepository().save(session)
          setImportStatus(`Oturum içe aktarıldı: ${session.sessionId}`)
          return
        }
      } catch { /* JSONL deterministic replay'e düşer. */ }
      const events = parseJsonLines(text)
      if (!events.length) throw new Error('Kayıtta market olayı yok')
      const base = useSettingsStore.getState()
      const replaySettings = { ...base, symbol: events[0].symbol, source: events[0].exchange }
      const clock = new ManualClock(events[0].receiveTs)
      const isolated = new MarketRuntime({ settings: () => replaySettings, clock, enableNetworkServices: false })
      const result = new MarketReplay(clock, isolated).run(events)
      downloadJson(`claimmoney-replay-${Date.now()}.json`, { replay: result, session: isolated.exportSession(), snapshot: isolated.snapshot() })
      isolated.dispose()
      setImportStatus(`Replay tamamlandı: ${result.processed} işlendi, ${result.rejected} reddedildi`)
    } catch (error) {
      setImportStatus(`İçe aktarma hatası: ${error instanceof Error ? error.message : String(error)}`)
    } finally { input.value = '' }
  }

  const pnlTone = performance.netPnl > 0 ? 'buy' : performance.netPnl < 0 ? 'sell' : undefined

  return (
    <section className="screen" data-testid="screen-paper">
      <div className="screen-heading">
        <div className="screen-heading__copy"><p className="eyebrow">Simülasyon</p><h1>Portföy</h1><p className="screen-heading__description">Yürütme varsayımları, kâğıt pozisyonlar ve oturum kayıtları.</p></div>
        <button type="button" role="switch" aria-checked={enabled} className="paper-mode-switch" onClick={() => setEnabled(!enabled)}><span className="toggle" aria-checked={enabled} /><span>{enabled ? 'Kâğıt işlem açık' : 'Kâğıt işlem kapalı'}</span></button>
      </div>

      <div className="portfolio-summary">
        <div className="panel portfolio-equity">
          <div><p className="eyebrow">Net simüle PnL</p><strong className={`portfolio-equity__value numeric ${pnlTone ? `text-${pnlTone}` : ''}`}>${fmt(performance.netPnl)}</strong><p className="text-muted">{performance.trades} kapanan işlem · ${fmt(performance.feesPaid)} ücret</p></div>
          <svg className="equity-sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Simüle özsermaye eğrisi"><polyline points={equityPoints} /></svg>
        </div>
        <div className="panel portfolio-metrics-grid">
          <Metric label="Win rate" value={`${performance.trades ? (performance.wins / performance.trades * 100).toFixed(0) : 0}%`} />
          <Metric label="Net R" value={fmt(performance.netR)} tone={performance.netR >= 0 ? 'buy' : 'sell'} />
          <Metric label="Profit factor" value={fmt(performance.pf)} />
          <Metric label="Max DD" value={`${fmt(performance.maxDD)}%`} tone={performance.maxDD > 0 ? 'sell' : undefined} />
        </div>
      </div>

      <div className="paper-grid">
        <div className="panel"><div className="panel__header"><div><p className="eyebrow">Risk planı</p><h2>ONAYLI TRADE PLANI</h2></div></div><div className="panel__body">
          {!plan ? <div className="empty-state compact-empty"><p>Onaylı sinyal bekleniyor.</p></div> : <><strong data-testid="plan-direction" className={`plan-direction ${plan.direction === 'LONG' ? 'text-buy' : plan.direction === 'SHORT' ? 'text-sell' : 'text-muted'}`}>{plan.direction}</strong><div className="portfolio-metrics-grid"><Metric label="Entry" value={fmt(plan.entry)} /><Metric label="Stop" value={fmt(plan.stop)} /><Metric label="TP1" value={fmt(plan.tp1)} /><Metric label="TP2" value={fmt(plan.tp2)} /><Metric label="Net RR" value={fmt(plan.rr)} /><Metric label="Sinyal gücü" value={`${plan.confidence.toFixed(0)}%`} /></div><p className="text-secondary paper-reason">{plan.reason}</p></>}
        </div></div>
        <div className="panel"><div className="panel__header"><div><p className="eyebrow">Pozisyonlama</p><h2>Boyut ve risk</h2></div></div><div className="panel__body">{!size ? <div className="empty-state compact-empty"><p>Geçerli risk planı yok.</p></div> : <div className="portfolio-metrics-grid"><Metric label="Qty" value={fmt(size.qty, 5)} /><Metric label="Notional" value={`$${fmt(size.notional)}`} /><Metric label="Margin" value={`$${fmt(size.margin)}`} /><Metric label="Leverage" value={`${fmt(size.leverage, 1)}×`} /><Metric label="Max risk" value={`$${fmt(size.maxRiskUSD)}`} /><Metric label="Liq. tarama" value={fmt(size.liqPriceEstimate)} /></div>}</div></div>
      </div>

      <div className="panel">
        <div className="panel__header"><div><p className="eyebrow">Kayıt ve replay</p><h2>Oturum araçları</h2></div><div className="button-row"><button type="button" className="button" onClick={() => runtime && downloadJson(`claimmoney-${Date.now()}.json`, runtime.exportSession())}>Oturum JSON</button><button type="button" className="button" onClick={() => runtime && downloadText(`claimmoney-events-${Date.now()}.jsonl`, runtime.exportRecording(), 'application/x-ndjson')}>Kayıt JSONL</button><button type="button" className="button" onClick={() => fileInput.current?.click()}>İçe aktar / replay</button><input ref={fileInput} data-testid="import-replay-input" type="file" accept=".json,.jsonl,application/json,application/x-ndjson" hidden onChange={importFile} /></div></div>
        {importStatus && <div className={`notice ${importStatus.includes('hatası') ? 'notice--error' : ''}`}>{importStatus}</div>}
      </div>

      <div className="panel"><div className="panel__header"><div><p className="eyebrow">Yürütme günlüğü</p><h2>Emirler ve pozisyonlar</h2></div><span className="status-badge">{orders.length + open.length + closed.length} kayıt</span></div><div className="compact-rows">
        {orders.slice(-10).reverse().map(order => <div key={order.id} className="compact-row"><strong>{order.dir} {order.status}</strong><span className="numeric">{fmt(order.qty, 5)} @ {fmt(order.entry)}</span></div>)}
        {open.map(position => <div key={position.id} className="compact-row"><strong className="text-buy">OPEN {position.dir}</strong><span className="numeric">{fmt(position.qty, 5)} @ {fmt(position.entry)}</span></div>)}
        {closed.slice(0, 10).map(position => <div key={position.id} className="compact-row"><strong className={(position.realizedPnl ?? 0) >= 0 ? 'text-buy' : 'text-sell'}>CLOSED {position.reason}</strong><span className="numeric">${fmt(position.realizedPnl)}</span></div>)}
        {!orders.length && !open.length && !closed.length && <div className="empty-state compact-empty"><p>Henüz kâğıt işlem yok.</p></div>}
      </div></div>
      <div className="notice notice--warning">Gerçek emir gönderilmez. Fee, slippage, bekleyen dolum ve parçalı kâr-al varsayımları simüle edilir.</div>
    </section>
  )
}
