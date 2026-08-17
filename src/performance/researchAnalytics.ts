import { HORIZONS, type HorizonKey } from '../core/performance/signalTracker'
import { evaluateFold, purgedWalkForward, type FoldMetrics, type LabeledSample } from './walkForward'
import type { ResearchObservation } from './researchRepository'

export interface ResearchGroupMetric extends FoldMetrics { key: string }
export interface CalibrationBucket {
  lower: number; upper: number; samples: number; wins: number
  observedWinRate: number; shrunkenProbability: number
  predictedSamples: number; averagePredictedProbability: number | null; calibrationGap: number | null
}
export type ResearchReadiness = 'collecting' | 'exploratory' | 'review-ready'
export interface ResearchReport {
  horizon: HorizonKey
  generatedAt: number
  totalStored: number
  eligible: number
  pending: number
  excludedTest: number
  startTs: number | null
  endTs: number | null
  spanDays: number
  readiness: ResearchReadiness
  targetSamples: number
  byRegime: ResearchGroupMetric[]
  byDetector: ResearchGroupMetric[]
  bySymbol: ResearchGroupMetric[]
  calibration: CalibrationBucket[]
  walkForward: { folds: number; aggregate: FoldMetrics | null; foldMetrics: FoldMetrics[] }
}

interface Outcome { observation: ResearchObservation; value: number }

function groupMetric(key: string, outcomes: Outcome[]): ResearchGroupMetric {
  return { key, ...evaluateFold(outcomes.map(item => ({
    ts: item.observation.entryTs, score: item.observation.score, outcome: item.value,
    regime: item.observation.regime
  }))) }
}

function groupBy(outcomes: Outcome[], keys: (observation: ResearchObservation) => string[]): ResearchGroupMetric[] {
  const grouped = new Map<string, Outcome[]>()
  for (const outcome of outcomes) {
    for (const key of new Set(keys(outcome.observation).filter(Boolean))) {
      const list = grouped.get(key) ?? []
      list.push(outcome); grouped.set(key, list)
    }
  }
  return [...grouped.entries()].map(([key, values]) => groupMetric(key, values))
    .sort((a, b) => b.samples - a.samples || a.key.localeCompare(b.key))
}

function calibration(outcomes: Outcome[], binWidth = 0.25): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = []
  for (let lower = 0; lower < 3; lower += binWidth) {
    const values = outcomes.filter(item => Math.abs(item.observation.score) >= lower && Math.abs(item.observation.score) < lower + binWidth)
    if (!values.length) continue
    const wins = values.filter(item => item.value > 0).length
    const observedWinRate = wins / values.length
    const shrunkenProbability = (wins + 2) / (values.length + 4)
    const predictions = values.map(item => item.observation.calibratedProbability)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const averagePredictedProbability = predictions.length
      ? predictions.reduce((sum, value) => sum + value, 0) / predictions.length
      : null
    buckets.push({ lower, upper: lower + binWidth, samples: values.length, wins, observedWinRate,
      shrunkenProbability, predictedSamples: predictions.length, averagePredictedProbability,
      calibrationGap: averagePredictedProbability === null ? null : observedWinRate - averagePredictedProbability })
  }
  return buckets
}

function walkForward(outcomes: Outcome[]) {
  if (outcomes.length < 30) return { folds: 0, aggregate: null, foldMetrics: [] as FoldMetrics[] }
  const samples: LabeledSample[] = outcomes.map(item => ({ ts: item.observation.entryTs, score: item.observation.score,
    outcome: item.value, regime: item.observation.regime }))
  const trainSize = Math.max(20, Math.floor(samples.length * 0.5))
  const testSize = Math.max(5, Math.floor(samples.length * 0.2))
  const purgeSize = Math.max(1, Math.floor(samples.length * 0.05))
  const folds = purgedWalkForward(samples, trainSize, testSize, purgeSize)
  const foldMetrics = folds.map(fold => evaluateFold(fold.test))
  return { folds: folds.length, aggregate: foldMetrics.length ? evaluateFold(folds.flatMap(fold => fold.test)) : null, foldMetrics }
}

export function buildResearchReport(observations: ResearchObservation[], horizon: HorizonKey = '60s', now = Date.now()): ResearchReport {
  const production = observations.filter(item => !item.isTest)
  const outcomes: Outcome[] = production.flatMap(observation => {
    const value = observation.horizons[horizon]
    return typeof value === 'number' && Number.isFinite(value) ? [{ observation, value }] : []
  }).sort((a, b) => a.observation.entryTs - b.observation.entryTs)
  const startTs = outcomes[0]?.observation.entryTs ?? null
  const endTs = outcomes.at(-1)?.observation.entryTs ?? null
  const spanDays = startTs !== null && endTs !== null ? Math.max(0, endTs - startTs) / 86_400_000 : 0
  const readiness: ResearchReadiness = outcomes.length >= 200 && spanDays >= 7 ? 'review-ready' : outcomes.length >= 30 ? 'exploratory' : 'collecting'
  const latestMaturityCutoff = now - HORIZONS[horizon]
  const pending = production.filter(item => item.entryTs <= latestMaturityCutoff && item.horizons[horizon] === null).length +
    production.filter(item => item.entryTs > latestMaturityCutoff).length
  return {
    horizon, generatedAt: now, totalStored: observations.length, eligible: outcomes.length, pending,
    excludedTest: observations.length - production.length, startTs, endTs, spanDays, readiness, targetSamples: 200,
    byRegime: groupBy(outcomes, item => [item.regime || 'unknown']),
    byDetector: groupBy(outcomes, item => item.detectorTypes.length ? item.detectorTypes : ['NO_DETECTOR']),
    bySymbol: groupBy(outcomes, item => [item.symbol]),
    calibration: calibration(outcomes), walkForward: walkForward(outcomes)
  }
}
