import { describe, expect, it } from 'vitest'
import { SignalTracker } from './signalTracker'
import type { Signal } from '../../types'

const signal = (id: string, ts: number): Signal => ({ id, side: 'BUY', price: 100, confidence: 80, score: 1,
  breakdown: { cvd: 1, obi: 1, vel: 1, w1: 1, w2: 0, w3: 0 }, ts })

describe('SignalTracker unbiased horizon samples', () => {
  it('does not count pending 60s and 5m horizons as zero-return losses', () => {
    const tracker = new SignalTracker()
    tracker.addSignal(signal('a', 0))
    tracker.updatePrice(101, 15_000)
    const stats = tracker.getStats()
    expect(stats.samples15s).toBe(1)
    expect(stats.samples60s).toBe(0)
    expect(stats.win60s).toBe(0)
    expect(stats.avg60s).toBe(0)
  })

  it('isolates symbol price streams', () => {
    const tracker = new SignalTracker()
    tracker.addSignal({ ...signal('btc', 0), symbol: 'BTCUSDT' })
    tracker.updatePrice(200, 60_000, 'ETHUSDT')
    expect(tracker.get('btc')?.horizons['15s']).toBeNull()
  })
})
