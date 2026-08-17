import type { Clock } from './clock'
import { DataQualityGate } from './dataQualityGate'
import { MemoryTelemetry } from './telemetry'
import type { InstrumentSpec } from '../domain/instrument'
import { OrderBookDiff } from '../core/book/orderBookDiff'
import { VPIN } from '../core/indicators/vpin'
import { FlowEngine } from '../core/flow/flowEngine'
import { DetectorSuite } from '../core/detectors/detectorSuite'
import { DetectorRegistry } from '../core/detectors/detectorRegistry'
import { FeatureFrameBuilder } from '../features/featureFrameBuilder'
import { CandleBuilder } from '../features/candleBuilder'
import { ProbabilityCalibrator } from '../performance/calibration'
import { DecisionPipeline } from '../core/signal/decisionPipeline'
import { SignalEngine } from '../core/signal/engine'
import { SignalTracker } from '../core/performance/signalTracker'
import { TradePlanner } from '../risk/tradePlanner'
import { PositionSizer } from '../risk/positionSizer'
import { PaperTradingEngine } from '../core/paper/paperTrading'
import { CrossExchangePoller } from '../core/crossExchange/crossExchange'
import { MarketRecorder } from '../testing/replay/marketReplay'
import { SignalExecutionCoordinator } from './signalExecutionCoordinator'

export interface RuntimeCollaborators {
  telemetry: MemoryTelemetry
  book: OrderBookDiff
  vpin: VPIN
  flow: FlowEngine
  detectorSuite: DetectorSuite
  detectorRegistry: DetectorRegistry
  features: FeatureFrameBuilder
  candles: CandleBuilder
  calibrator: ProbabilityCalibrator
  decision: DecisionPipeline
  tracker: SignalTracker
  qualityGate: DataQualityGate
  signalExecution: SignalExecutionCoordinator
  paper: PaperTradingEngine
  crossExchange: CrossExchangePoller
  recorder: MarketRecorder
}

export interface RuntimeCompositionSettings { balance: number; riskPct: number }

/** Default composition root. MarketRuntime receives the resulting collaborators rather than constructing them itself. */
export function createRuntimeCollaborators(
  clock: Clock,
  instrument: InstrumentSpec,
  settings: RuntimeCompositionSettings
): RuntimeCollaborators {
  const calibrator = new ProbabilityCalibrator()
  const planner = new TradePlanner()
  const sizer = new PositionSizer({ balance: settings.balance, riskPct: settings.riskPct, maxLeverage: 10,
    feeRateBps: 4, performanceRiskScaleFraction: 0.25, maintenanceMarginRate: 0.004 })
  const paper = new PaperTradingEngine({ initialBalance: settings.balance }, clock)
  return {
    telemetry: new MemoryTelemetry(),
    book: new OrderBookDiff({ maxLevels: 100, maxStoredLevels: 1_000 }, clock),
    vpin: new VPIN({}, clock),
    flow: new FlowEngine({}, clock, instrument),
    detectorSuite: new DetectorSuite(undefined, clock),
    detectorRegistry: new DetectorRegistry(clock),
    features: new FeatureFrameBuilder(100),
    candles: new CandleBuilder(15, 300),
    calibrator,
    decision: new DecisionPipeline(new SignalEngine(), calibrator),
    tracker: new SignalTracker(1000),
    qualityGate: new DataQualityGate(),
    signalExecution: new SignalExecutionCoordinator(planner, sizer, paper),
    paper,
    crossExchange: new CrossExchangePoller({}, clock),
    recorder: new MarketRecorder(10_000)
  }
}
