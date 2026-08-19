/**
 * BOZOK PRO v4.0 — Worker Type Definitions
 *
 * All types for the inline Web Worker communication protocol.
 * The worker receives book/trade/liq data and posts back state snapshots.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** Max book levels per side */
export const ML = 50;
/** Trade ring buffer capacity */
export const MT = 512;
/** Signal ring buffer capacity */
export const MS = 128;
/** CVD ring buffer capacity (spec says 128 but MC=256 for liquidations) */
export const MC = 256;
/** Flow ring buffer capacity */
export const MF = 64;
/** Liquidation ring buffer capacity */
export const MQ = 256;
/** Max signals for confluence window */
export const MW = 32;
/** Signal decay history depth */
export const MD = 20;

// ─── Signal Types (16) ───────────────────────────────────────────────────────

export const SIGNAL_TYPES = [
  'WALL',
  'SPOOFING',
  'CVD_DIV',
  'ABSORPTION',
  'COMPRESSION',
  'CASCADE',
  'ICEBERG',
  'VOID',
  'FLOW_SUSTAINED',
  'LADDER',
  'BOOK_SKEW',
  'SKEW_DIVERGENCE',
  'TAPE_SPIKE',
  'DELTA_EXPANSION',
  'FLOW_EXHAUSTION',
  'LIQ_CLUSTER',
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

// ─── Plan States ─────────────────────────────────────────────────────────────

export type PlanState = 'NEUTRAL' | 'CANDIDATE' | 'ARMED';
export type PlanDirection = 'LONG' | 'SHORT';

// ─── Regime Types ────────────────────────────────────────────────────────────

export type RegimeType = 'DEAD' | 'TRENDING' | 'CHOPPY' | 'COILING' | 'CHAOS';

// ─── Iceberg Lifecycle ──────────────────────────────────────────────────────

export type IcebergState = 'NONE' | 'FORMING' | 'CONFIRMED' | 'CONSUMED' | 'PULLED';

// ─── Void Lifecycle ─────────────────────────────────────────────────────────

export type VoidState = 'NONE' | 'DETECTED' | 'FILLING' | 'FILLED';

// ─── Signal Verification ────────────────────────────────────────────────────

export type SignalVerificationStatus = 'PENDING' | 'VERIFIED' | 'MISSED' | 'EXPIRED';

// ─── Ring Buffer Structures ──────────────────────────────────────────────────

export interface TradeRing {
  prices: Float64Array;
  qties: Float64Array;
  sides: Uint8Array; // 0=buy, 1=sell
  ts: Float64Array;
  head: number;
  size: number;
}

export interface CVDRing {
  values: Float64Array;
  ts: Float64Array;
  head: number;
  size: number;
}

export interface FlowRing {
  buyN: Float64Array;
  sellN: Float64Array;
  delta: Float64Array;
  ts: Float64Array;
  head: number;
  size: number;
}

export interface LiqRing {
  sides: Uint8Array;
  prices: Float64Array;
  notional: Float64Array;
  ts: Float64Array;
  head: number;
  size: number;
}

export interface SignalRing {
  types: Uint16Array;
  confs: Float64Array;
  dirs: Uint8Array; // 0=LONG, 1=SHORT, 2=NEUTRAL
  ts: Float64Array;
  head: number;
  size: number;
}

// ─── Worker Config ──────────────────────────────────────────────────────────

export interface TickConfig {
  tickSize: number;
  stepSize: number;
  minNotional: number;
}

export interface WorkerConfig {
  tickSize: number;
  stepSize: number;
  minNotional: number;
  roundTripFeeBps: number;
  avgSlippageBps: number;
  fundingRatePerHour: number;
  expectedHoldHours: number;
  maxRiskPct: number;
  capital: number;
  spreadBpsLimit: number;
  vpinLimit: number;
  planTTL: number;
  wallMult: number;
  flowBucketMs: number;
  cvdWindowSec: number;
  whaleT1: number;
  whaleT2: number;
  whaleT3: number;
  tapeSpikeMult: number;
  tapeSpikeMin: number;
  icebergHitThreshold: number;
  icebergRatioThreshold: number;
  cascadeWindowMs: number;
  cascadeMinLength: number;
  signalVerifyMinMs: number;
  signalVerifyMaxMs: number;
  signalVerifyThresholdPct: number;
  voidMaxAgeMs: number;
  voidFillPct: number;
  spoofQtyDropPct: number;
  spoofPriceApproachPct: number;
  spoofExecMaxPct: number;
}

export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  tickSize: 0.01,
  stepSize: 0.001,
  minNotional: 5.0,
  roundTripFeeBps: 4.0,
  avgSlippageBps: 5.0,
  fundingRatePerHour: 0.01,
  expectedHoldHours: 2.0,
  maxRiskPct: 0.02,
  capital: 10000.0,
  spreadBpsLimit: 10.0,
  vpinLimit: 0.8,
  planTTL: 30000,
  wallMult: 3.0,
  flowBucketMs: 5000,
  cvdWindowSec: 60,
  whaleT1: 50000,
  whaleT2: 200000,
  whaleT3: 1000000,
  tapeSpikeMult: 3.0,
  tapeSpikeMin: 5,
  icebergHitThreshold: 3,
  icebergRatioThreshold: 2.5,
  cascadeWindowMs: 2000,
  cascadeMinLength: 3,
  signalVerifyMinMs: 5000,
  signalVerifyMaxMs: 30000,
  signalVerifyThresholdPct: 0.03,
  voidMaxAgeMs: 5000,
  voidFillPct: 80,
  spoofQtyDropPct: 50,
  spoofPriceApproachPct: 0.1,
  spoofExecMaxPct: 10,
};

