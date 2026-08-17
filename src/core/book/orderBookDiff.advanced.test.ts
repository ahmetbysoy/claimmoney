import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import { OrderBookDiff } from './orderBookDiff'

describe('OrderBookDiff advanced invariants', () => {
  it('replaces snapshots and removes stale levels', () => {
    const clock = new ManualClock(1000)
    const book = new OrderBookDiff({ maxLevels: 10 }, clock)
    book.applySnapshot('BTCUSDT', { bids: [[100, 2], [99, 1]], asks: [[101, 2], [102, 1]], lastUpdateId: 10, ts: 1000 })
    book.applySnapshot('BTCUSDT', { bids: [[100, 3]], asks: [[101, 4]], lastUpdateId: 20, ts: 1100 })
    expect(book.getBook().bids).toHaveLength(1)
    expect(book.getBook().asks).toHaveLength(1)
    expect(book.getMicrostructure()?.obi).toBeLessThan(0)
  })

  it('accepts contiguous delta, rejects stale update and flags a sequence gap', () => {
    const book = new OrderBookDiff()
    book.applySnapshot('BTCUSDT', { bids: [[100, 1]], asks: [[101, 1]], lastUpdateId: 10 })
    expect(book.applyDelta({ bids: [[100, 2]], asks: [], U: 11, u: 12 })).toBe('applied')
    expect(book.applyDelta({ bids: [[100, 9]], asks: [], U: 10, u: 12 })).toBe('stale')
    expect(book.applyDelta({ bids: [], asks: [[101, 2]], U: 15, u: 16 })).toBe('gap')
    expect(book.isSynced()).toBe(false)
  })

  it('returns immutable snapshots and ordered sides', () => {
    const book = new OrderBookDiff()
    book.applySnapshot('BTCUSDT', { bids: [[99, 1], [100, 1]], asks: [[102, 1], [101, 1]], lastUpdateId: 1 })
    const snapshot = book.getBook()
    expect(snapshot.bids.map(x => x.price)).toEqual([100, 99])
    expect(snapshot.asks.map(x => x.price)).toEqual([101, 102])
    snapshot.bids[0].qty = 999
    expect(book.getBook().bids[0].qty).toBe(1)
  })
})
