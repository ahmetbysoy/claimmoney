import type { DataQuality, SignalSide } from '../types'
import type { HorizonKey, Tracker } from '../core/performance/signalTracker'

export interface ResearchObservation {
  version: 1
  id: string
  sessionId: string
  signalId: string
  symbol: string
  strategyVersion: string
  side: SignalSide
  score: number
  confidence: number
  entry: number
  entryTs: number
  regime: string
  regimeConfidence: number
  dataQuality: DataQuality
  detectorTypes: string[]
  volatilityBps: number
  vpin: number
  spreadBps: number
  isTest: boolean
  horizons: Tracker['horizons']
  mfe: number
  mae: number
  closed: boolean
  updatedAt: number
}

export interface ResearchSaveResult { saved: number; dropped: number; persisted: boolean }

function validObservation(value: unknown): value is ResearchObservation {
  const item = value as Partial<ResearchObservation>
  return item?.version === 1 && typeof item.id === 'string' && typeof item.signalId === 'string' &&
    Number.isFinite(item.entryTs) && Number.isFinite(item.score) && typeof item.horizons === 'object'
}

export class LocalResearchRepository {
  constructor(private readonly key = 'claimmoney-research-v1', private readonly maxObservations = 5_000) {}

  list(): ResearchObservation[] {
    if (typeof localStorage === 'undefined') return []
    try {
      const parsed = JSON.parse(localStorage.getItem(this.key) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter(validObservation).sort((a, b) => a.entryTs - b.entryTs) : []
    } catch { return [] }
  }

  upsert(incoming: ResearchObservation[]): ResearchSaveResult {
    if (typeof localStorage === 'undefined' || !incoming.length) return { saved: 0, dropped: 0, persisted: true }
    const byId = new Map(this.list().map(item => [item.id, item]))
    for (const item of incoming) {
      if (!validObservation(item)) continue
      const previous = byId.get(item.id)
      byId.set(item.id, previous ? {
        ...previous, ...structuredClone(item),
        horizons: { ...previous.horizons, ...item.horizons },
        detectorTypes: [...new Set([...(previous.detectorTypes ?? []), ...(item.detectorTypes ?? [])])]
      } : structuredClone(item))
    }
    const all = [...byId.values()].sort((a, b) => a.entryTs - b.entryTs)
    let candidate = all.slice(-this.maxObservations)
    const capacityDropped = Math.max(0, all.length - candidate.length)
    while (candidate.length) {
      try {
        localStorage.setItem(this.key, JSON.stringify(candidate))
        return { saved: incoming.length, dropped: capacityDropped + (all.slice(-this.maxObservations).length - candidate.length), persisted: true }
      } catch {
        candidate = candidate.slice(Math.max(1, Math.ceil(candidate.length * 0.1)))
      }
    }
    return { saved: 0, dropped: all.length, persisted: false }
  }

  import(payload: unknown): ResearchSaveResult {
    const parsed = payload as { version?: number; observations?: unknown[] }
    if (parsed?.version !== 1 || !Array.isArray(parsed.observations)) throw new Error('Unsupported research dataset')
    return this.upsert(parsed.observations.filter(validObservation))
  }

  clear(): void { if (typeof localStorage !== 'undefined') localStorage.removeItem(this.key) }
  size(): number { return this.list().length }
  export(): { version: 1; exportedAt: number; observations: ResearchObservation[] } {
    return { version: 1, exportedAt: Date.now(), observations: this.list() }
  }
}

export const RESEARCH_HORIZONS: HorizonKey[] = ['15s', '30s', '60s', '300s', '900s']