// ─── Plan Interface ─────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  state: PlanState;
  direction: PlanDirection;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  netRR: number;
  confidence: number;
  confluenceCount: number;
  confluenceTypes: SignalType[];
  createdAt: number;
  ttl: number;
  expiresAt: number;
  signalIds: string[];
}

// ─── Confluence Result ───────────────────────────────────────────────────────

export interface ConfluenceResult {
  count: number;
  types: SignalType[];
  direction: PlanDirection;
  windowStart: number;
  confidenceBoost: number;
}

// ─── Risk Gate Result ────────────────────────────────────────────────────────

export interface RiskGateResult {
  passed: boolean;
  failedGate: string | null;
  details: Record<string, number>;
}

// ─── Net RR Calculation ─────────────────────────────────────────────────────

export interface NetRRCalculation {
  grossRR: number;
  roundTripFeeBps: number;
  avgSlippageBps: number;
  fundingCostBps: number;
  netRR: number;
}

// ─── Kelly Result ────────────────────────────────────────────────────────────

export interface KellyResult {
  kellyFraction: number;
  halfKelly: number;
  confidenceAdjusted: number;
  finalFraction: number;
  positionSize: number;
  winRate: number;
  rrRatio: number;
}

// ─── Regime Info ─────────────────────────────────────────────────────────────

export interface RegimeInfo {
  regime: RegimeType;
  score: number;
  volatilityProxy: number;
  directionProxy: number;
  compressionActive: boolean;
  cascadeChainLength: number;
}

// ─── Narrative Block ─────────────────────────────────────────────────────────

export interface NarrativeBlock {
  regimeEmoji: string;
  regimeName: string;
  directionPressure: string;
  evidence: string[];
  confluenceInfo: string;
  rrInfo: string;
}

// ─── Signal Record (in ring) ─────────────────────────────────────────────────

export interface SignalRecord {
  id: string;
  type: SignalType;
  direction: PlanDirection;
  confidence: number;
  createdAt: number;
  price: number;
  metadata: Record<string, unknown>;
}

// ─── Wall Track ──────────────────────────────────────────────────────────────

export interface WallTrack {
  price: number;
  side: 'bid' | 'ask';
  qty: number;
  initialQty: number;
  seenAt: number;
  lastQty: number;
  refreshCount: number;
  executedPct: number;
  isConsumed: boolean;
}

// ─── Iceberg Track ───────────────────────────────────────────────────────────

export interface IcebergTrack {
  level: number;
  side: 'bid' | 'ask';
  state: IcebergState;
  displayedQty: number;
  absorbedNotional: number;
  hitCount: number;
  ratio: number;
  lastHitTs: number;
  signalGenerated: boolean;
}

// ─── Void Track ──────────────────────────────────────────────────────────────

export interface VoidTrack {
  id: string;
  upperPrice: number;
  lowerPrice: number;
  state: VoidState;
  detectedAt: number;
  fillPct: number;
  filledAt: number | null;
}

// ─── Spoof Track ─────────────────────────────────────────────────────────────

