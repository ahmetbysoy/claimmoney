import { beforeEach, describe, expect, it } from 'vitest'
import { LocalSessionRepository, type SessionSnapshot } from './persistence'

const snapshot = (sessionId: string, endedAt: number): SessionSnapshot => ({
  version: 1, sessionId, symbol: 'BTCUSDT', strategyVersion: 'claimmoney-v2', startedAt: 1, endedAt, payload: { endedAt }
})

describe('LocalSessionRepository checkpoints', () => {
  beforeEach(() => localStorage.clear())

  it('replaces an active session checkpoint instead of duplicating it', () => {
    const repository = new LocalSessionRepository('sessions-test', 3)
    expect(repository.saveSync(snapshot('a', 10))).toBe(true)
    expect(repository.saveSync(snapshot('a', 20))).toBe(true)
    expect(repository.listSync()).toHaveLength(1)
    expect(repository.listSync()[0].endedAt).toBe(20)
  })

  it('retains only the configured number of newest sessions', () => {
    const repository = new LocalSessionRepository('sessions-test', 2)
    repository.saveSync(snapshot('a', 10)); repository.saveSync(snapshot('b', 20)); repository.saveSync(snapshot('c', 30))
    expect(repository.listSync().map(item => item.sessionId)).toEqual(['c', 'b'])
  })
})
