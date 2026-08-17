import { describe, expect, it } from 'vitest'
import { buildResearchReport } from './researchAnalytics'
import type { ResearchObservation } from './researchRepository'

const DAY = 86_400_000
const observation = (index: number, outcome: number, overrides: Partial<ResearchObservation> = {}): ResearchObservation => ({
  version: 1, id: `session:${index}`, sessionId: 'session', signalId: String(index), symbol: index % 2 ? 'BTCUSDT' : 'ETHUSDT',
  strategyVersion: 'claimmoney-v2', side: index % 2 ? 'BUY' : 'SELL', score: 0.8 + index % 4 * 0.25,
  confidence: 60 + index % 20, calibratedProbability: 0.6 + index % 3 * 0.05,
  entry: 1_000, entryTs: index * DAY / 20,
  regime: index % 2 ? 'trend' : 'range', regimeConfidence: 0.8, dataQuality: 'good',
  detectorTypes: index % 3 ? ['BOOK_SKEW'] : ['FLOW_DELTA_EXPANSION'], volatilityBps: 5, vpin: 0.4, spreadBps: 1,
  isTest: false, horizons: { '15s': outcome / 2, '30s': outcome * 0.8, '60s': outcome, '300s': null, '900s': null },
  mfe: Math.max(0, outcome), mae: Math.min(0, outcome), closed: false, updatedAt: index * DAY / 20 + 60_000,
  ...overrides
})

describe('research analytics', () => {
  it('groups mature outcomes and excludes user-injected test signals', () => {
    const observations = Array.from({ length: 40 }, (_, index) => observation(index, index % 3 ? 0.2 : -0.1))
    observations.push(observation(99, 10, { id: 'test', isTest: true, strategyVersion: 'claimmoney-v2-test' }))
    const report = buildResearchReport(observations, '60s', 20 * DAY)
    expect(report.eligible).toBe(40)
    expect(report.excludedTest).toBe(1)
    expect(report.byRegime.map(item => item.key)).toEqual(expect.arrayContaining(['trend', 'range']))
    expect(report.byDetector.some(item => item.key === 'BOOK_SKEW')).toBe(true)
    expect(report.calibration.length).toBeGreaterThan(0)
    expect(report.calibration.some(bucket => bucket.predictedSamples > 0 && bucket.calibrationGap !== null)).toBe(true)
    expect(report.walkForward.folds).toBeGreaterThan(0)
    expect(report.readiness).toBe('exploratory')
  })

  it('requires both sample depth and a seven-day window before review-ready', () => {
    const observations = Array.from({ length: 210 }, (_, index) => observation(index, index % 2 ? 0.1 : -0.05, { entryTs: index * 8 * DAY / 209 }))
    const report = buildResearchReport(observations, '60s', 9 * DAY)
    expect(report.spanDays).toBeCloseTo(8)
    expect(report.readiness).toBe('review-ready')
    expect(report.eligible).toBe(210)
  })
})
