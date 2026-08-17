import { describe, expect, it } from 'vitest'
import { ManualClock } from './clock'
import { MarketRuntime, type RuntimeSettings } from './marketRuntime'
import { MarketReplay } from '../testing/replay/marketReplay'
import type { MarketEvent } from '../types'

const settings: RuntimeSettings = {
  source: 'binance', symbol: 'BTCUSDT',
  weights: { w1: 0.9, w2: 0.8, w3: 0.7, w4: 0.6, w5: 0.5, w6: 0.4 },
  threshold: 1.4, cooldown: 15, confirmations: 2, minConfirmationMs: 250,
  paperTradingEnabled: true, balance: 10_000, riskPct: 1
}

function recording(): MarketEvent[] {
  const events: MarketEvent[] = [{
    kind: 'bookSnapshot', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_000, receiveTs: 1_001, seq: 10,
    bids: Array.from({ length: 12 }, (_, i) => [50_000 - i, 2 + i * 0.1]),
    asks: Array.from({ length: 12 }, (_, i) => [50_001 + i, 2 + i * 0.1])
  }]
  let seq = 10
  for (let i = 0; i < 100; i += 1) {
    const ts = 1_100 + i * 100
    const price = 50_000 + i * 0.2
    events.push({
      kind: 'trade', exchange: 'binance', symbol: 'BTCUSDT', eventTs: ts, receiveTs: ts + 2,
      trade: { price, priceStr: price.toFixed(1), qty: 0.05 + (i % 3) * 0.01,
        side: i % 4 ? 'buy' : 'sell', ts, notional: price * (0.05 + (i % 3) * 0.01) }
    })
    if (i % 5 === 0) {
      seq += 1
      events.push({
        kind: 'bookDelta', exchange: 'binance', symbol: 'BTCUSDT', eventTs: ts + 1, receiveTs: ts + 3,
        firstSeq: seq, lastSeq: seq, bids: [[50_000, 2 + i * 0.01]], asks: [[50_001, 2.5 + i * 0.01]]
      })
    }
  }
  return events
}

function runReplay() {
  const clock = new ManualClock(1_000)
  const runtime = new MarketRuntime({ settings: () => settings, clock, enableNetworkServices: false })
  const replay = new MarketReplay(clock, runtime).run(recording())
  const snapshot = runtime.snapshot()
  return {
    replay,
    frame: snapshot.frame,
    metrics: snapshot.metrics,
    regime: snapshot.regime,
    signals: snapshot.signals,
    detectorSignals: snapshot.detectorSignals,
    performance: snapshot.paperPerformance
  }
}

describe('MarketRuntime deterministic replay', () => {
  it('produces byte-equivalent decision state from the same recording', () => {
    const first = runReplay()
    const second = runReplay()
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.replay.processed).toBe(recording().length)
    expect(first.frame).not.toBeNull()
  })
})
