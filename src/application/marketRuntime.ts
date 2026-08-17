import type { Clock } from './clock'
import { systemClock } from './clock'
import { MemoryTelemetry, type TelemetrySink } from './telemetry'
import { DataQualityGate } from './dataQualityGate'
import { validateMarketEvent } from '../domain/validation'
import { inferInstrument, type InstrumentSpec } from '../domain/instrument'
import type { FeatureFrame, MarketEvent, Metrics, Signal, Source } from '../types'
import type { EngineState } from '../core/signal/engine'
import { SignalEngine } from '../core/signal/engine'
import { DecisionPipeline, type DecisionResult } from '../core/signal/decisionPipeline'
import { OrderBookDiff, type MicrostructureData, type OrderBook } from '../core/book/orderBookDiff'
import { VPIN } from '../core/indicators/vpin'
import { FlowEngine, type FlowCandle } from '../core/flow/flowEngine'
import { DetectorSuite } from '../core/detectors/detectorSuite'
import { DetectorRegistry } from '../core/detectors/detectorRegistry'
import type { MicroSignal, PositionSize, TradePlan, WallEntry } from '../core/signal/tradePlan'
import { SignalTracker, type Tracker, type TrackerStats } from '../core/performance/signalTracker'
import { FeatureFrameBuilder } from '../features/featureFrameBuilder'
import { CandleBuilder } from '../features/candleBuilder'
import { TradePlanner } from '../risk/tradePlanner'
import { PositionSizer } from '../risk/positionSizer'
import { PaperTradingEngine, type PaperOrder, type PaperPosition, type PerformanceMetrics } from '../core/paper/paperTrading'
import { CrossExchangePoller, type ArbitrageSpread, type CrossExchangeState } from '../core/crossExchange/crossExchange'
import { ProbabilityCalibrator } from '../performance/calibration'
import type { SessionRepository, SessionSnapshot } from '../performance/persistence'
import { classifyRegime, type RegimeResult } from '../core/signal/regimeClassifier'
import { MarketRecorder } from '../testing/replay/marketReplay'

export interface RuntimeSettings {
  source: Source; symbol: string; weights: { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number }
  threshold: number; cooldown: number; confirmations: number; minConfirmationMs: number
  paperTradingEnabled: boolean; balance: number; riskPct: number
}
export interface RuntimeSnapshot {
  sessionId: string; symbol: string; source: Source; price: number; priceStr: string; frame: FeatureFrame | null
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
  clock?: Clock; telemetry?: TelemetrySink; enableNetworkServices?: boolean; instrument?: InstrumentSpec
}

