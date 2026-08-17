import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import type { MarketEvent } from '../../types'
import { MarketReplay, parseJsonLines } from './marketReplay'

const events: MarketEvent[] = [
  { kind: 'markPrice', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 2000, receiveTs: 2002, price: 101 },
  { kind: 'markPrice', exchange: 'binance', symbol: 'BTCUSDT', eventTs: 1000, receiveTs: 1001, price: 100 }
]

describe('deterministic replay', () => {
  it('sorts by event time and advances the injected clock', () => {
    const clock = new ManualClock()
    const output: number[] = []
    const replay = new MarketReplay(clock, { ingest: event => output.push(event.eventTs) })
    expect(replay.run(events).processed).toBe(2)
    expect(output).toEqual([1000, 2000])
    expect(clock.now()).toBe(2002)
  })

  it('round-trips JSONL fixtures', () => {
    const text = events.map(event => JSON.stringify(event)).join('\n')
    expect(parseJsonLines(text)).toEqual(events)
  })
})
