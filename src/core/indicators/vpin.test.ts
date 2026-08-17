import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import { VPIN } from './vpin'

describe('VPIN volume buckets', () => {
  it('closes an exact bucket after adding the boundary trade', () => {
    const clock = new ManualClock(1000)
    const vpin = new VPIN({ minBucketNotional: 100, rollingBucketFraction: 0, minWarmupBuckets: 1 }, clock)
    const state = vpin.update({ price: 10, qty: 10, side: 'buy', notional: 100, ts: 1000 })
    expect(state.buckets).toEqual([1])
    expect(state.currentNotional).toBe(0)
    expect(state.valid).toBe(true)
    expect(state.label).toBe('Toxic')
  })

  it('splits an oversized trade into multiple buckets', () => {
    const vpin = new VPIN({ minBucketNotional: 100, rollingBucketFraction: 0, minWarmupBuckets: 3 })
    const state = vpin.update({ price: 1, qty: 250, side: 'sell', notional: 250, ts: 1000 })
    expect(state.buckets).toHaveLength(2)
    expect(state.currentNotional).toBe(50)
    expect(state.valid).toBe(false)
    expect(state.label).toBe('Warming')
  })

  it('uses event time for low-volume timeout', () => {
    const vpin = new VPIN({ minBucketNotional: 100, rollingBucketFraction: 0, bucketTimeoutMs: 1000, minWarmupBuckets: 1 })
    vpin.update({ price: 1, qty: 10, side: 'buy', notional: 10, ts: 1000 })
    const state = vpin.update({ price: 1, qty: 10, side: 'sell', notional: 10, ts: 2500 })
    expect(state.buckets).toHaveLength(1)
  })
})
