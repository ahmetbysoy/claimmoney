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

  it('reports FIRED as a transition while persisting COOLDOWN immediately', () => {
    const engine = new SignalEngine({ threshold: .75, cooldownMs: 1000, hysteresis: .3 })
    tick(engine, .9, 1000)
    expect(tick(engine, .9, 1100).state).toBe('FIRED')
    expect(engine.getState()).toBe('COOLDOWN')
  })

  it('requires sustained neutral dwell before allowing an opposite-side signal', () => {
    const engine = new SignalEngine({ threshold: .75, cooldownMs: 100, hysteresis: .3, neutralDwellMs: 250 })
    tick(engine, .9, 1000); tick(engine, .9, 1100)
    expect(tick(engine, 0, 1200).state).toBe('IDLE')
    expect(tick(engine, -.9, 1210).reason).toBe('hysteresis-block')
    tick(engine, 0, 1300)
    tick(engine, 0, 1550)
    expect(tick(engine, -.9, 1560).state).toBe('ARMED')
    expect(tick(engine, -.9, 1600).signal?.side).toBe('SELL')
  })
})
