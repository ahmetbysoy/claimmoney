import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import { CrossExchangePoller } from './crossExchange'

describe('CrossExchange actionable spread', () => {
  it('computes highest sellable bid minus lowest buyable ask', () => {
    const clock = new ManualClock(1000)
    const poller = new CrossExchangePoller({}, clock)
    ;(poller as any).state = {
      binance: { bid: 100, ask: 101, mid: 100.5, ts: 1000, latencyMs: 1, status: 'live' },
      bybit: { bid: 102, ask: 103, mid: 102.5, ts: 1000, latencyMs: 1, status: 'live' },
      okx: { bid: 99, ask: 100.5, mid: 99.75, ts: 1000, latencyMs: 1, status: 'live' },
      mexc: { bid: 0, ask: 0, mid: 0, ts: 0, latencyMs: 0, status: 'disconnected' }
    }
    const spread = poller.getMaxSpread()
    expect(spread.buyExchange).toBe('okx')
    expect(spread.sellExchange).toBe('bybit')
    expect(spread.grossSpread).toBe(1.5)
    expect(spread.valid).toBe(true)
  })

  it('rejects one-exchange dispersion as arbitrage', () => {
    const poller = new CrossExchangePoller()
    ;(poller as any).state.binance = { bid: 100, ask: 101, mid: 100.5, ts: Date.now(), latencyMs: 1, status: 'live' }
    expect(poller.getMaxSpread().valid).toBe(false)
  })
})
