import type { Clock } from './clock'
import { systemClock } from './clock'
import type { MemoryTelemetry, TelemetrySink } from './telemetry'
import type { DataQualityGate } from './dataQualityGate'
import { validateMarketEvent } from '../domain/validation'
import { inferInstrument, type InstrumentSpec } from '../domain/instrument'
import type { FeatureFrame, MarketEvent, Metrics, Signal, Source } from '../types'
import { computeConfidence, type EngineState } from '../core/signal/engine'
import type { DecisionPipeline, DecisionResult } from '../core/signal/decisionPipeline'
import type { OrderBookDiff, MicrostructureData, OrderBook } from '../core/book/orderBookDiff'
import type { VPIN } from '../core/indicators/vpin'
import type { FlowEngine, FlowCandle } from '../core/flow/flowEngine'
import type { DetectorSuite, Liquidation } from '../core/detectors/detectorSuite'
import type { DetectorCandidate, DetectorRegistry } from '../core/detectors/detectorRegistry'
import type { MicroSignal, PositionSize, TradePlan, WallEntry } from '../core/signal/tradePlan'
import type { SignalTracker, Tracker, TrackerStats } from '../core/performance/signalTracker'
import type { FeatureFrameBuilder } from '../features/featureFrameBuilder'
import type { CandleBuilder } from '../features/candleBuilder'
import type { PaperTradingEngine, PaperOrder, PaperPosition, PerformanceMetrics } from '../core/paper/paperTrading'
import type { CrossExchangePoller, ArbitrageSpread, CrossExchangeState } from '../core/crossExchange/crossExchange'
import type { ProbabilityCalibrator } from '../performance/calibration'
import type { SessionRepository, SessionSnapshot } from '../performance/persistence'
import { classifyRegime, type RegimeResult } from '../core/signal/regimeClassifier'
import type { MarketRecorder } from '../testing/replay/marketReplay'
import type { ResearchObservation } from '../performance/researchRepository'
import { createRuntimeCollaborators, type RuntimeCollaborators } from './runtimeCollaborators'
import type { SignalExecutionCoordinator } from './signalExecutionCoordinator'

export interface RuntimeSettings {
  source: Source; symbol: string; weights: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number }
  threshold: number; cooldown: number; confirmations: number; minConfirmationMs: number
  paperTradingEnabled: boolean; balance: number; riskPct: number
}
export interface RuntimeSnapshot {
  sessionId: string; symbol: string; source: Source; price: number; priceStr: string; markPrice: number; frame: FeatureFrame | null
  metrics: Metrics; engineState: EngineState; decision: DecisionResult | null; regime: RegimeResult
  signals: Signal[]; detectorSignals: MicroSignal[]; trackers: Tracker[]; stats: TrackerStats
  candles: ReturnType<CandleBuilder['getCandles']>; flowCandles: FlowCandle[]; book: OrderBook
  plan: TradePlan | null; positionSize: PositionSize | null; paperOrders: PaperOrder[]
  openPositions: PaperPosition[]; closedPositions: PaperPosition[]; paperPerformance: PerformanceMetrics
  crossExchange: CrossExchangeState; arbitrage: ArbitrageSpread; telemetry: ReturnType<MemoryTelemetry['getAll']>
}
export interface RuntimeOptions {
  settings: () => RuntimeSettings
  onSnapshot?: (snapshot: RuntimeSnapshot) => void
  onSignal?: (signal: Signal) => void
  onBookResyncRequired?: (context: { expected: number; received: number; previousSeq?: number }) => void
  clock?: Clock; telemetry?: TelemetrySink; enableNetworkServices?: boolean; instrument?: InstrumentSpec
  collaborators?: RuntimeCollaborators
  snapshotIntervalMs?: number
}

const emptyHorizon = () => ({ count: 0, wins: 0, winRate: 0, average: 0, median: 0 })
const emptyStats: TrackerStats = {
  count: 0, win15s: 0, win60s: 0, win300s: 0, avg15s: 0, avg60s: 0, avg300s: 0,
  avgMfe: 0, avgMae: 0, samples15s: 0, samples60s: 0, samples300s: 0,
  horizons: { '15s': emptyHorizon(), '30s': emptyHorizon(), '60s': emptyHorizon(), '300s': emptyHorizon(), '900s': emptyHorizon() }
}
const emptyMetrics = (): Metrics => ({
  cvd: 0, cvdNorm: 0, cvdZ: 0, obi: 0, obiRaw: 0, velocity: 0, velocityZ: 0,
  microprice: 0, microDev: 0, vpin: 0, vpinLabel: 'Warming', detectorScore: 0,
  volatility: 0, divergence: 0, score: 0, quality: 'warming', filterReasons: [], price: 0, priceStr: ''
})

