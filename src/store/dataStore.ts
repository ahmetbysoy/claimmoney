import { create } from 'zustand'
import type { RuntimeSnapshot } from '../application/marketRuntime'
import type { Candle, FeatureFrame, Metrics, Signal } from '../types'
import type { EngineState } from '../core/signal/engine'
import type { FlowCandle } from '../core/flow/flowEngine'
import type { MicroSignal, PositionSize, TradePlan } from '../core/signal/tradePlan'
import type { Tracker, TrackerStats } from '../core/performance/signalTracker'
import type { PaperOrder, PaperPosition, PerformanceMetrics } from '../core/paper/paperTrading'
import type { RegimeResult } from '../core/signal/regimeClassifier'
import type { TelemetryEvent } from '../application/telemetry'
import type { CrossExchangeState, ArbitrageSpread } from '../core/crossExchange/crossExchange'
import type { OrderBook } from '../core/book/orderBookDiff'

const horizon = { count: 0, wins: 0, winRate: 0, average: 0, median: 0 }
const stats: TrackerStats = { count: 0, win15s: 0, win60s: 0, win300s: 0, avg15s: 0, avg60s: 0, avg300s: 0,
  avgMfe: 0, avgMae: 0, samples15s: 0, samples60s: 0, samples300s: 0,
  horizons: { '15s': { ...horizon }, '30s': { ...horizon }, '60s': { ...horizon }, '300s': { ...horizon }, '900s': { ...horizon } } }
const metrics: Metrics = { cvd: 0, cvdNorm: 0, cvdZ: 0, obi: 0, obiRaw: 0, velocity: 0, velocityZ: 0,
  microprice: 0, microDev: 0, vpin: 0, vpinLabel: 'Warming', detectorScore: 0, volatility: 0,
  divergence: 0, score: 0, quality: 'warming', filterReasons: [], price: 0, priceStr: '' }
const quote = { bid: 0, ask: 0, mid: 0, ts: 0, latencyMs: 0, status: 'disconnected' as const }
const crossExchange: CrossExchangeState = { binance: { ...quote }, bybit: { ...quote }, okx: { ...quote }, mexc: { ...quote } }
const arbitrage: ArbitrageSpread = { grossSpread: 0, spreadPct: 0, buyExchange: null, sellExchange: null, buyAsk: 0, sellBid: 0, valid: false }
const paperPerformance: PerformanceMetrics = { trades: 0, wins: 0, netR: 0, netPnl: 0, pf: 0, sharpe: 0, maxDD: 0, equity: [1000], avgHoldMs: 0, feesPaid: 0 }

export interface DataState {
  sessionId: string; symbol: string; price: number; priceStr: string; metrics: Metrics; frame: FeatureFrame | null
  engineState: EngineState; regime: RegimeResult; signals: Signal[]; detectorSignals: MicroSignal[]
  candles: Candle[]; flowCandles: FlowCandle[]; plan: TradePlan | null; positionSize: PositionSize | null
  cvd: number; lastUpdate: number; trackers: Tracker[]; stats: TrackerStats; paperOrders: PaperOrder[]
  openPositions: PaperPosition[]; closedPositions: PaperPosition[]; paperPerformance: PerformanceMetrics
  crossExchange: CrossExchangeState; arbitrage: ArbitrageSpread; book: OrderBook; telemetry: readonly TelemetryEvent[]
  applyRuntimeSnapshot: (snapshot: RuntimeSnapshot) => void; resetReadModel: () => void
}

const initial = () => ({
  sessionId: '', symbol: 'BTCUSDT', price: 0, priceStr: '', metrics: { ...metrics, filterReasons: [] }, frame: null,
  engineState: 'IDLE' as EngineState, regime: { regime: 'warming', confidence: 1, reasons: ['No data'] } as RegimeResult,
  signals: [] as Signal[], detectorSignals: [] as MicroSignal[], candles: [] as Candle[], flowCandles: [] as FlowCandle[],
  plan: null as TradePlan | null, positionSize: null as PositionSize | null, cvd: 0, lastUpdate: 0,
  trackers: [] as Tracker[], stats: structuredClone(stats), paperOrders: [] as PaperOrder[], openPositions: [] as PaperPosition[],
  closedPositions: [] as PaperPosition[], paperPerformance: structuredClone(paperPerformance), crossExchange: structuredClone(crossExchange),
  arbitrage: { ...arbitrage }, book: { bids: [], asks: [], ts: 0, lastUpdateId: 0, synced: false } as OrderBook,
  telemetry: [] as readonly TelemetryEvent[]
})

export const useDataStore = create<DataState>((set) => ({
  ...initial(),
  applyRuntimeSnapshot: snapshot => set({
    sessionId: snapshot.sessionId, symbol: snapshot.symbol, price: snapshot.price, priceStr: snapshot.priceStr,
    metrics: snapshot.metrics, frame: snapshot.frame, engineState: snapshot.engineState, regime: snapshot.regime,
    signals: snapshot.signals, detectorSignals: snapshot.detectorSignals, candles: snapshot.candles,
    flowCandles: snapshot.flowCandles, plan: snapshot.plan, positionSize: snapshot.positionSize,
    cvd: snapshot.metrics.cvdNorm, lastUpdate: snapshot.frame?.eventTs ?? 0, trackers: snapshot.trackers,
    stats: snapshot.stats, paperOrders: snapshot.paperOrders, openPositions: snapshot.openPositions,
    closedPositions: snapshot.closedPositions, paperPerformance: snapshot.paperPerformance,
    crossExchange: snapshot.crossExchange, arbitrage: snapshot.arbitrage, book: snapshot.book, telemetry: snapshot.telemetry
  }),
  resetReadModel: () => set(state => ({ ...initial(), applyRuntimeSnapshot: state.applyRuntimeSnapshot, resetReadModel: state.resetReadModel }))
}))
