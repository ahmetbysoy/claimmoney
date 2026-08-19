// ClaimMoney v3 Engine — Public API

// --- Domain (v3) ---
export * from './domain/events';
export * from './domain/frames';
export * from './domain/signals';
export * from './domain/instrument';

// --- Infrastructure ---
export { EventBus } from './infrastructure/eventBus';
export { SystemClock, ManualClock } from './infrastructure/clock';
export type { Clock } from './infrastructure/clock';

// --- Features ---
export { CVDFeature } from './features/cvdFeature';
export { OBIFeature } from './features/obiFeature';
export { VelocityFeature } from './features/velocityFeature';
export { MicropriceFeature } from './features/micropriceFeature';
export { VPINFeature } from './features/vpinFeature';
export { VolatilityFeature } from './features/volatilityFeature';
export { FlowFeature } from './features/flowFeature';
export { onlineEMA, robustStd, zScore, clamp, mad } from './features/statistics';
export { FeatureFrameBuilder } from './features/featureFrameBuilder';

// --- Order Book ---
export { OrderBook } from './book/orderBook';
export { SequenceController } from './book/sequenceController';

// --- Detectors ---
export type { DetectorResult, DetectorContext, BaseDetector } from './detectors/detector';
export { WallDetector } from './detectors/wallDetector';
export { CompressionDetector } from './detectors/compressionDetector';
export { SkewDetector } from './detectors/skewDetector';
export { LiquidityVoidDetector } from './detectors/liquidityVoidDetector';
export { LadderDetector } from './detectors/ladderDetector';
export { QuoteManipulationDetector } from './detectors/quoteManipulationDetector';
export { IcebergDetector } from './detectors/icebergDetector';
export { FlowExpansionDetector } from './detectors/flowExpansionDetector';
export { LiquidationClusterDetector } from './detectors/liquidationClusterDetector';

// --- Strategy ---
export { DetectorAggregator } from './strategy/detectorAggregator';
export { normalizeWeights, computeCompositeScore } from './strategy/scoreModel';
export type { ScoreWeights } from './strategy/scoreModel';
export { runFilters } from './strategy/filters';
export type { FilterResult } from './strategy/filters';
export { DecisionFSM } from './strategy/decisionMachine';
export type { FSMState, FSMConfig } from './strategy/decisionMachine';

// --- Risk ---
export { createTradePlan } from './risk/tradePlanner';
export type { TradePlan } from './risk/tradePlanner';
export { sizePosition } from './risk/positionSizer';
export type { SizingResult } from './risk/positionSizer';
export { checkPortfolioRisk } from './risk/portfolioRisk';
export type { PortfolioState } from './risk/portfolioRisk';

// --- Execution ---
export { PaperBroker } from './execution/paperBroker';
export { FillModel } from './execution/fillModel';
export type { FillResult } from './execution/fillModel';

// --- Performance ---
export { ForwardTracker } from './performance/forwardTracker';
export { Metrics } from './performance/metrics';
export type { TradeRecord } from './performance/metrics';

// --- v2 (legacy, still used) ---
export { MarketRuntime } from './market-runtime';
export type { MarketState } from './market-runtime';
export { JSONLReplay } from './jsonl-replay';
export { validateOKXChecksum, parseOKXCandle, parseOKXTrade, buildOKXSubscribe, crc32c } from './okx-integration';
export { WebSocketManager } from './websocket-manager';
export { DetectorRegistry, createMeanReversionDetector, createMomentumDetector, createBreakoutDetector, createVolumeSpikeDetector } from './detector-registry';
export { RegimeClassifier } from './regime-classifier';
export { SignalPipeline } from './signal-pipeline';
export { FeeAccounting } from './fee-accounting';
export { RiskPlanner } from './risk-planner';
export { PaperExecution } from './paper-execution';
export { Calibrator } from './calibration';
export { SessionManager } from './session-manager';
export { WalkForwardAnalyzer } from './walk-forward';
export { DataQualityGate } from './data-quality';
export { generateId, formatNumber, formatPct, clamp as v2clamp, average, standardDeviation, ema, sma, rsi, atr, vwap, bollingerBands, macd, resetIdCounter } from './helpers';
export { serializeSession, deserializeSession, roundtripSession } from './serialization';
export type { Candle, Tick, FeatureRow, FeatureFrame as V2FeatureFrame, Signal, FilteredSignal, SignalSide, Regime, Position, PositionStatus, RiskConfig, TradingSession, SessionExport, ReplayConfig, ReplaySnapshot, ReplayResult, DetectorConfig, DetectorResult as V2DetectorResult, CalibrationResult, WalkForwardWindow, WalkForwardResult, QualityReport, OKXMessage } from './types';