export interface SpoofTrack {
  wallPrice: number;
  wallSide: 'bid' | 'ask';
  originalQty: number;
  currentQty: number;
  wallFlagged: boolean;
  priceApproached: boolean;
  executionLow: boolean;
  confirmed: boolean;
  seenAt: number;
}

// ─── Compression Breakout Hint ───────────────────────────────────────────────

export interface CompressionBreakoutHint {
  compressionActive: boolean;
  predictedDirection: 'bullish' | 'bearish' | 'neutral';
  cvdDirection: 'buy' | 'sell' | 'neutral';
  flowDirection: 'buy' | 'sell' | 'neutral';
  tapeSpikeActive: boolean;
  confidence: number;
}

// ─── State Diff (worker → main thread) ───────────────────────────────────────

export interface StateDiff {
  bookChanged: boolean;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  midPrice: number;
  tradesAdded: number;
  signalsAdded: number;
  planChanged: boolean;
  regimeChanged: boolean;
  regime: RegimeInfo | null;
  narrativeChanged: boolean;
  narrative: NarrativeBlock | null;
  // Book metrics
  bidDepth: number;
  askDepth: number;
  microprice: number;
  obi5: number;
  obi10: number;
  obi20: number;
  obiDivergence: boolean;
  skew: number;
  bookVelScore: number;
  // Flow metrics
  delta: number;
  buyNotional: number;
  sellNotional: number;
  tapeRate: number;
  isTapeSpike: boolean;
  whaleT1: number;
  whaleT2: number;
  whaleT3: number;
  cvdValue: number;
  cvdDivergence: boolean;
  // Cascade
  cascadeActive: boolean;
  cascadeLength: number;
  cascadeExhausted: boolean;
  // Plan
  plan: Plan | null;
  // VPIN
  vpin: number;
  // VWAP
  vwap: number;
  // Flow sustained/exhausted
  flowSustained: boolean;
  flowSustainedDir: string;
  flowExhaustion: boolean;
  flowExhaustionDir: string;
  flowExhaustionStrength: number;
  // Compression
  compressionActive: boolean;
  compressionBreakout: CompressionBreakoutHint | null;
  // Walls
  activeWalls: WallTrack[];
  // Iceberg
  icebergTracks: IcebergTrack[];
  // Void
  voidTracks: VoidTrack[];
  // Signals (recent)
  recentSignals: SignalRecord[];
  // Liquidation pools
  liqPoolLevels: { price: number; leverage: number; side: string; estimatedNotional: number }[];
  // Signal count for badge
  activeSignalCount: number;
  // Risk gate
  lastRiskGate: RiskGateResult | null;
  // Kelly
  kelly: KellyResult | null;
}

// ─── Worker In Messages (main thread → worker) ──────────────────────────────

export type WorkerInMessage =
  | { cmd: 'book'; bids: [number, number][]; asks: [number, number][]; ts: number; seq: number }
  | { cmd: 'trade'; price: number; qty: number; side: 'buy' | 'sell'; ts: number }
  | { cmd: 'liq'; side: 'buy' | 'sell'; price: number; notional: number; ts: number }
  | { cmd: 'config'; cfg: Partial<WorkerConfig> }
  | { cmd: 'armPlan'; planId: string }
  | { cmd: 'cancelPlan'; planId: string }
  | { cmd: 'reset' };

// ─── Worker Out Messages (worker → main thread) ─────────────────────────────

export interface StateSnapshot {
  type: 'st';
  diff: StateDiff;
  ts: number;
}

export type WorkerOutMessage =
  | StateSnapshot
  | { type: 'plan'; plan: Plan }
  | { type: 'signal'; signal: SignalRecord }
  | { type: 'error'; msg: string };

// ─── Signal Decay Config ────────────────────────────────────────────────────

export interface SignalDecayConfig {
  [signalType: string]: number;
}

export const DEFAULT_DECAY_CONFIG: SignalDecayConfig = {
  WALL: 0.0002,
  BID_WALL: 0.0002,
  ASK_WALL: 0.0002,
  SPOOFING: 0.002,
  CASCADE_CHAIN: 0.003,
  CASCADE_EXHAUSTED: 0.003,
  CVD_DIV: 0.003,
  VOID: 0.0008,
  VOID_FILLING: 0.0008,
  ICEBERG: 0.0003,
  DEFAULT: 0.0005,
};
