import type { FilterDecision, Signal, SignalSide, Source } from '../../types'

export type EngineState = 'IDLE' | 'ARMED' | 'FIRED' | 'COOLDOWN'
export interface Weights { w1: number; w2: number; w3: number; w4?: number; w5?: number; w6?: number }
export interface ScoreBreakdown { cvd: number; obi: number; vel: number; micro?: number; vpin?: number; detector?: number; divergence?: number }

const DEFAULT_WEIGHTS: Required<Weights> = { w1: 0.30, w2: 0.18, w3: 0.13, w4: 0.16, w5: 0.10, w6: 0.13 }
export function normalizeWeights(weights: Weights): Required<Weights> {
  const raw = [weights.w1, weights.w2, weights.w3, weights.w4 ?? 0, weights.w5 ?? 0, weights.w6 ?? 0]
  if (raw.some(value => !Number.isFinite(value) || value < 0)) return { ...DEFAULT_WEIGHTS }
  const sum = raw.reduce((a, b) => a + b, 0)
  if (sum <= 0) return { ...DEFAULT_WEIGHTS }
  return { w1: raw[0] / sum, w2: raw[1] / sum, w3: raw[2] / sum, w4: raw[3] / sum, w5: raw[4] / sum, w6: raw[5] / sum }
}

export function computeScore(
  cvdZ: number, obi: number, velocityZ: number, weights: Weights, divergenceAdj = 0,
  microDev = 0, vpinAdj = 0, detectorScore = 0
): number {
  const w = normalizeWeights(weights)
  const value = w.w1 * cvdZ + w.w2 * obi + w.w3 * velocityZ + w.w4 * microDev + w.w5 * vpinAdj + w.w6 * detectorScore + divergenceAdj
  return Math.max(-3, Math.min(3, Number.isFinite(value) ? value : 0))
}

export function computeConfidence(score: number, calibratedProbability?: number | null): number {
  if (calibratedProbability !== undefined && calibratedProbability !== null && Number.isFinite(calibratedProbability)) {
    return Math.round(Math.max(0, Math.min(1, calibratedProbability)) * 100)
  }
  // Uncalibrated fallback is explicitly a score-strength heuristic. computeScore is clamped to ±3.
  return Math.min(100, Math.round(Math.abs(score) / 3 * 100))
}

export interface EngineConfig {
  threshold: number; cooldownMs: number; hysteresis: number
  confirmations?: number; minConfirmationMs?: number; maxConfirmationGapMs?: number; neutralDwellMs?: number
}
export interface EngineTickResult { state: EngineState; signal: Signal | null; score: number; confidence: number; reason?: string }
export interface EngineTickParams {
  score: number; price: number; priceStr?: string; breakdown: ScoreBreakdown; weights: Weights; ts: number
  qualified?: boolean; filters?: FilterDecision[]; symbol?: string; exchange?: Source; frameId?: string
  strategyVersion?: string; calibratedProbability?: number | null
}

export class SignalEngine {
  private state: EngineState = 'IDLE'
  private consecutive = 0
  private consecutiveSide: SignalSide | null = null
  private firstQualifiedAt = 0
  private lastQualifiedAt = 0
  private lastFiredAt = 0
  private lastFiredSide: SignalSide | null = null
  private neutralSince = 0
  private hasSeenNeutralSinceFired = true
  private sequence = 0
  private config: Required<EngineConfig>

  constructor(config: EngineConfig = { threshold: 0.75, cooldownMs: 18_000, hysteresis: 0.35 }) {
    this.config = this.validated(config)
  }

  private validated(config: EngineConfig): Required<EngineConfig> {
    return {
      threshold: Math.max(0.01, config.threshold), cooldownMs: Math.max(0, config.cooldownMs),
      hysteresis: Math.max(0, Math.min(config.threshold, config.hysteresis)), confirmations: Math.max(1, Math.round(config.confirmations ?? 2)),
      minConfirmationMs: Math.max(0, config.minConfirmationMs ?? 0), maxConfirmationGapMs: Math.max(1, config.maxConfirmationGapMs ?? 2_000),
      neutralDwellMs: Math.max(0, config.neutralDwellMs ?? 250)
    }
  }

