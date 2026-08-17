import { describe, expect, it } from 'vitest'
import { DEFAULT_INSTRUMENT } from '../domain/instrument'
import type { Signal } from '../types'
import { TradePlanner } from './tradePlanner'
import { PositionSizer } from './positionSizer'

const signal: Signal = { id: 's1', symbol: 'BTCUSDT', side: 'BUY', price: 100, confidence: 80, score: 1,
  breakdown: { cvd: 1, obi: .2, vel: .5, w1: .5, w2: .3, w3: .2 }, ts: 1000 }

describe('approved-signal risk pipeline', () => {
  it('creates a directionally valid, tick-rounded plan only from an approved signal', () => {
    const planner = new TradePlanner({ minRR: 1, stopVolMultiple: 1.5, targetVolMultiple: 3, feeRateBps: 0, slippageBps: 0 })
    const plan = planner.create(signal, { spread: .01, volatilityBps: 10, walls: { bid: [], ask: [] }, instrument: { ...DEFAULT_INSTRUMENT, tickSize: .01 } })
    expect(plan.direction).toBe('LONG')
    expect(plan.stop!).toBeLessThan(plan.entry!)
    expect(plan.tp1!).toBeGreaterThan(plan.entry!)
    expect(Number((plan.entry! * 100).toFixed(8)) % 1).toBe(0)
  })

  it('recomputes all position fields after Kelly scaling', () => {
    const sizer = new PositionSizer({ balance: 1000, riskPct: 1, maxLeverage: 10, feeRateBps: 4, kellyFraction: .25, maintenanceMarginRate: .004 })
    const position = sizer.size({ direction: 'LONG', confidence: 80, entry: 100, stop: 98, tp1: 104, tp2: 106, rr: 2, ts: 1 },
      { ...DEFAULT_INSTRUMENT, tickSize: .01, lotSize: .001, maxLeverage: 10 }, { trades: 20, wins: 12 })!
    expect(position.notional).toBeCloseTo(position.qty * 100)
    expect(position.margin).toBeCloseTo(position.notional / position.leverage)
    expect(position.fee).toBeCloseTo(position.notional * .0004 * 2)
    expect(position.notional).toBeLessThanOrEqual(10_000)
  })
})
