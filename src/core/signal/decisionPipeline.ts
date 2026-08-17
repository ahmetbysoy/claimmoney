import type { ProbabilityCalibrator } from '../../performance/calibration'
import type { FeatureFrame, Signal } from '../../types'
import { applyFilters } from './filters'
import { aggregateScore, type AggregatorWeights } from './scoreAggregator'
import { SignalEngine, type EngineTickResult } from './engine'

export interface DecisionConfig {
  weights: AggregatorWeights; threshold: number; cooldownMs: number; confirmations: number; minConfirmationMs: number
  crossSpreadPct: number; strategyVersion: string
}
export interface DecisionResult extends EngineTickResult {
  rawScore: number; adjustedScore: number; detectorScore: number; signal: Signal | null
  filters: ReturnType<typeof applyFilters>['decisions']
}

export class DecisionPipeline {
  constructor(private readonly engine: SignalEngine, private readonly calibrator?: ProbabilityCalibrator) {}

  evaluate(frame: FeatureFrame, priceHistory: { price: number; ts: number }[], config: DecisionConfig): DecisionResult {
    const aggregate = aggregateScore({
      cvdZ: frame.cvdZ.value, obi: frame.obi.value, velocityZ: frame.velocityZ.value, microDev: frame.microDev.value,
      vpin: frame.vpin.value, vpinValid: frame.vpin.valid, detectorBull: Math.max(0, frame.detectorScore.value * 100),
      detectorBear: Math.max(0, -frame.detectorScore.value * 100), divergenceAdj: frame.divergence.value,
      validity: { cvd: frame.cvdZ.valid, obi: frame.obi.valid, velocity: frame.velocityZ.valid,
        micro: frame.microDev.valid, detector: frame.detectorScore.valid }
    }, config.weights, frame.divergence.value)
    const filter = applyFilters({
      priceHistory, cvdZ: frame.cvdZ.value, obi: frame.obi.value, velZ: frame.velocityZ.value,
      score: aggregate.score, spreadPct: config.crossSpreadPct, quality: frame.quality,
      vpin: frame.vpin.value, vpinValid: frame.vpin.valid, now: frame.eventTs
    })
    const adjustedScore = Math.sign(aggregate.score) * Math.max(0, Math.abs(aggregate.score) + (filter.scoreAdjustment ?? 0))
    this.engine.updateConfig({ threshold: config.threshold, cooldownMs: config.cooldownMs,
      confirmations: config.confirmations, minConfirmationMs: config.minConfirmationMs })
    const probability = this.calibrator?.probability(adjustedScore, config.strategyVersion) ?? null
    const result = this.engine.tick({
      score: adjustedScore, price: frame.price, priceStr: frame.priceStr, ts: frame.eventTs,
      breakdown: { cvd: frame.cvdZ.value, obi: frame.obi.value, vel: frame.velocityZ.value,
        micro: frame.microDev.value, vpin: frame.vpin.value, detector: aggregate.detectorScore, divergence: frame.divergence.value },
      weights: config.weights, qualified: filter.pass, filters: filter.decisions, symbol: frame.symbol,
      exchange: frame.exchange, frameId: frame.id, strategyVersion: config.strategyVersion, calibratedProbability: probability
    })
    return { ...result, rawScore: aggregate.score, adjustedScore, detectorScore: aggregate.detectorScore, filters: filter.decisions }
  }
  reset(): void { this.engine.reset() }
}
