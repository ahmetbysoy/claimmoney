import { describe, expect, it } from 'vitest'
import type { FeatureFrame, FeatureValue } from '../../types'
import { SignalEngine } from './engine'
import { DecisionPipeline } from './decisionPipeline'

const value = (n: number, valid = true): FeatureValue => ({ value: n, valid, warmup: 1, ageMs: 0 })
const frame = (quality: FeatureFrame['quality'], ts: number): FeatureFrame => ({
  id: `f-${ts}`, symbol: 'BTCUSDT', exchange: 'binance', eventTs: ts, receiveTs: ts, quality,
  cvdNorm: value(.7), cvdZ: value(2), obi: value(.7), velocityZ: value(2), microDev: value(.8),
  vpin: value(.2, false), detectorScore: value(.8), volatility: value(5), divergence: value(0), price: 100, spread: .01
})
const weights = { w1: .3, w2: .18, w3: .13, w4: .16, w5: .1, w6: .13 }

describe('DecisionPipeline ordering', () => {
  it('runs quality filters before FSM confirmation', () => {
    const pipeline = new DecisionPipeline(new SignalEngine())
    const prices = Array.from({ length: 20 }, (_, i) => ({ price: 90 + i, ts: 1000 + i * 100 }))
    const config = { weights, threshold: .5, cooldownMs: 1000, confirmations: 2, minConfirmationMs: 0, crossSpreadPct: 0, strategyVersion: 'test' }
    expect(pipeline.evaluate(frame('invalid', 3000), prices, config).state).toBe('IDLE')
    expect(pipeline.evaluate(frame('good', 3100), prices, config).state).toBe('ARMED')
    expect(pipeline.evaluate(frame('good', 3200), prices, config).signal?.side).toBe('BUY')
  })
})
