import type { Signal, SignalSide } from '../../types'

export type HorizonKey = '15s' | '30s' | '60s' | '300s' | '900s'
export const HORIZONS: Record<HorizonKey, number> = { '15s': 15_000, '30s': 30_000, '60s': 60_000, '300s': 300_000, '900s': 900_000 }
export interface Tracker {
  signalId: string; symbol?: string; strategyVersion?: string; side: SignalSide; entry: number; entryTs: number
  horizons: Record<HorizonKey, number | null>; mfe: number; mae: number; live: number; maxSeen: number; closed: boolean; lastPriceTs: number
}
export interface HorizonSummary { count: number; wins: number; winRate: number; average: number; median: number }
export interface TrackerStats {
  count: number; win15s: number; win60s: number; win300s: number; avg15s: number; avg60s: number; avg300s: number
  avgMfe: number; avgMae: number; samples15s: number; samples60s: number; samples300s: number
  horizons: Record<HorizonKey, HorizonSummary>
}

const calcPnl = (side: SignalSide, entry: number, current: number) => entry > 0 ? (side === 'BUY' ? current - entry : entry - current) / entry * 100 : 0
const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

type TrackerEvents = { add: Tracker; update: Tracker; horizon: { id: string; horizon: HorizonKey; pnl: number; elapsed: number }; close: Tracker }

export class SignalTracker {
  private trackers = new Map<string, Tracker>()
  private listeners = new Map<keyof TrackerEvents, Set<(payload: never) => void>>()
  constructor(private readonly maxRetention = 1000) {}

  on<K extends keyof TrackerEvents>(event: K, fn: (data: TrackerEvents[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set(); set.add(fn as (payload: never) => void); this.listeners.set(event, set)
    return () => set.delete(fn as (payload: never) => void)
  }
  private emit<K extends keyof TrackerEvents>(event: K, data: TrackerEvents[K]): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn(data as never)
  }

  addSignal(signal: Signal): Tracker {
    const existing = this.trackers.get(signal.id)
    if (existing) return { ...existing, horizons: { ...existing.horizons } }
    const tracker: Tracker = {
      signalId: signal.id, symbol: signal.symbol, strategyVersion: signal.strategyVersion, side: signal.side,
      entry: signal.price, entryTs: signal.ts, horizons: { '15s': null, '30s': null, '60s': null, '300s': null, '900s': null },
      mfe: 0, mae: 0, live: 0, maxSeen: 0, closed: false, lastPriceTs: signal.ts
    }
    this.trackers.set(signal.id, tracker); this.prune(); this.emit('add', this.clone(tracker)); return this.clone(tracker)
  }

  updatePrice(price: number, ts: number, symbol?: string): void {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ts)) return
    for (const tracker of this.trackers.values()) {
      if (tracker.closed || (symbol && tracker.symbol && symbol !== tracker.symbol) || ts < tracker.lastPriceTs) continue
      tracker.lastPriceTs = ts
      const pnl = calcPnl(tracker.side, tracker.entry, price)
      tracker.live = pnl; tracker.mfe = Math.max(tracker.mfe, pnl); tracker.mae = Math.min(tracker.mae, pnl)
      const elapsed = ts - tracker.entryTs
      for (const [key, duration] of Object.entries(HORIZONS) as [HorizonKey, number][]) {
        if (tracker.horizons[key] === null && elapsed >= duration) {
          tracker.horizons[key] = pnl; tracker.maxSeen = Math.max(tracker.maxSeen, duration)
          this.emit('horizon', { id: tracker.signalId, horizon: key, pnl, elapsed })
        }
      }
      if (elapsed >= HORIZONS['900s']) { tracker.closed = true; this.emit('close', this.clone(tracker)) }
      this.emit('update', this.clone(tracker))
    }
  }

  private clone(tracker: Tracker): Tracker { return { ...tracker, horizons: { ...tracker.horizons } } }
  private prune(): void {
    if (this.trackers.size <= this.maxRetention) return
    const oldest = [...this.trackers.values()].sort((a, b) => a.entryTs - b.entryTs).slice(0, this.trackers.size - this.maxRetention)
    for (const tracker of oldest) this.trackers.delete(tracker.signalId)
  }
  get(id: string): Tracker | undefined { const value = this.trackers.get(id); return value ? this.clone(value) : undefined }
  getAll(): Tracker[] { return [...this.trackers.values()].sort((a, b) => b.entryTs - a.entryTs).map(value => this.clone(value)) }

  private summary(items: Tracker[], key: HorizonKey): HorizonSummary {
    const values = items.map(item => item.horizons[key]).filter((value): value is number => value !== null)
    const wins = values.filter(value => value > 0).length
    return { count: values.length, wins, winRate: values.length ? wins / values.length : 0,
      average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0, median: median(values) }
  }

  getStats(lastN = 50): TrackerStats {
    const items = this.getAll().slice(0, lastN)
    const horizons = Object.fromEntries((Object.keys(HORIZONS) as HorizonKey[]).map(key => [key, this.summary(items, key)])) as Record<HorizonKey, HorizonSummary>
    const eligibleMfe = items.filter(item => item.horizons['15s'] !== null)
    return {
      count: horizons['15s'].count, win15s: horizons['15s'].winRate, win60s: horizons['60s'].winRate,
      win300s: horizons['300s'].winRate, avg15s: horizons['15s'].average, avg60s: horizons['60s'].average,
      avg300s: horizons['300s'].average, avgMfe: eligibleMfe.length ? eligibleMfe.reduce((sum, item) => sum + item.mfe, 0) / eligibleMfe.length : 0,
      avgMae: eligibleMfe.length ? eligibleMfe.reduce((sum, item) => sum + item.mae, 0) / eligibleMfe.length : 0,
      samples15s: horizons['15s'].count, samples60s: horizons['60s'].count, samples300s: horizons['300s'].count, horizons
    }
  }
  clear(): void { this.trackers.clear() }
  size(): number { return this.trackers.size }
}
