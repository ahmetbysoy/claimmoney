import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import { FlowEngine } from './flowEngine'

describe('FlowEngine boundaries', () => {
  it('does not lose the trade that rolls a time bucket', () => {
    const clock = new ManualClock(1000)
    const flow = new FlowEngine({ timeframeMs: 5000, mode: 'time' }, clock)
    flow.updateBucket({ price: 100, notional: 100, side: 'buy', ts: 1000 })
    flow.updateBucket({ price: 101, notional: 75, side: 'sell', ts: 6000 })
    expect(flow.getCandles()).toHaveLength(1)
    expect(flow.getCandles()[0].activity).toBe(100)
    expect(flow.getActiveBucket()?.activity).toBe(75)
  })

  it('splits an oversized trade across volume buckets', () => {
    const flow = new FlowEngine({ mode: 'volume', volumeTarget: 100, maxCandles: 10 })
    flow.updateBucket({ price: 10, notional: 250, side: 'buy', ts: 1000 })
    expect(flow.getCandles()).toHaveLength(2)
    expect(flow.getCandles().map(c => c.activity)).toEqual([100, 100])
    expect(flow.getActiveBucket()?.activity).toBe(50)
  })

  it('tracks genuine pressure high and low', () => {
    const flow = new FlowEngine({ mode: 'time', timeframeMs: 1000 })
    flow.updateBucket({ price: 100, notional: 100, side: 'buy', ts: 1000 })
    flow.updateBucket({ price: 100, notional: 300, side: 'sell', ts: 1100 })
    flow.tick(100, 0, 2000)
    const candle = flow.getLastCandle()!
    expect(candle.pressureHigh).toBe(100)
    expect(candle.pressureLow).toBe(-50)
  })
})
