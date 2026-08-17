import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DetectorSuite } from './detectorSuite'
import type { OrderBook } from '../book/orderBookDiff'

const level = (price: number, qty: number) => ({ price, qty, notional: price * qty })
const baseBook = (bidWall = true): OrderBook => ({
  bids: Array.from({ length: 12 }, (_, i) => level(100 - i * .1, i === 1 && bidWall ? 1000 : 10)),
  asks: Array.from({ length: 12 }, (_, i) => level(100.2 + i * .1, 10)),
  ts: Date.now(), lastUpdateId: 1, synced: true
})

describe('DetectorSuite directional evidence', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100_000) })
  afterEach(() => vi.useRealTimers())

  it('marks a pulled bid wall as bearish suspected spoof', () => {
    const detector = new DetectorSuite({ minConfidence: 100, spoofWindowSec: 3 })
    const signals: any[] = []
    detector.on('signal:add', (signal: any) => signals.push(signal))
    detector.setData({ book: baseBook(true), micro: { obi: 0, bestBid: 100, bestAsk: 100.2, spread: .2, mid: 100.1 }, lastPrice: 99.9 })
    detector.run()
    expect(detector.getWalls().bid[0]?.side).toBe('bid')
    vi.setSystemTime(100_800)
    detector.setData({ book: baseBook(false), micro: { obi: 0, bestBid: 100, bestAsk: 100.2, spread: .2, mid: 100.1 }, lastPrice: 99.9 })
    detector.run()
    const spoof = signals.find(signal => signal.type === 'HIGH_CONFIDENCE_SPOOF')
    expect(spoof?.bias).toBe('bearish')
  })
})