const emptyStats = new SignalTracker().getStats()
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
  readonly recorder = new MarketRecorder(10_000)

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
  private readonly qualityGate = new DataQualityGate()
  private readonly planner = new TradePlanner()
  private readonly sizer: PositionSizer
  private instrument: InstrumentSpec
  private timer: ReturnType<typeof setInterval> | null = null
  private source: Source
  private symbol: string
  private price = 0
  private priceStr = ''
  private lastTradeTs = 0
  private lastBookTs = 0
  private micro: MicrostructureData | null = null
  private frame: FeatureFrame | null = null
  private decisionResult: DecisionResult | null = null
  private regime: RegimeResult = { regime: 'warming', confidence: 1, reasons: ['No feature frame'] }
  private signals: Signal[] = []
  private detectorSignals: MicroSignal[] = []
  private plan: TradePlan | null = null
  private positionSize: PositionSize | null = null
  private lastPlanSignalId: string | null = null
  private lastSnapshotAt = 0
  private enableNetworkServices: boolean

  constructor(options: RuntimeOptions) {
    this.clock = options.clock ?? systemClock
    this.settingsProvider = options.settings; this.onSnapshot = options.onSnapshot; this.onSignal = options.onSignal
    this.enableNetworkServices = options.enableNetworkServices ?? false
    const settings = this.settingsProvider(); this.source = settings.source; this.symbol = settings.symbol
    this.instrument = options.instrument ?? inferInstrument(settings.symbol)
    this.sessionId = `${this.symbol}-${this.clock.now()}`
    this.telemetry = new MemoryTelemetry(); this.externalTelemetry = options.telemetry
    this.book = new OrderBookDiff({ maxLevels: 100 }, this.clock)
    this.vpin = new VPIN({}, this.clock); this.flow = new FlowEngine({}, this.clock, this.instrument)
    this.detectorSuite = new DetectorSuite(undefined, this.clock); this.detectorRegistry = new DetectorRegistry(this.clock)
    this.features = new FeatureFrameBuilder(100); this.candles = new CandleBuilder(15, 300)
    this.calibrator = new ProbabilityCalibrator(); this.decision = new DecisionPipeline(new SignalEngine(), this.calibrator)
    this.tracker = new SignalTracker(1000)
    this.sizer = new PositionSizer({ balance: settings.balance, riskPct: settings.riskPct, maxLeverage: 10, feeRateBps: 4, kellyFraction: 0.25, maintenanceMarginRate: 0.004 })
    this.paper = new PaperTradingEngine({ initialBalance: settings.balance }, this.clock)
    this.crossExchange = new CrossExchangePoller({}, this.clock)

    this.detectorSuite.on('signal:add', (raw: any) => {
      try {
        const signal = this.detectorRegistry.add(raw)
        const duplicate = this.detectorSignals.some(item => item.type === signal.type && item.bias === signal.bias && this.clock.now() - item.ts < 10_000)
        if (!duplicate) this.detectorSignals = [signal, ...this.detectorSignals].slice(0, 200)
      } catch (error) { this.record('error', 'detector.signal', error) }
    })
    this.tracker.on('horizon', event => {
      if (event.horizon !== '60s') return
      const signal = this.signals.find(item => item.id === event.id)
      if (signal) this.calibrator.add({ score: signal.score, side: signal.side, won: event.pnl > 0, ts: this.clock.now(), strategyVersion: signal.strategyVersion ?? 'claimmoney-v2' })
    })
    this.book.on('book:resync-required', event => this.record('warn', 'book.sequence-gap', new Error('Order book sequence gap'), event))
    this.crossExchange.on('crossExchange:update', () => this.publish())
  }

  private record(level: 'debug' | 'info' | 'warn' | 'error', code: string, error: unknown, context?: Record<string, unknown>): void {
    const event = { level, code, message: error instanceof Error ? error.message : String(error), ts: this.clock.now(), context }
    this.telemetry.record(event); this.externalTelemetry?.record(event)
  }

  start(): void {
    if (this.timer) return
    if (this.enableNetworkServices) this.crossExchange.start(this.symbol)
    this.timer = setInterval(() => this.flush(this.clock.now()), 100)
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.crossExchange.stop() }
  dispose(): void { this.stop(); this.reset() }

  ingest(event: MarketEvent): void {
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
      this.flush(event.eventTs)
    } catch (error) { this.record('error', `market.ingest.${event.kind}`, error) }
  }

  private ingestTrade(event: Extract<MarketEvent, { kind: 'trade' }>): void {
    const trade = { ...event.trade, exchange: event.exchange, symbol: event.symbol, receiveTs: event.receiveTs,
      notional: event.trade.notional ?? event.trade.price * event.trade.qty }
    this.lastTradeTs = Math.max(this.lastTradeTs, event.eventTs); this.price = trade.price; this.priceStr = trade.priceStr ?? String(trade.price)
    this.features.addTrade(trade)
    const history = this.features.getTrades().slice(-200).map(item => ({ notional: item.notional ?? item.price * item.qty }))
    this.vpin.update({ price: trade.price, qty: trade.qty, side: trade.side, notional: trade.notional, ts: trade.ts }, history)
    this.flow.updateBucket({ price: trade.price, notional: trade.notional, side: trade.side, ts: trade.ts })
    this.candles.update(trade.price, trade.ts, trade.qty, trade.side)
    this.tracker.updatePrice(trade.price, trade.ts, this.symbol); this.paper.update(trade.price)
  }

  private ingestMark(event: Extract<MarketEvent, { kind: 'markPrice' }>): void {
    this.price = event.price; this.priceStr = event.priceStr ?? String(event.price)
    this.candles.update(event.price, event.eventTs)
    this.tracker.updatePrice(event.price, event.eventTs, this.symbol); this.paper.update(event.price)
  }

  private ingestSnapshot(event: Extract<MarketEvent, { kind: 'bookSnapshot' }>): void {
    this.book.applySnapshot(event.symbol, { bids: event.bids, asks: event.asks, lastUpdateId: event.seq, ts: event.eventTs })
    this.lastBookTs = event.eventTs; this.micro = this.book.getMicrostructure(); this.runDetectors()
  }
  private ingestDelta(event: Extract<MarketEvent, { kind: 'bookDelta' }>): void {
    const result = this.book.applyDelta({ bids: event.bids, asks: event.asks, U: event.firstSeq, u: event.lastSeq, eventTime: event.eventTs })
    if (result === 'applied') { this.lastBookTs = event.eventTs; this.micro = this.book.getMicrostructure(); this.runDetectors() }
  }

  private runDetectors(): void {
    if (!this.micro) return
    const aggregate = this.detectorRegistry.aggregate(this.price, this.clock.now())
    this.detectorSuite.setData({
      book: this.book.getBook(), micro: this.micro, lastPrice: this.price, vpinValue: this.vpin.getValue(),
      flowCandles: this.flow.getCandles(), cvdHistory: this.features.getCvdHistory(),
      trades: this.features.getTrades().slice(-200).map(trade => ({ price: trade.price, notional: trade.notional ?? trade.price * trade.qty, side: trade.side }))
    })
    this.detectorSuite.run()
    // Re-evaluate after detector events were emitted.
    void aggregate
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
    if (!frame) { if (at - this.lastSnapshotAt >= 250) this.publish(); return }
    frame.quality = this.qualityGate.evaluate({
      now: at, lastTradeTs: this.lastTradeTs, lastBookTs: this.lastBookTs, bookSynced: this.book.isSynced(),
      requiredFeaturesValid: frame.cvdZ.valid && frame.velocityZ.valid && frame.obi.valid && frame.microDev.valid && frame.vpin.valid
    }).quality
    this.frame = frame; this.regime = classifyRegime(frame)
    const settings = this.settingsProvider(); this.sizer.updateConfig({ balance: settings.balance, riskPct: settings.riskPct })
    const cross = this.crossExchange.getMaxSpread()
    this.decisionResult = this.decision.evaluate(frame, this.features.getPriceHistory(), {
      weights: settings.weights, threshold: settings.threshold, cooldownMs: settings.cooldown * 1000,
      confirmations: settings.confirmations, minConfirmationMs: settings.minConfirmationMs,
      crossSpreadPct: Math.max(0, cross.spreadPct), strategyVersion: 'claimmoney-v2'
    })
    if (this.decisionResult.signal) this.acceptSignal(this.decisionResult.signal)
    this.publish()
  }

  private wallEntries(): { bid: WallEntry[]; ask: WallEntry[] } {
    const walls = this.detectorSuite.getWalls()
    return { bid: walls.bid.map(({ price, qty, notional, persistence }) => ({ price, qty, notional, persistence })),
      ask: walls.ask.map(({ price, qty, notional, persistence }) => ({ price, qty, notional, persistence })) }
  }

  private acceptSignal(signal: Signal): void {
    this.signals = [signal, ...this.signals].slice(0, 500); this.tracker.addSignal(signal); this.onSignal?.(signal)
    const settings = this.settingsProvider()
    this.plan = this.planner.create(signal, { spread: this.frame?.spread ?? 0,
      volatilityBps: this.frame?.volatility.value ?? 5, walls: this.wallEntries(), instrument: this.instrument })
    const performance = this.paper.getPerformance()
    this.positionSize = this.sizer.size(this.plan, this.instrument, { trades: performance.trades, wins: performance.wins })
    if (settings.paperTradingEnabled && this.plan.direction !== 'NEUTRAL' && this.positionSize && this.lastPlanSignalId !== signal.id) {
      const book = this.book.getBook(), depth = [...book.bids.slice(0, 10), ...book.asks.slice(0, 10)].reduce((sum, level) => sum + level.qty, 0)
      this.paper.submitPlan(signal.id, this.plan, this.positionSize, depth, this.price); this.lastPlanSignalId = signal.id
    }
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

  injectTestSignal(side: 'BUY' | 'SELL'): Signal {
    const settings = this.settingsProvider()
    const score = side === 'BUY' ? Math.max(settings.threshold + 0.25, 1) : -Math.max(settings.threshold + 0.25, 1)
    const signal: Signal = {
      id: `test-${this.clock.now()}-${side}`, symbol: this.symbol, exchange: this.source, side,
      price: this.price || 50_000, priceStr: this.priceStr || String(this.price || 50_000), confidence: 80,
      score, breakdown: { cvd: score * 0.7, obi: score * 0.3, vel: score * 0.4, micro: score * 0.2,
        vpin: this.vpin.getValue(), detector: 0, divergence: 0, ...settings.weights },
      filters: [{ id: 'test', mode: 'hard-veto', pass: true, reason: 'User-injected test signal', adjustment: 0 }],
      frameId: this.frame?.id ?? 'test-frame', strategyVersion: 'claimmoney-v2-test', ts: this.clock.now()
    }
    this.acceptSignal(signal); this.publish(); return signal
  }

  snapshot(): RuntimeSnapshot {
    return {
      sessionId: this.sessionId, symbol: this.symbol, source: this.source, price: this.price, priceStr: this.priceStr,
      frame: this.frame ? structuredClone(this.frame) : null, metrics: this.metrics(), engineState: this.decisionResult?.state ?? 'IDLE',
      decision: this.decisionResult ? structuredClone(this.decisionResult) : null, regime: { ...this.regime, reasons: [...this.regime.reasons] },
      signals: this.signals.map(signal => structuredClone(signal)), detectorSignals: this.detectorRegistry.aggregate(this.price).active,
      trackers: this.tracker.getAll(), stats: this.tracker.getStats(), candles: this.candles.getCandles(), flowCandles: this.flow.getCandles(),
      book: this.book.getBook(), plan: this.plan ? structuredClone(this.plan) : null,
      positionSize: this.positionSize ? { ...this.positionSize } : null, paperOrders: this.paper.getOrders(),
      openPositions: this.paper.getOpenPositions(), closedPositions: this.paper.getClosedPositions(), paperPerformance: this.paper.getPerformance(),
      crossExchange: this.crossExchange.getState(), arbitrage: this.crossExchange.getMaxSpread(), telemetry: this.telemetry.getAll()
    }
  }
  private publish(): void { this.lastSnapshotAt = this.clock.now(); this.onSnapshot?.(this.snapshot()) }

  reset(): void {
    this.book.reset(); this.vpin.reset(); this.flow.reset(); this.detectorSuite.reset(); this.detectorRegistry.reset(); this.features.reset();
    this.candles.reset(); this.decision.reset(); this.tracker.clear(); this.paper.reset(); this.crossExchange.resetData(); this.calibrator.clear(); this.recorder.clear()
    this.price = 0; this.priceStr = ''; this.lastTradeTs = 0; this.lastBookTs = 0; this.micro = null; this.frame = null
    this.decisionResult = null; this.signals = []; this.detectorSignals = []; this.plan = null; this.positionSize = null; this.lastPlanSignalId = null
    this.publish()
  }
}

export const INITIAL_RUNTIME_SNAPSHOT: Omit<RuntimeSnapshot, 'sessionId' | 'symbol' | 'source' | 'book' | 'crossExchange' | 'arbitrage' | 'paperPerformance'> = {
  price: 0, priceStr: '', frame: null, metrics: emptyMetrics(), engineState: 'IDLE', decision: null,
  regime: { regime: 'warming', confidence: 1, reasons: ['No data'] }, signals: [], detectorSignals: [], trackers: [], stats: emptyStats,
  candles: [], flowCandles: [], plan: null, positionSize: null, paperOrders: [], openPositions: [], closedPositions: [], telemetry: []
}
