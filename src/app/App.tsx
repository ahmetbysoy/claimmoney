import { lazy, Suspense, useEffect, useState } from 'react'
import { Header } from '../ui/components/Header'
import { TabBar } from '../ui/components/TabBar'
import { useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { useDataStore } from '../store/dataStore'
import { WsManager } from '../core/ws/wsManager'
import { MarketRuntime } from '../application/marketRuntime'
import type { Source } from '../types'
import { playBuy, playDisconnect, playSell } from '../core/audio/sound'
import { RuntimeContext } from './RuntimeContext'
import { LocalSessionRepository } from '../performance/persistence'
import { reportClientError } from '../observability/clientErrorReporter'
import { LocalResearchRepository } from '../performance/researchRepository'
import '../styles/global.css'

const RadarScreen = lazy(() => import('../ui/screens/RadarScreen').then(module => ({ default: module.RadarScreen })))
const ChartScreen = lazy(() => import('../ui/screens/ChartScreen').then(module => ({ default: module.ChartScreen })))
const SignalsScreen = lazy(() => import('../ui/screens/SignalsScreen').then(module => ({ default: module.SignalsScreen })))
const MicrostructureScreen = lazy(() => import('../ui/screens/MicrostructureScreen').then(module => ({ default: module.MicrostructureScreen })))
const PaperScreen = lazy(() => import('../ui/screens/PaperScreen').then(module => ({ default: module.PaperScreen })))
const ResearchScreen = lazy(() => import('../ui/screens/ResearchScreen').then(module => ({ default: module.ResearchScreen })))
const SettingsScreen = lazy(() => import('../ui/screens/SettingsScreen').then(module => ({ default: module.SettingsScreen })))

function LoadingFallback() {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div><div className="loading-bars" aria-hidden="true"><span /><span /><span /><span /></div><p>Görünüm hazırlanıyor…</p></div>
    </div>
  )
}

export default function App() {
  const tab = useUIStore(state => state.tab)
  const source = useSettingsStore(state => state.source)
  const symbol = useSettingsStore(state => state.symbol)
  const reducedMotion = useSettingsStore(state => state.reducedMotion)
  const [connection, setConnection] = useState<'connected' | 'connecting' | 'disconnected'>('connecting')
  const [runtime, setRuntime] = useState<MarketRuntime | null>(null)

  useEffect(() => {
    useDataStore.getState().resetReadModel()
    let manager: WsManager | null = null
    const market = new MarketRuntime({
      settings: () => useSettingsStore.getState(), enableNetworkServices: true,
      onBookResyncRequired: context => manager?.resync(`Book gap: expected ${context.expected}, received ${context.received}`),
      onSnapshot: snapshot => useDataStore.getState().applyRuntimeSnapshot(snapshot),
      onSignal: signal => {
        const settings = useSettingsStore.getState()
        const options = { sound: settings.sound, haptics: settings.haptics }
        signal.side === 'BUY' ? playBuy(options) : playSell(options)
        window.dispatchEvent(new CustomEvent('signal-fired', { detail: signal }))
      }
    })
    setRuntime(market)
    market.start()

    manager = new WsManager(event => {
      if ('type' in event) {
        if (event.type === 'diagnostic') {
          reportClientError(new Error(event.message), `websocket.${event.code}`, { source: event.source, symbol, droppedMessages: event.droppedMessages })
          return
        }
        const visibleState = event.status === 'connected' || event.status === 'connecting' ? event.status : 'disconnected'
        setConnection(visibleState)
        if (event.status === 'disconnected') {
          const settings = useSettingsStore.getState()
          playDisconnect({ sound: settings.sound, haptics: false })
          reportClientError(new Error(event.message ?? 'Unexpected WebSocket disconnect'), 'websocket.disconnect', { source: event.source, symbol })
        }
        return
      }
      market.ingest(event)
    })
    manager.connect(source as Source, symbol)

    const sessionRepository = new LocalSessionRepository()
    const researchRepository = new LocalResearchRepository()
    const checkpoint = () => {
      if (!market.hasActivity()) return
      sessionRepository.saveSync(market.exportSession())
      researchRepository.upsert(market.exportResearchObservations())
    }
    const checkpointTimer = window.setInterval(checkpoint, 60_000)
    const onVisibility = () => { if (document.hidden) checkpoint() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', checkpoint)

    if (import.meta.env.DEV) Object.assign(window, { __CLAIMMONEY_RUNTIME__: market, __DATASTORE__: useDataStore, __SETTINGS__: useSettingsStore })
    return () => {
      window.clearInterval(checkpointTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', checkpoint)
      manager?.dispose()
      checkpoint()
      market.dispose()
      setRuntime(null)
    }
  }, [source, symbol])

  return (
    <RuntimeContext.Provider value={runtime}>
      <div className="app-shell" data-testid="app-shell" data-reduced-motion={reducedMotion}>
        <Header connection={connection} source={source.toUpperCase()} symbol={symbol} />
        <main className="app-main" id="main-content">
          <Suspense fallback={<LoadingFallback />}>
            {tab === 'radar' && <RadarScreen />}
            {tab === 'chart' && <ChartScreen />}
            {tab === 'signals' && <SignalsScreen />}
            {tab === 'microstructure' && <MicrostructureScreen />}
            {tab === 'paper' && <PaperScreen />}
            {tab === 'research' && <ResearchScreen />}
            {tab === 'settings' && <SettingsScreen />}
          </Suspense>
        </main>
        <div className="app-footer-note" role="note">Araştırma ve kâğıt işlem simülasyonu. Finansal tavsiye değildir.</div>
        <TabBar />
      </div>
    </RuntimeContext.Provider>
  )
}
