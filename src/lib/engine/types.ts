// ClaimMoney Engine - Core Type Definitions

// Time-series data
export interface Candle {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Tick {
  ts: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

// Feature engineering
export interface FeatureRow {
  ts: number;
  symbol: string;
  features: Record<string, number>;
  label?: number;
}

export interface FeatureFrame {
  symbol: string;
  interval: string;
  rows: FeatureRow[];
}

// Signals
export type SignalSide = 'long' | 'short';
export type Regime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile';

export interface Signal {
  id: string;
  ts: number;
  detector: string;
  symbol: string;
  side: SignalSide;
  confidence: number;
  regime: Regime;
  metadata: Record<string, unknown>;
}

export interface FilteredSignal extends Signal {
  passed: boolean;
  filterReason?: string;
}

// Positions & Trading
export type PositionStatus =
  | 'open'
  | 'closed'
  | 'breakeven'
  | 'tp1_hit'
  | 'tp2_hit'
  | 'stopped_out';

export interface Position {
  id: string;
  symbol: string;
  side: SignalSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  fee: number;
  slippage: number;
  pnl: number;
  rMultiple: number;
  status: PositionStatus;
  entryTs: number;
  exitTs?: number;
  exitPrice?: number;
}

// Risk
export interface RiskConfig {
  equity: number;
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  maxDailyLoss: number;
  maxCorrelationExposure: number;
  defaultStopLossATR: number;
  defaultTP1R: number;
  defaultTP2R: number;
}

// Sessions
export interface TradingSession {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  signals: Signal[];
  positions: Position[];
  startEquity: number;
  currentEquity: number;
  peakEquity: number;
  maxDrawdown: number;
  totalFees: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
}

export interface SessionExport {
  version: string;
  exportedAt: number;
  session: TradingSession;
  checksum: string;
}

// Replay
export interface ReplayConfig {
  source: string;
  startTime: number;
  endTime: number;
  speed: number;
  deterministic: boolean;
}

export interface ReplaySnapshot {
  ts: number;
  equity: number;
  positions: Position[];
  signals: Signal[];
  regime: Regime;
}

export interface ReplayResult {
  snapshots: ReplaySnapshot[];
  finalEquity: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  winRate: number;
  byteChecksum: string;
}

// Detector
export interface DetectorConfig {
  name: string;
  version: string;
  params: Record<string, number | string | boolean>;
  enabled: boolean;
}

export interface DetectorResult {
  detector: string;
  signals: Signal[];
  processingTimeMs: number;
}

// Calibration
export interface CalibrationResult {
  detector: string;
  paramSet: Record<string, number>;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}

// Walk-forward
export interface WalkForwardWindow {
  inSampleStart: number;
  inSampleEnd: number;
  outOfSampleStart: number;
  outOfSampleEnd: number;
  inSampleResult: CalibrationResult;
  outOfSampleResult: CalibrationResult;
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  aggregatedSharpe: number;
  aggregatedMaxDD: number;
  aggregatedWinRate: number;
  isRobust: boolean;
}

// Data quality
export interface QualityReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  gaps: number;
  duplicates: number;
  outliers: number;
  score: number;
}

// OKX specific
export interface OKXMessage {
  id: string;
  ts: number;
  data: unknown;
  arg: { channel: string; instId: string };
  checksum?: string;
}