export class MarketRuntime {
  readonly sessionId: string
  readonly telemetry: MemoryTelemetry
  readonly tracker: SignalTracker
  readonly paper: PaperTradingEngine
  readonly crossExchange: CrossExchangePoller
  readonly calibrator: ProbabilityCalibrator
  readonly recorder: MarketRecorder

  private readonly clock: Clock
  private readonly externalTelemetry?: TelemetrySink
  private readonly settingsProvider: () => RuntimeSettings
  private readonly onSnapshot?: (snapshot: RuntimeSnapshot) => void
  private readonly onSignal?: (signal: Signal) => void
  private readonly book: OrderBookDiff
  private readonly vpin: VPIN
  private readonly flow: FlowEngine
  private readonly detectorSuite: DetectorSuite
  private readonly detectorRegistry: DetectorRegistry
  private readonly features: FeatureFrameBuilder
  private readonly candles: CandleBuilder
  private readonly decision: DecisionPipeline
  private readonly qualityGate: DataQualityGate
  private readonly signalExecution: SignalExecutionCoordinator
  private instrument: InstrumentSpec
  private timer: ReturnType<typeof setInterval> | null = null
  private source: Source
  private symbol: string
  private price = 0
  private priceStr = ''
  private markPrice = 0
  private lastTradeTs = 0
  private lastBookTs = 0
  private micro: MicrostructureData | null = null
  private frame: FeatureFrame | null = null
  private liquidations: Liquidation[] = []
  private decisionResult: DecisionResult | null = null
  private regime: RegimeResult = { regime: 'warming', confidence: 1, reasons: ['No feature frame'] }
  private signals: Signal[] = []
  private cachedSignalsSource: Signal[] | null = null
  private cachedSignalSnapshots: Signal[] = []
  private plan: TradePlan | null = null
  private positionSize: PositionSize | null = null
  private lastSnapshotAt = 0
  private readonly snapshotIntervalMs: number
  private readonly unsubscribers: (() => void)[] = []
  private disposed = false
  private readonly enableNetworkServices: boolean

  constructor(options: RuntimeOptions) {
    this.clock = options.clock ?? systemClock
    this.settingsProvider = options.settings; this.onSnapshot = options.onSnapshot; this.onSignal = options.onSignal
    this.enableNetworkServices = options.enableNetworkServices ?? false
    const settings = this.settingsProvider(); this.source = settings.source; this.symbol = settings.symbol
    this.instrument = options.instrument ?? inferInstrument(settings.symbol)
    this.sessionId = `${this.symbol}-${this.clock.now()}`
    this.externalTelemetry = options.telemetry
    this.snapshotIntervalMs = Math.max(100, options.snapshotIntervalMs ?? 250)
    const collaborators = options.collaborators ?? createRuntimeCollaborators(this.clock, this.instrument, settings)
    this.telemetry = collaborators.telemetry; this.book = collaborators.book; this.vpin = collaborators.vpin
    this.flow = collaborators.flow; this.detectorSuite = collaborators.detectorSuite; this.detectorRegistry = collaborators.detectorRegistry
    this.features = collaborators.features; this.candles = collaborators.candles; this.calibrator = collaborators.calibrator
    this.decision = collaborators.decision; this.tracker = collaborators.tracker; this.qualityGate = collaborators.qualityGate
    this.signalExecution = collaborators.signalExecution; this.paper = collaborators.paper
    this.crossExchange = collaborators.crossExchange; this.recorder = collaborators.recorder

    this.unsubscribers.push(this.detectorSuite.on('signal:add', (raw: DetectorCandidate) => {
      try { this.detectorRegistry.add(raw) }
      catch (error) { this.record('error', 'detector.signal', error) }
    }))
    this.unsubscribers.push(this.tracker.on('horizon', event => {
      if (event.horizon !== '60s') return
      const signal = this.signals.find(item => item.id === event.id)
      if (signal) this.calibrator.add({ score: signal.score, side: signal.side, won: event.pnl > 0, ts: this.clock.now(), strategyVersion: signal.strategyVersion ?? 'claimmoney-v2' })
    }))
    this.unsubscribers.push(this.book.on('book:resync-required', event => {
      this.record('warn', 'book.sequence-gap', new Error('Order book sequence gap'), event)
      options.onBookResyncRequired?.(event)
    }))
    this.unsubscribers.push(this.crossExchange.on('crossExchange:update', () => this.publish()))
  }

