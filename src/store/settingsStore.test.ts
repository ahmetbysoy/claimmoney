import { describe, expect, it } from 'vitest'
import { migrateSettings, normalizeStrategyWeights } from './settingsStore'

describe('settings migrations', () => {
  it.each([1, 4, 5, 6, 7])('migrates version %i through every step to v8 shape', version => {
    const migrated = migrateSettings({ symbol: 'btc-usdt', weights: { w1: .5, w2: .3, w3: .2 } }, version)
    expect(migrated.symbol).toBe('BTCUSDT')
    expect(migrated.confirmations).toBe(2)
    expect(migrated.paperTradingEnabled).toBe(false)
    expect(Object.values(migrated.weights!).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('rejects negative and non-finite weights', () => {
    expect(normalizeStrategyWeights({ w1: -1, w2: 1, w3: 0, w4: 0, w5: 0, w6: 0 }).w1).toBe(.30)
  })
})
