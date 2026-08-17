import { describe, expect, it } from 'vitest'
import { evaluateFold, purgedWalkForward } from './walkForward'

describe('purged walk-forward evaluation', () => {
  it('keeps a purge gap between train and test', () => {
    const samples = Array.from({ length: 100 }, (_, ts) => ({ ts, score: 1, outcome: ts % 2 ? 1 : -1 }))
    const folds = purgedWalkForward(samples, 40, 10, 5)
    expect(folds.length).toBeGreaterThan(0)
    expect(folds[0].testStart - folds[0].train.at(-1)!.ts).toBe(6)
  })
  it('calculates expectancy and drawdown', () => {
    const metrics = evaluateFold([{ ts: 1, score: 1, outcome: 1 }, { ts: 2, score: 1, outcome: -2 }, { ts: 3, score: 1, outcome: 3 }])
    expect(metrics.expectancy).toBeCloseTo(2 / 3)
    expect(metrics.maxDrawdown).toBe(2)
  })
})
