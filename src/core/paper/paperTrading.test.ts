import { describe, expect, it } from 'vitest'
import { ManualClock } from '../../application/clock'
import { PaperTradingEngine } from './paperTrading'
import type { PositionSize, TradePlan } from '../signal/tradePlan'

const plan: TradePlan = { direction: 'LONG', confidence: 80, entry: 100, stop: 99, tp1: 102, tp2: 104, rr: 2, ts: 1000 }
const size: PositionSize = { riskPct: 1, qty: 10, notional: 1000, contractMultiplier: 1, margin: 100, leverage: 10, fee: 0, breakEven: 0, liqPriceEstimate: 90, maxRiskUSD: 10, rr: 2 }
const book = { bids: [{ price: 99, qty: 100 }], asks: [{ price: 100, qty: 100 }] }

describe('PaperTradingEngine accounting', () => {
  it('uses dollar risk including quantity when computing R', () => {
    const clock = new ManualClock(1000)
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0 }, clock)
    paper.submitPlan('signal-1', plan, size, 99)
    paper.update(100, book)
    expect(paper.getOpenPositions()).toHaveLength(1)
    clock.advance(1000); paper.update(99)
    expect(paper.getPerformance().netR).toBeCloseTo(-1, 5)
    expect(paper.getPerformance().netPnl).toBeCloseTo(-10, 5)
  })

  it('applies the instrument contract multiplier to PnL, fees and initial risk', () => {
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0 }, new ManualClock(1000))
    const contractSize = { ...size, contractMultiplier: 0.01, notional: 10, maxRiskUSD: 0.1 }
    paper.submitPlan('contract-size', plan, contractSize, 99)
    paper.update(100, book); paper.update(99)
    expect(paper.getPerformance().netPnl).toBeCloseTo(-0.1, 8)
    expect(paper.getPerformance().netR).toBeCloseTo(-1, 8)
  })

  it('deduplicates one plan and supports TP1 partial then TP2 close', () => {
    const clock = new ManualClock(1000)
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0, tp1Fraction: .5 }, clock)
    expect(paper.submitPlan('signal-1', plan, size, 99)).not.toBeNull()
    expect(paper.submitPlan('signal-1', plan, size, 99)).toBeNull()
    paper.update(100, book); paper.update(102)
    const open = paper.getOpenPositions()[0]
    expect(open.tp1Filled).toBe(true)
    expect(open.qty).toBe(5)
    paper.update(104)
    expect(paper.getClosedPositions()).toHaveLength(1)
    expect(paper.getPerformance().netPnl).toBeCloseTo(30, 6)
  })

  it('walks only asks for a long fill and computes volume-weighted slippage', () => {
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0, maxSlippageBps: 25 }, new ManualClock(1000))
    paper.submitPlan('signal-depth', plan, size, 99)
    paper.update(100, {
      bids: [{ price: 99.9, qty: 1_000_000 }],
      asks: [{ price: 100, qty: 5 }, { price: 100.2, qty: 5 }]
    })
    const position = paper.getOpenPositions()[0]
    expect(position.entry).toBeCloseTo(100.1, 8)
    expect(position.slippageBps).toBeCloseTo(10, 8)
  })

  it('does not fabricate a fill when sampled executable liquidity is insufficient', () => {
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0 }, new ManualClock(1000))
    paper.submitPlan('signal-thin', plan, size, 99)
    paper.update(100, { bids: [{ price: 99, qty: 1_000 }], asks: [{ price: 100, qty: 9 }] })
    expect(paper.getOpenPositions()).toHaveLength(0)
    expect(paper.getOrders()[0].status).toBe('pending')
  })

  it('reports unannualized mean-R over standard deviation as return quality', () => {
    const paper = new PaperTradingEngine({ feeRateBps: 0, cooldownMs: 0 }, new ManualClock(1000))
    for (const [index, outcome] of [1, 1, 1, 1, -1, -1].entries()) {
      paper.submitPlan(`quality-${index}`, { ...plan, ts: 1000 + index }, size, 99)
      paper.update(100, book)
      paper.close(paper.getOpenPositions()[0], 100 + outcome, 'manual')
    }
    expect(paper.getPerformance().returnQuality).toBeCloseTo(0.353553, 5)
  })
})
