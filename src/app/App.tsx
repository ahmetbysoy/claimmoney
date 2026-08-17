import { lazy, Suspense, useEffect, useState } from 'react'
import { Header } from '../ui/components/Header'
import { TabBar } from '../ui/components/TabBar'
import { useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useDataStore } from '../store/dataStore'
import { WsManager } from '../core/ws/wsManager'
import { MarketRuntime } from '../application/marketRuntime'
import type { MarketEvent, Source } from '../types'
import { playBuy, playDisconnect, playSell } from '../core/audio/sound'
import { RuntimeContext } from './RuntimeContext'
import { LocalSessionRepository } from '../performance/persistence'
import '../styles/global.css'

const RadarScreen = lazy(() => import('../ui/screens/RadarScreen').then(module => ({ default: module.RadarScreen })))
const ChartScreen = lazy(() => import('../ui/screens/ChartScreen').then(module => ({ default: module.ChartScreen })))
const SignalsScreen = lazy(() => import('../ui/screens/SignalsScreen').then(module => ({ default: module.SignalsScreen })))
const MicrostructureScreen = lazy(() => import('../ui/screens/MicrostructureScreen').then(module => ({ default: module.MicrostructureScreen })))
const PaperScreen = lazy(() => import('../ui/screens/PaperScreen').then(module => ({ default: module.PaperScreen })))
const SettingsScreen = lazy(() => import('../ui/screens/SettingsScreen').then(module => ({ default: module.SettingsScreen })))

const loading = <div style={{ flex: 1, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>ClaimMoney yükleniyor…</div>

export default function App() {
  const tab = useUIStore(state => state.tab)
  const source = useSettingsStore(state => state.source)
  const symbol = useSettingsStore(state => state.symbol)
  const sound = useSettingsStore(state => state.sound)
  const haptics = useSettingsStore(state => state.haptics)
  const [connection, setConnection] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')
  const [runtime, setRuntime] = useState<MarketRuntime | null>(null)

  useEffect(() => {
    useDataStore.getState().resetReadModel()
    const market = new MarketRuntime({
      settings: () => useSettingsStore.getState(), enableNetworkServices: true,
      onSnapshot: snapshot => useDataStore.getState().applyRuntimeSnapshot(snapshot),
      onSignal: signal => {
        const settings = useSettingsStore.getState()
        const options = { sound: settings.sound, haptics: settings.haptics }
        signal.side === 'BUY' ? playBuy(options) : playSell(options)
        window.dispatchEvent(new CustomEvent('signal-fired', { detail: signal }))
      }
    })
    setRuntime(market); market.start()

    const manager = new WsManager(event => {
      if (event.type === 'heartbeat') return
      if (event.type === 'status') {
        setConnection(event.status)
        if (event.status === 'disconnected') {
          const settings = useSettingsStore.getState()
          playDisconnect({ sound: settings.sound, haptics: false })
        }
        return
      }
      const receiveTs = Date.now()
      let marketEvent: MarketEvent
      if (event.type === 'trade') marketEvent = { kind: 'trade', exchange: source, symbol, eventTs: event.data.ts, receiveTs, trade: event.data }
      else if (event.type === 'mark') marketEvent = { kind: 'markPrice', exchange: source, symbol, eventTs: event.data.ts, receiveTs, price: event.data.price, priceStr: event.data.priceStr }
      else if (event.data.kind === 'delta') marketEvent = { kind: 'bookDelta', exchange: source, symbol, eventTs: event.data.ts, receiveTs,
        bids: event.data.bids, asks: event.data.asks, firstSeq: event.data.firstSeq ?? 0, lastSeq: event.data.lastSeq ?? 0, checksum: event.data.checksum }
      else marketEvent = { kind: 'bookSnapshot', exchange: source, symbol, eventTs: event.data.ts, receiveTs,
        bids: event.data.bids, asks: event.data.asks, seq: event.data.lastSeq ?? 0, checksum: event.data.checksum }
      market.ingest(marketEvent)
    })
    manager.connect(source as Source, symbol)

    if (import.meta.env.DEV) {
      Object.assign(window, { __CLAIMMONEY_RUNTIME__: market, __DATASTORE__: useDataStore, __SETTINGS__: useSettingsStore })
    }
    return () => { manager.dispose(); void market.saveSession(new LocalSessionRepository()); market.dispose(); setRuntime(null) }
  }, [source, symbol])

  return (
    <RuntimeContext.Provider value={runtime}>
      <div className="pastel-bg"><div className="pastel-blob pastel-blob-1" /><div className="pastel-blob pastel-blob-2" /><div className="pastel-blob pastel-blob-3" /></div>
      <div className="phone-canvas">
        <Header connection={connection} onToggleSound={() => useSettingsStore.getState().setSound(!sound)} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
          <Suspense fallback={loading}>
            {tab === 'radar' && <RadarScreen />}
            {tab === 'chart' && <ChartScreen />}
            {tab === 'signals' && <SignalsScreen />}
            {tab === 'microstructure' && <MicrostructureScreen />}
            {tab === 'paper' && <PaperScreen />}
            {tab === 'settings' && <SettingsScreen />}
          </Suspense>
        </div>
        <TabBar />
        <div style={{ padding: '7px 12px', textAlign: 'center', fontSize: 9, color: 'var(--muted)', borderTop: '1px solid var(--border-soft)', background: 'rgba(255,255,255,0.72)' }}>
          ClaimMoney v2 • Araştırma ve eğitim amaçlıdır • Yatırım tavsiyesi değildir
        </div>
      </div>
    </RuntimeContext.Provider>
  )
}
