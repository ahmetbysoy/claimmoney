import { describe, expect, it } from 'vitest'
import { SignalEngine } from './engine'

const tick = (engine: SignalEngine, score: number, ts: number, qualified = true) => engine.tick({
  score, price: 100, breakdown: { cvd: score, obi: score, vel: score }, weights: { w1: 1, w2: 0, w3: 0 }, ts, qualified
})

describe('SignalEngine qualification invariants', () => {
  it('does not combine opposite directions into two confirmations', () => {
    const engine = new SignalEngine({ threshold: .75, cooldownMs: 1000, hysteresis: .3 })
    expect(tick(engine, .9, 1000).state).toBe('ARMED')
    const opposite = tick(engine, -.9, 1100)
    expect(opposite.state).toBe('ARMED')
    expect(opposite.signal).toBeNull()
    expect(tick(engine, -.9, 1200).signal?.side).toBe('SELL')
  })

  it('does not arm on a filtered frame', () => {
    const engine = new SignalEngine({ threshold: .75, cooldownMs: 1000, hysteresis: .3 })
    expect(tick(engine, .9, 1000, false).state).toBe('IDLE')
    expect(tick(engine, .9, 1100, true).state).toBe('ARMED')
    expect(tick(engine, .9, 1200, true).signal?.side).toBe('BUY')
  })

  it('resets confirmation after the maximum gap', () => {
    const engine = new SignalEngine({ threshold: .75, cooldownMs: 1000, hysteresis: .3, maxConfirmationGapMs: 200 })
    tick(engine, .9, 1000)
    expect(tick(engine, .9, 1300).signal).toBeNull()
  })
})
