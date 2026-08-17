import type { DataQuality, FilterDecision, FeatureFrame } from '../../types'

const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
const std = (values: number[]) => {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function isFlatMarket(priceHistory: { price: number; ts: number }[], windowMs = 60_000, baseThresholdPct = 0.02, now?: number): boolean {
  if (priceHistory.length < 10) return false
  const evaluationTime = now ?? priceHistory.at(-1)?.ts ?? Date.now()
  const prices = priceHistory.filter(item => item.ts >= evaluationTime - windowMs).map(item => item.price).filter(Number.isFinite)
  if (prices.length < 10) return false
  const high = Math.max(...prices), low = Math.min(...prices), mid = (high + low) / 2
  if (!mid) return true
  const rangePct = (high - low) / mid * 100
  const volatilityPct = std(prices) / mid * 100
  return rangePct < clamp(Math.max(baseThresholdPct, volatilityPct * 1.2), 0.02, 0.15)
}

export function hasOBIConfluence(obi: number, minAbs = 0.06, score?: number): boolean {
  const strong = Math.abs(obi) >= minAbs
  return score === undefined ? strong : strong && Math.sign(obi) === Math.sign(score)
}

export function hasConfluence(cvdZ: number, obi: number, velZ: number, score: number, minZ = 0.30): boolean {
  if (!score) return false
  const direction = Math.sign(score)
  const normalizedObi = obi * 2
  return [cvdZ, normalizedObi, velZ].filter(value => Math.sign(value) === direction && Math.abs(value) >= minZ).length >= 2
}

export function isHighArbitrageSpread(spreadPct: number, threshold = 0.15): boolean { return spreadPct > threshold }
export interface FilterResult { pass: boolean; reason?: string; decisions?: FilterDecision[]; scoreAdjustment?: number }

export interface FilterParams {
  priceHistory: { price: number; ts: number }[]; cvdZ: number; obi: number; velZ: number; score: number
  spreadPct?: number; quality?: DataQuality; vpin?: number; vpinValid?: boolean; now?: number
}

export function evaluateFilters(params: FilterParams): FilterDecision[] {
  const decisions: FilterDecision[] = []
  const add = (id: string, pass: boolean, reason: string, mode: FilterDecision['mode'] = 'hard-veto', adjustment = 0) => decisions.push({ id, pass, reason, mode, adjustment })
  const quality = params.quality ?? 'good'
  add('data-quality', quality === 'good', quality === 'good' ? 'Data is fresh and synchronized' : `Data quality: ${quality}`)
  const flat = isFlatMarket(params.priceHistory, 60_000, 0.02, params.now)
  add('market-regime', !flat, flat ? 'Flat market — range below adaptive threshold' : 'Market range is sufficient', 'soft-penalty', flat ? -0.15 : 0)
  add('obi-strength', hasOBIConfluence(params.obi, 0.06, params.score), `Directional OBI ${params.obi.toFixed(3)}`)
  add('feature-confluence', hasConfluence(params.cvdZ, params.obi, params.velZ, params.score, 0.30), 'Need two of CVD/OBI/velocity in score direction')
  const crossSpread = params.spreadPct ?? 0
  add('cross-exchange-quality', !isHighArbitrageSpread(crossSpread, 0.15), `Cross-exchange dispersion ${crossSpread.toFixed(3)}%`)
  const toxicityPass = !(params.vpinValid && (params.vpin ?? 0) >= 0.7 && Math.abs(params.score) < 1)
  add('toxicity', toxicityPass, toxicityPass ? 'Toxicity gate passed' : 'Toxic flow with insufficient directional score')
  return decisions
}

export function applyFilters(params: FilterParams): FilterResult {
  const decisions = evaluateFilters(params)
  const hardFailure = decisions.find(decision => decision.mode === 'hard-veto' && !decision.pass)
  const scoreAdjustment = decisions.filter(decision => decision.mode === 'soft-penalty' && !decision.pass).reduce((sum, decision) => sum + decision.adjustment, 0)
  return { pass: !hardFailure, reason: hardFailure?.reason, decisions, scoreAdjustment }
}

export function filtersForFrame(frame: FeatureFrame, score: number, priceHistory: { price: number; ts: number }[], spreadPct = 0): FilterResult {
  return applyFilters({ priceHistory, cvdZ: frame.cvdZ.value, obi: frame.obi.value, velZ: frame.velocityZ.value,
    score, spreadPct, quality: frame.quality, vpin: frame.vpin.value, vpinValid: frame.vpin.valid, now: frame.eventTs })
}