  updateConfig(config: Partial<EngineConfig>): void { this.config = this.validated({ ...this.config, ...config }) }
  private sideOf(score: number): SignalSide { return score >= 0 ? 'BUY' : 'SELL' }
  private isNeutral(score: number): boolean { return Math.abs(score) < this.config.hysteresis }

  private resetCandidate(): void {
    this.consecutive = 0; this.consecutiveSide = null; this.firstQualifiedAt = 0; this.lastQualifiedAt = 0
    if (this.state === 'ARMED') this.state = 'IDLE'
  }

  private trackNeutral(score: number, ts: number): void {
    if (!this.isNeutral(score)) { this.neutralSince = 0; return }
    if (!this.neutralSince) this.neutralSince = ts
    if (ts - this.neutralSince >= this.config.neutralDwellMs) this.hasSeenNeutralSinceFired = true
  }

  private makeSignal(params: EngineTickParams): Signal {
    const side = this.sideOf(params.score)
    return {
      id: `${params.ts}-${side}-${++this.sequence}`, symbol: params.symbol, exchange: params.exchange,
      side, price: params.price, priceStr: params.priceStr,
      confidence: computeConfidence(params.score, params.calibratedProbability), calibratedProbability: params.calibratedProbability,
      score: params.score, breakdown: {
        cvd: params.breakdown.cvd, obi: params.breakdown.obi, vel: params.breakdown.vel,
        micro: params.breakdown.micro, vpin: params.breakdown.vpin, detector: params.breakdown.detector,
        divergence: params.breakdown.divergence, ...normalizeWeights(params.weights)
      },
      filters: params.filters, frameId: params.frameId, strategyVersion: params.strategyVersion ?? 'claimmoney-v2', ts: params.ts
    }
  }

  tick(params: EngineTickParams): EngineTickResult {
    const { score, ts } = params
    this.trackNeutral(score, ts)
    const confidence = computeConfidence(score, params.calibratedProbability)

    if (this.state === 'COOLDOWN') {
      if (ts - this.lastFiredAt < this.config.cooldownMs) return { state: this.state, signal: null, score, confidence, reason: 'cooldown' }
      this.state = 'IDLE'
      this.resetCandidate()
      return { state: this.state, signal: null, score, confidence, reason: 'cooldown-ended' }
    }

    if (params.qualified === false) {
      this.resetCandidate()
      return { state: this.state, signal: null, score, confidence, reason: 'not-qualified' }
    }

    if (Math.abs(score) < this.config.threshold) {
      this.resetCandidate()
      return { state: this.state, signal: null, score, confidence, reason: 'below-threshold' }
    }

    const side = this.sideOf(score)
    if (this.lastFiredSide && side !== this.lastFiredSide && !this.hasSeenNeutralSinceFired) {
      this.resetCandidate()
      return { state: this.state, signal: null, score, confidence, reason: 'hysteresis-block' }
    }

    const gapTooLarge = this.lastQualifiedAt > 0 && ts - this.lastQualifiedAt > this.config.maxConfirmationGapMs
    if (side !== this.consecutiveSide || gapTooLarge) {
      this.consecutiveSide = side; this.consecutive = 1; this.firstQualifiedAt = ts
    } else {
      this.consecutive += 1
    }
    this.lastQualifiedAt = ts

    const dwellMet = ts - this.firstQualifiedAt >= this.config.minConfirmationMs
    if (this.consecutive < this.config.confirmations || !dwellMet) {
      this.state = 'ARMED'
      return { state: this.state, signal: null, score, confidence, reason: dwellMet ? 'confirming' : 'dwell' }
    }

    const signal = this.makeSignal(params)
    this.lastFiredAt = ts; this.lastFiredSide = signal.side
    this.hasSeenNeutralSinceFired = false; this.neutralSince = 0
    this.resetCandidate()
    // FIRED is the result of this transition; the persisted FSM state owns the cooldown immediately.
    this.state = 'COOLDOWN'
    return { state: 'FIRED', signal, score, confidence: signal.confidence }
  }

  getState(): EngineState { return this.state }
  reset(): void {
    this.state = 'IDLE'; this.resetCandidate(); this.lastFiredAt = 0; this.lastFiredSide = null
    this.neutralSince = 0; this.hasSeenNeutralSinceFired = true; this.sequence = 0
  }
}
