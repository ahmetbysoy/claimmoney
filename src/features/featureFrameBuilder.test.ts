import { describe, expect, it } from 'vitest'
import { FeatureFrameBuilder, type FeatureFrameInput } from './featureFrameBuilder'

const input = (at: number): FeatureFrameInput => ({
  at, receiveTs: at, symbol: 'BTCUSDT', exchange: 'binance', price: 100,
  micro: { spread: 1, spreadBps: 100, mid: 100, bestBid: 99.5, bestAsk: 100.5,
    microprice: 100, microDev: 0, obi: 0, bidSlope: 0, askSlope: 0, depthBid: 1, depthAsk: 1,
    topBidQty: 1, topAskQty: 1, valid: true },
  bookSynced: true, bookAgeMs: 0, tradeAgeMs: 0,
  vpin: { value: 0, label: 'Warming', buckets: [], currentBuy: 0, currentSell: 0,
    currentNotional: 0, bucketSize: 100, valid: false, warmup: 0, lastUpdateTs: at },
  detectorBull: 0, detectorBear: 0
})

describe('FeatureFrameBuilder rolling flow', () => {
  it('maintains the 60-second normalized CVD incrementally and expires old flow', () => {
    const builder = new FeatureFrameBuilder(100)
    builder.addTrade({ price: 100, qty: 1, notional: 100, side: 'buy', ts: 1_000 })
    expect(builder.build(input(1_000))?.cvdNorm.value).toBe(1)
    builder.addTrade({ price: 100, qty: .5, notional: 50, side: 'sell', ts: 2_000 })
    expect(builder.build(input(2_000))?.cvdNorm.value).toBeCloseTo(1 / 3)
    expect(builder.build(input(62_000))?.cvdNorm.value).toBe(-1)
  })

  it('rebuilds deterministically when an out-of-order trade arrives', () => {
    const builder = new FeatureFrameBuilder(100)
    builder.addTrade({ price: 100, qty: 1, notional: 100, side: 'buy', ts: 1_000 })
    builder.addTrade({ price: 100, qty: .5, notional: 50, side: 'sell', ts: 2_000 })
    builder.build(input(2_000))
    builder.addTrade({ price: 100, qty: .5, notional: 50, side: 'buy', ts: 1_500 })
    expect(builder.build(input(2_100))?.cvdNorm.value).toBeCloseTo(0.5)
  })
})
