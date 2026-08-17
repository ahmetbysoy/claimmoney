import { describe, expect, it } from 'vitest'
import { ManualClock } from './clock'
import { MarketRuntime, type RuntimeSettings } from './marketRuntime'
import { MarketReplay } from '../testing/replay/marketReplay'
import type { MarketEvent } from '../types'
import { createRuntimeCollaborators } from './runtimeCollaborators'
import { inferInstrument } from '../domain/instrument'
import { vi } from 'vitest'

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

  it('exports versioned research context and marks injected signals as test data', () => {
    const clock = new ManualClock(5_000)
    const runtime = new MarketRuntime({ settings: () => settings, clock, enableNetworkServices: false })
    runtime.injectTestSignal('BUY')
    const observations = runtime.exportResearchObservations()
    expect(observations).toHaveLength(1)
    expect(observations[0]).toMatchObject({ version: 1, isTest: true, regime: 'warming', dataQuality: 'warming' })
    expect(observations[0].id).toContain(runtime.sessionId)
  })

  it('retains mark price without treating it as traded or paper-executable price', () => {
    const clock = new ManualClock(1_000)
    const runtime = new MarketRuntime({ settings: () => settings, clock, enableNetworkServices: false })
    runtime.ingest({ kind: 'bookSnapshot', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_000, receiveTs: 1_001,
      seq: 10, bids: [[99, 20]], asks: [[100, 20]] })
    runtime.ingest({ kind: 'trade', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_010, receiveTs: 1_011,
      trade: { price: 100, qty: 1, side: 'buy', ts: 1_010, notional: 100 } })
    runtime.ingest({ kind: 'markPrice', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_020, receiveTs: 1_021, price: 120 })
    expect(runtime.snapshot()).toMatchObject({ price: 100, markPrice: 120 })
  })

  it('separates 100 ms feature evaluation from bounded read-model publication', () => {
    const clock = new ManualClock(1_000)
    const snapshots: unknown[] = []
    const runtime = new MarketRuntime({ settings: () => settings, clock, enableNetworkServices: false,
      snapshotIntervalMs: 250, onSnapshot: snapshot => snapshots.push(snapshot) })
    runtime.ingest({ kind: 'bookSnapshot', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_000, receiveTs: 1_001,
      seq: 10, bids: [[100, 2]], asks: [[101, 2]] })
    for (const ts of [1_000, 1_100, 1_200, 1_250]) {
      clock.set(ts)
      runtime.ingest({ kind: 'trade', exchange: 'binance', symbol: 'BTCUSDT', eventTs: ts, receiveTs: ts + 1,
        trade: { price: 100, qty: 1, side: 'buy', ts, notional: 100 } })
    }
    expect(snapshots).toHaveLength(2)
    runtime.injectTestSignal('BUY')
    const first = runtime.snapshot(), second = runtime.snapshot()
    expect(first.signals).toBe(second.signals)
  })

  it('uses injected collaborators, wires liquidations, and disposes owned lifecycle subscriptions', () => {
    const clock = new ManualClock(1_000)
    const collaborators = createRuntimeCollaborators(clock, inferInstrument(settings.symbol), settings)
    const applySnapshot = vi.spyOn(collaborators.book, 'applySnapshot')
    const detectorInput = vi.spyOn(collaborators.detectorSuite, 'setData')
    const stopCrossExchange = vi.spyOn(collaborators.crossExchange, 'stop')
    const onBookResyncRequired = vi.fn()
    const runtime = new MarketRuntime({ settings: () => settings, clock, collaborators, enableNetworkServices: false, onBookResyncRequired })

    runtime.ingest({ kind: 'bookSnapshot', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_000, receiveTs: 1_001,
      seq: 10, bids: [[100, 2]], asks: [[101, 2]] })
    runtime.ingest({ kind: 'liquidation', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_100, receiveTs: 1_101,
      side: 'long', price: 99, qty: 2, notional: 198 })

    expect(applySnapshot).toHaveBeenCalledOnce()
    expect(detectorInput).toHaveBeenLastCalledWith(expect.objectContaining({
      liquidations: [expect.objectContaining({ side: 'SELL', price: 99, qty: 2 })]
    }))
    runtime.ingest({ kind: 'bookDelta', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1_200, receiveTs: 1_201,
      firstSeq: 20, lastSeq: 20, bids: [], asks: [] })
    expect(onBookResyncRequired).toHaveBeenCalledWith(expect.objectContaining({ expected: 11, received: 20 }))
    runtime.dispose()
    expect(stopCrossExchange).toHaveBeenCalled()
  })
})
