import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'
import type { MicroSignal, SignalBias } from '../signal/tradePlan'

export interface DetectorCandidate {
  type: string; bias: SignalBias; confidence: number; description: string; price: number; evidence: Record<string, unknown>
}
export interface DetectorAggregate { bull: number; bear: number; warning: number; score: number; active: MicroSignal[] }

export class DetectorRegistry {
  private signals = new Map<string, MicroSignal>()
  private sequence = 0
  constructor(private readonly clock: Clock = systemClock, private readonly ttlMs = 60_000, private readonly typeContributionCap = 90) {}

  private key(candidate: DetectorCandidate): string {
    const band = candidate.price > 0 ? Math.round(candidate.price / (candidate.price * 0.0005 || 1)) : 0
    return `${candidate.type}:${candidate.bias}:${band}`
  }

  add(candidate: DetectorCandidate): MicroSignal {
    const now = this.clock.now(), key = this.key(candidate), existing = this.signals.get(key)
    if (existing && now - existing.ts < 10_000) {
      existing.baseConfidence = Math.max(existing.baseConfidence ?? existing.confidence, candidate.confidence)
      existing.confidence = existing.baseConfidence; existing.evidence = candidate.evidence; existing.description = candidate.description
      existing.expiresAt = now + this.ttlMs
      return { ...existing }
    }
    const signal: MicroSignal = { ...candidate, id: `det_${now}_${++this.sequence}`, ts: now, baseConfidence: candidate.confidence, decay: 1, expiresAt: now + this.ttlMs }
    this.signals.set(key, signal); return { ...signal }
  }

  aggregate(currentPrice: number, at = this.clock.now()): DetectorAggregate {
    const byType = new Map<string, MicroSignal>()
    for (const [key, signal] of this.signals) {
      if (at >= signal.expiresAt) { this.signals.delete(key); continue }
      const ageDecay = Math.exp(-(at - signal.ts) / this.ttlMs)
      const distance = currentPrice > 0 && signal.price > 0 ? Math.abs(currentPrice - signal.price) / signal.price : 0
      signal.decay = ageDecay * Math.exp(-distance * 8)
      signal.confidence = Math.max(0, Math.min(100, (signal.baseConfidence ?? signal.confidence) * signal.decay))
      const previous = byType.get(signal.type)
      if (!previous || signal.confidence > previous.confidence) byType.set(signal.type, signal)
    }
    const active = [...byType.values()].sort((a, b) => b.confidence - a.confidence)
    let bull = 0, bear = 0, warning = 0
    for (const signal of active) {
      const contribution = Math.min(this.typeContributionCap, signal.confidence)
      if (signal.bias === 'bullish') bull += contribution
      else if (signal.bias === 'bearish') bear += contribution
      else warning += contribution
    }
    const score = Math.max(-1, Math.min(1, (bull - bear) / Math.max(100, bull + bear)))
    return { bull, bear, warning, score, active: active.map(signal => ({ ...signal })) }
  }
  reset(): void { this.signals.clear(); this.sequence = 0 }
}
