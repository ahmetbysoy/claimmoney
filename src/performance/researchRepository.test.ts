import { beforeEach, describe, expect, it } from 'vitest'
import { LocalResearchRepository, type ResearchObservation } from './researchRepository'

const observation = (overrides: Partial<ResearchObservation> = {}): ResearchObservation => ({
  version: 1, id: 's1:a', sessionId: 's1', signalId: 'a', symbol: 'BTCUSDT', strategyVersion: 'claimmoney-v2',
  side: 'BUY', score: 1, confidence: 70, entry: 50_000, entryTs: 1_000,
  regime: 'trend', regimeConfidence: 0.8, dataQuality: 'good', detectorTypes: ['BOOK_SKEW'],
  volatilityBps: 5, vpin: 0.4, spreadBps: 1, isTest: false,
  horizons: { '15s': 0.1, '30s': null, '60s': null, '300s': null, '900s': null },
  mfe: 0.2, mae: -0.05, closed: false, updatedAt: 2_000,
  ...overrides
})

describe('LocalResearchRepository', () => {
  beforeEach(() => localStorage.clear())

  it('upserts a signal as its horizons mature without duplicating it', () => {
    const repository = new LocalResearchRepository('research-test')
    repository.upsert([observation()])
    repository.upsert([observation({ horizons: { '15s': 0.1, '30s': 0.15, '60s': 0.2, '300s': null, '900s': null }, updatedAt: 62_000 })])
    expect(repository.size()).toBe(1)
    expect(repository.list()[0].horizons['60s']).toBe(0.2)
  })

  it('enforces bounded retention using the newest observations', () => {
    const repository = new LocalResearchRepository('research-test', 2)
    repository.upsert([observation(), observation({ id: 's1:b', signalId: 'b', entryTs: 2_000 }), observation({ id: 's1:c', signalId: 'c', entryTs: 3_000 })])
    expect(repository.list().map(item => item.signalId)).toEqual(['b', 'c'])
  })

  it('imports a versioned dataset backup', () => {
    const repository = new LocalResearchRepository('research-test')
    repository.import({ version: 1, observations: [observation()] })
    expect(repository.size()).toBe(1)
    expect(() => repository.import({ version: 2, observations: [] })).toThrow('Unsupported research dataset')
  })
})
