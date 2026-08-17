import { useRef, useState, type ChangeEvent } from 'react'
import { useDataStore } from '../../store/dataStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useMarketRuntime } from '../../app/RuntimeContext'
import { downloadJson, downloadText, LocalSessionRepository, type SessionSnapshot } from '../../performance/persistence'
import { ManualClock } from '../../application/clock'
import { MarketRuntime } from '../../application/marketRuntime'
import { MarketReplay, parseJsonLines } from '../../testing/replay/marketReplay'

const fmt = (value: number | undefined, digits = 2) => value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits)

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

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
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
      } catch { /* JSONL falls through to deterministic replay. */ }

      const events = parseJsonLines(text)
      if (!events.length) throw new Error('Kayıtta market olayı yok')
      const base = useSettingsStore.getState()
      const replaySettings = { ...base, symbol: events[0].symbol, source: events[0].exchange }
      const clock = new ManualClock(events[0].receiveTs)
      const isolated = new MarketRuntime({ settings: () => replaySettings, clock, enableNetworkServices: false })
      const result = new MarketReplay(clock, isolated).run(events)
      const report = { replay: result, session: isolated.exportSession(), snapshot: isolated.snapshot() }
      downloadJson(`claimmoney-replay-${Date.now()}.json`, report)
      isolated.dispose()
      setImportStatus(`Replay tamamlandı: ${result.processed} işlendi, ${result.rejected} reddedildi`)
    } catch (error) {
      setImportStatus(`İçe aktarma hatası: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      input.value = ''
    }
  }

  return <div className="scrollbar-thin" style={{ padding: 14, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
    <label style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><b>PAPER EXECUTION</b><div style={muted}>Gerçek emir gönderilmez. Fee, slippage, pending fill ve partial TP simülasyonu.</div></div><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} style={{ width: 22, height: 22 }} /></label>
    <section style={card}><div style={title}>ONAYLI TRADE PLANI</div>{!plan ? <div style={muted}>Onaylı sinyal bekleniyor.</div> : <>
      <div style={{ fontSize: 24, fontWeight: 900, color: plan.direction === 'LONG' ? 'var(--green)' : plan.direction === 'SHORT' ? 'var(--red)' : 'var(--muted)' }}>{plan.direction}</div>
      <div style={grid}><Metric label="Entry" value={fmt(plan.entry)} /><Metric label="Stop" value={fmt(plan.stop)} /><Metric label="TP1" value={fmt(plan.tp1)} /><Metric label="TP2" value={fmt(plan.tp2)} /><Metric label="Net RR" value={fmt(plan.rr)} /><Metric label="Güven" value={`${plan.confidence.toFixed(0)}%`} /></div>
      <div style={muted}>{plan.reason}</div></>}
    </section>
    <section style={card}><div style={title}>POSITION SIZE</div>{!size ? <div style={muted}>Geçerli risk planı yok.</div> : <div style={grid}><Metric label="Qty" value={fmt(size.qty, 5)} /><Metric label="Notional" value={`$${fmt(size.notional)}`} /><Metric label="Margin" value={`$${fmt(size.margin)}`} /><Metric label="Leverage" value={`${fmt(size.leverage, 1)}×`} /><Metric label="Max risk" value={`$${fmt(size.maxRiskUSD)}`} /><Metric label="Liq" value={fmt(size.liqPrice)} /></div>}</section>
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 5 }}><div style={title}>PERFORMANCE</div><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => runtime && downloadJson(`claimmoney-${Date.now()}.json`, runtime.exportSession())} style={button}>Oturum JSON</button>
        <button onClick={() => runtime && downloadText(`claimmoney-events-${Date.now()}.jsonl`, runtime.exportRecording(), 'application/x-ndjson')} style={button}>Kayıt JSONL</button>
        <button onClick={() => fileInput.current?.click()} style={button}>İçe aktar / replay</button>
        <input ref={fileInput} type="file" accept=".json,.jsonl,application/json,application/x-ndjson" hidden onChange={importFile} />
      </div></div>
      {importStatus && <div style={{ ...muted, color: importStatus.includes('hatası') ? 'var(--red)' : 'var(--green)' }}>{importStatus}</div>}
      <div style={grid}><Metric label="Trades" value={String(performance.trades)} /><Metric label="Win rate" value={`${performance.trades ? (performance.wins / performance.trades * 100).toFixed(0) : 0}%`} /><Metric label="Net PnL" value={`$${fmt(performance.netPnl)}`} /><Metric label="Net R" value={fmt(performance.netR)} /><Metric label="Profit factor" value={fmt(performance.pf)} /><Metric label="Max DD" value={`${fmt(performance.maxDD)}%`} /><Metric label="Sharpe" value={fmt(performance.sharpe)} /><Metric label="Fees" value={`$${fmt(performance.feesPaid)}`} /></div>
    </section>
    <section style={card}><div style={title}>ORDERS & POSITIONS</div>{orders.slice(-10).reverse().map(order => <div key={order.id} style={row}><b>{order.dir} {order.status}</b><span>{fmt(order.qty, 5)} @ {fmt(order.entry)}</span></div>)}{open.map(position => <div key={position.id} style={row}><b style={{ color: 'var(--green)' }}>OPEN {position.dir}</b><span>{fmt(position.qty, 5)} @ {fmt(position.entry)}</span></div>)}{closed.slice(0, 10).map(position => <div key={position.id} style={row}><b style={{ color: (position.realizedPnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>CLOSED {position.reason}</b><span>${fmt(position.realizedPnl)}</span></div>)}{!orders.length && !open.length && !closed.length && <div style={muted}>Henüz paper işlem yok.</div>}</section>
  </div>
}

function Metric({ label, value }: { label: string; value: string }) { return <div style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,.75)' }}><div style={muted}>{label}</div><b>{value}</b></div> }
const card = { padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.72)', border: '1px solid var(--border-soft)' }
const button = { border: '1px solid var(--border)', borderRadius: 8, background: 'white', padding: '5px 7px', fontSize: 8, cursor: 'pointer' }
const title = { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, color: 'var(--purple-deep)' }
const muted = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)', marginTop: 3 }
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }
const row = { display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border-soft)', fontFamily: 'var(--font-mono)', fontSize: 10 }