  private record(level: 'debug' | 'info' | 'warn' | 'error', code: string, error: unknown, context?: Record<string, unknown>): void {
    const event = { level, code, message: error instanceof Error ? error.message : String(error), ts: this.clock.now(), context }
    this.telemetry.record(event); this.externalTelemetry?.record(event)
  }

  start(): void {
    if (this.timer || this.disposed) return
    if (this.enableNetworkServices) this.crossExchange.start(this.symbol)
    this.timer = setInterval(() => this.flush(this.clock.now()), 100)
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.crossExchange.stop() }
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe()
    this.reset()
  }

  ingest(event: MarketEvent): void {
    if (this.disposed) return
    const validation = validateMarketEvent(event)
    if (!validation.ok) { this.record('warn', 'market.invalid-event', new Error(validation.errors.join('; '))); return }
    if (event.symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase() !== this.symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase()) return
    this.recorder.record(event)
    this.source = event.exchange
    try {
      if (event.kind === 'trade') this.ingestTrade(event)
      else if (event.kind === 'markPrice') this.ingestMark(event)
      else if (event.kind === 'bookSnapshot') this.ingestSnapshot(event)
      else if (event.kind === 'bookDelta') this.ingestDelta(event)
      else if (event.kind === 'liquidation') this.ingestLiquidation(event)
      if (event.kind !== 'markPrice') this.flush(event.eventTs)
    } catch (error) { this.record('error', `market.ingest.${event.kind}`, error) }
  }

  private ingestTrade(event: Extract<MarketEvent, { kind: 'trade' }>): void {
    const trade = { ...event.trade, exchange: event.exchange, symbol: event.symbol, receiveTs: event.receiveTs,
      notional: event.trade.notional ?? event.trade.price * event.trade.qty }
    this.lastTradeTs = Math.max(this.lastTradeTs, event.eventTs); this.price = trade.price; this.priceStr = trade.priceStr ?? String(trade.price)
    this.features.addTrade(trade)
    const history = this.features.getTrades(200).map(item => ({ notional: item.notional ?? item.price * item.qty }))
    this.vpin.update({ price: trade.price, qty: trade.qty, side: trade.side, notional: trade.notional, ts: trade.ts }, history)
    this.flow.updateBucket({ price: trade.price, notional: trade.notional, side: trade.side, ts: trade.ts })
    this.candles.update(trade.price, trade.ts, trade.qty, trade.side)
    this.tracker.updatePrice(trade.price, trade.ts, this.symbol); this.paper.update(trade.price, this.executionBook(trade.ts))
  }

  private ingestMark(event: Extract<MarketEvent, { kind: 'markPrice' }>): void {
    // Mark is retained for risk/display context only. It must not masquerade as a traded/executable price.
    this.markPrice = event.price
  }

  private ingestLiquidation(event: Extract<MarketEvent, { kind: 'liquidation' }>): void {
    this.liquidations.push({
      side: event.side === 'long' ? 'SELL' : 'BUY', price: event.price, qty: event.qty,
      notional: event.notional, ts: event.eventTs
    })
    const cutoff = event.eventTs - 30_000
    this.liquidations = this.liquidations.filter(item => item.ts >= cutoff).slice(-1_000)
    this.runDetectors()
  }

  private ingestSnapshot(event: Extract<MarketEvent, { kind: 'bookSnapshot' }>): void {
    this.book.applySnapshot(event.symbol, { bids: event.bids, asks: event.asks, lastUpdateId: event.seq, ts: event.eventTs })
    this.lastBookTs = event.eventTs; this.micro = this.book.getMicrostructure(); this.runDetectors()
  }
  private ingestDelta(event: Extract<MarketEvent, { kind: 'bookDelta' }>): void {
    const result = this.book.applyDelta({ bids: event.bids, asks: event.asks, U: event.firstSeq, u: event.lastSeq,
      previousSeq: event.previousSeq, ts: event.eventTs })
    if (result === 'applied') { this.lastBookTs = event.eventTs; this.micro = this.book.getMicrostructure(); this.runDetectors() }
  }

  private runDetectors(): void {
    if (!this.micro) return
    this.detectorSuite.setData({
      book: this.book.getBook(), micro: this.micro, lastPrice: this.price, vpinValue: this.vpin.getValue(),
      flowCandles: this.flow.getCandles(), cvdHistory: this.features.getCvdHistory(), liquidations: this.liquidations,
      trades: this.features.getTrades(200).map(trade => ({ price: trade.price, notional: trade.notional ?? trade.price * trade.qty, side: trade.side }))
    })
    this.detectorSuite.run()
  }

  flush(at: number): void {
    if (!this.price) return
    this.flow.tick(this.price, 0, at)
    const detector = this.detectorRegistry.aggregate(this.price, at)
    const vpin = this.vpin.getState()
    const frame = this.features.build({ at, symbol: this.symbol, exchange: this.source, price: this.price, priceStr: this.priceStr,
      micro: this.micro, bookSynced: this.book.isSynced(), bookAgeMs: this.lastBookTs ? Math.max(0, at - this.lastBookTs) : Infinity,
      tradeAgeMs: this.lastTradeTs ? Math.max(0, at - this.lastTradeTs) : Infinity, vpin,
      detectorBull: detector.bull, detectorBear: detector.bear })
    if (!frame) { this.publish(); return }
    frame.quality = this.qualityGate.evaluate({
      now: at, lastTradeTs: this.lastTradeTs, lastBookTs: this.lastBookTs, bookSynced: this.book.isSynced(),
      requiredFeaturesValid: frame.cvdZ.valid && frame.velocityZ.valid && frame.obi.valid && frame.microDev.valid && frame.vpin.valid
    }).quality
    this.frame = frame; this.regime = classifyRegime(frame)
    const settings = this.settingsProvider()
    const cross = this.crossExchange.getMaxSpread()
    this.decisionResult = this.decision.evaluate(frame, this.features.getPriceHistory(), {
      weights: settings.weights, threshold: settings.threshold, cooldownMs: settings.cooldown * 1000,
      confirmations: settings.confirmations, minConfirmationMs: settings.minConfirmationMs,
      crossSpreadPct: Math.max(0, cross.spreadPct), strategyVersion: 'claimmoney-v2'
    })
    if (this.decisionResult.signal) this.acceptSignal(this.decisionResult.signal)
    this.publish()
  }

  private executionBook(at: number): { bids: { price: number; qty: number }[]; asks: { price: number; qty: number }[] } | undefined {
    if (!this.book.isSynced() || !this.lastBookTs || Math.max(0, at - this.lastBookTs) > 1_500) return undefined
    const book = this.book.getBook()
    return { bids: book.bids.map(({ price, qty }) => ({ price, qty })), asks: book.asks.map(({ price, qty }) => ({ price, qty })) }
  }

  private wallEntries(): { bid: WallEntry[]; ask: WallEntry[] } {
    const walls = this.detectorSuite.getWalls()
    return { bid: walls.bid.map(({ price, qty, notional, persistence }) => ({ price, qty, notional, persistence })),
      ask: walls.ask.map(({ price, qty, notional, persistence }) => ({ price, qty, notional, persistence })) }
  }

  private acceptSignal(signal: Signal): void {
    const activeDetectors = this.detectorRegistry.aggregate(this.price, signal.ts).active
    const accepted: Signal = {
      ...signal,
      research: {
        regime: this.regime.regime,
        regimeConfidence: this.regime.confidence,
        dataQuality: this.frame?.quality ?? 'warming',
        detectorTypes: [...new Set(activeDetectors.map(item => item.type))].sort(),
        volatilityBps: this.frame?.volatility.value ?? 0,
        vpin: this.frame?.vpin.value ?? this.vpin.getValue(),
        spreadBps: this.micro?.spreadBps ?? 0,
        isTest: Boolean(signal.strategyVersion?.includes('-test'))
      }
    }
    this.signals = [accepted, ...this.signals].slice(0, 500); this.tracker.addSignal(accepted); this.onSignal?.(accepted)
    const settings = this.settingsProvider()
    const execution = this.signalExecution.process({
      signal: accepted, spread: this.frame?.spread ?? 0, volatilityBps: this.frame?.volatility.value ?? 5,
      walls: this.wallEntries(), instrument: this.instrument, balance: settings.balance, riskPct: settings.riskPct,
      paperTradingEnabled: settings.paperTradingEnabled, lastPrice: this.price
    })
    this.plan = execution.plan; this.positionSize = execution.positionSize
  }

  private metrics(): Metrics {
    if (!this.frame || !this.decisionResult) return { ...emptyMetrics(), price: this.price, priceStr: this.priceStr }
    return {
      cvd: this.frame.cvdNorm.value, cvdNorm: this.frame.cvdNorm.value, cvdZ: this.frame.cvdZ.value,
      obi: this.frame.obi.value, obiRaw: this.frame.obi.value, velocity: this.frame.velocityZ.value,
      velocityZ: this.frame.velocityZ.value, microprice: this.micro?.microprice ?? 0, microDev: this.frame.microDev.value,
      vpin: this.frame.vpin.value, vpinLabel: this.vpin.getLabel(), detectorScore: this.frame.detectorScore.value,
      volatility: this.frame.volatility.value, divergence: this.frame.divergence.value,
      score: this.decisionResult.adjustedScore, quality: this.frame.quality,
      filterReasons: (this.decisionResult.filters ?? []).filter(item => !item.pass).map(item => item.reason),
      price: this.price, priceStr: this.priceStr
    }
  }

  exportSession(): SessionSnapshot {
    const snapshot = this.snapshot()
    return {
      version: 1, sessionId: this.sessionId, symbol: this.symbol, strategyVersion: 'claimmoney-v2',
      startedAt: Number(this.sessionId.split('-').at(-1)) || 0, endedAt: this.clock.now(),
      payload: {
        signals: snapshot.signals, trackers: snapshot.trackers, stats: snapshot.stats,
        paperPerformance: snapshot.paperPerformance, closedPositions: snapshot.closedPositions,
        calibration: JSON.parse(this.calibrator.export()), telemetry: snapshot.telemetry
      }
    }
  }

  async saveSession(repository: SessionRepository): Promise<void> { await repository.save(this.exportSession()) }
  exportRecording(): string { return this.recorder.toJsonLines() }
  hasActivity(): boolean { return this.recorder.size() > 0 || this.signals.length > 0 }

  exportResearchObservations(): ResearchObservation[] {
    const trackers = new Map(this.tracker.getAll().map(item => [item.signalId, item]))
    return this.signals.flatMap(signal => {
      const tracker = trackers.get(signal.id)
      if (!tracker) return []
      const context = signal.research
      return [{
        version: 1 as const,
        id: `${this.sessionId}:${signal.id}`, sessionId: this.sessionId, signalId: signal.id,
        symbol: signal.symbol ?? this.symbol, strategyVersion: signal.strategyVersion ?? 'claimmoney-v2',
        side: signal.side, score: signal.score, confidence: signal.confidence,
        calibratedProbability: signal.calibratedProbability, entry: tracker.entry, entryTs: tracker.entryTs,
        regime: context?.regime ?? 'unknown', regimeConfidence: context?.regimeConfidence ?? 0,
        dataQuality: context?.dataQuality ?? 'warming', detectorTypes: [...(context?.detectorTypes ?? [])],
        volatilityBps: context?.volatilityBps ?? 0, vpin: context?.vpin ?? 0, spreadBps: context?.spreadBps ?? 0,
        isTest: context?.isTest ?? Boolean(signal.strategyVersion?.includes('-test')),
        horizons: { ...tracker.horizons }, mfe: tracker.mfe, mae: tracker.mae, closed: tracker.closed, updatedAt: this.clock.now()
      }]
    })
  }

  injectTestSignal(side: 'BUY' | 'SELL'): Signal {
    const settings = this.settingsProvider()
    const score = side === 'BUY' ? Math.max(settings.threshold + 0.25, 1) : -Math.max(settings.threshold + 0.25, 1)
    const signal: Signal = {
      id: `test-${this.clock.now()}-${side}`, symbol: this.symbol, exchange: this.source, side,
      price: this.price || 50_000, priceStr: this.priceStr || String(this.price || 50_000), confidence: computeConfidence(score),
      score, breakdown: { cvd: score * 0.7, obi: score * 0.3, vel: score * 0.4, micro: score * 0.2,
        vpin: this.vpin.getValue(), detector: 0, divergence: 0, ...settings.weights },
      filters: [{ id: 'test', mode: 'hard-veto', pass: true, reason: 'User-injected test signal', adjustment: 0 }],
      frameId: this.frame?.id ?? 'test-frame', strategyVersion: 'claimmoney-v2-test', ts: this.clock.now()
    }
    this.acceptSignal(signal); this.publish(true); return signal
  }

  private signalSnapshots(): Signal[] {
    if (this.cachedSignalsSource !== this.signals) {
      this.cachedSignalsSource = this.signals
      this.cachedSignalSnapshots = this.signals.map(signal => structuredClone(signal))
    }
    return this.cachedSignalSnapshots
  }

  snapshot(): RuntimeSnapshot {
    return {
      sessionId: this.sessionId, symbol: this.symbol, source: this.source, price: this.price, priceStr: this.priceStr,
      markPrice: this.markPrice, frame: this.frame ? structuredClone(this.frame) : null, metrics: this.metrics(), engineState: this.decisionResult?.state ?? 'IDLE',
      decision: this.decisionResult ? structuredClone(this.decisionResult) : null, regime: { ...this.regime, reasons: [...this.regime.reasons] },
      signals: this.signalSnapshots(), detectorSignals: this.detectorRegistry.aggregate(this.price).active,
      trackers: this.tracker.getAll(), stats: this.tracker.getStats(), candles: this.candles.getCandles(), flowCandles: this.flow.getCandles(),
      book: this.book.getBook(), plan: this.plan ? structuredClone(this.plan) : null,
      positionSize: this.positionSize ? { ...this.positionSize } : null, paperOrders: this.paper.getOrders(),
      openPositions: this.paper.getOpenPositions(), closedPositions: this.paper.getClosedPositions(), paperPerformance: this.paper.getPerformance(),
      crossExchange: this.crossExchange.getState(), arbitrage: this.crossExchange.getMaxSpread(), telemetry: this.telemetry.getAll()
    }
  }
  private publish(force = false): void {
    if (this.disposed) return
    const now = this.clock.now()
    if (!force && now - this.lastSnapshotAt < this.snapshotIntervalMs) return
    this.lastSnapshotAt = now
    this.onSnapshot?.(this.snapshot())
  }

  reset(): void {
    this.book.reset(); this.vpin.reset(); this.flow.reset(); this.detectorSuite.reset(); this.detectorRegistry.reset(); this.features.reset();
    this.candles.reset(); this.decision.reset(); this.tracker.clear(); this.paper.reset(); this.signalExecution.reset()
    this.crossExchange.resetData(); this.calibrator.clear(); this.recorder.clear()
    this.price = 0; this.priceStr = ''; this.markPrice = 0; this.lastTradeTs = 0; this.lastBookTs = 0; this.micro = null; this.frame = null; this.liquidations = []
    this.decisionResult = null; this.signals = []; this.cachedSignalsSource = null; this.cachedSignalSnapshots = []
    this.plan = null; this.positionSize = null
    this.publish(true)
  }
}

export const INITIAL_RUNTIME_SNAPSHOT: Omit<RuntimeSnapshot, 'sessionId' | 'symbol' | 'source' | 'book' | 'crossExchange' | 'arbitrage' | 'paperPerformance'> = {
  price: 0, priceStr: '', markPrice: 0, frame: null, metrics: emptyMetrics(), engineState: 'IDLE', decision: null,
  regime: { regime: 'warming', confidence: 1, reasons: ['No data'] }, signals: [], detectorSignals: [], trackers: [], stats: emptyStats,
  candles: [], flowCandles: [], plan: null, positionSize: null, paperOrders: [], openPositions: [], closedPositions: [], telemetry: []
}
