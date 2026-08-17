import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'

export interface BookLevel { price: number; qty: number; notional: number }
export interface OrderBook { bids: BookLevel[]; asks: BookLevel[]; ts: number; lastUpdateId: number; symbol?: string; synced: boolean }
export interface MicrostructureData {
  bestBid: number; bestAsk: number; spread: number; spreadBps: number; mid: number
  obi: number; microprice: number; microDev: number; bidSlope: number; askSlope: number
  depthBid: number; depthAsk: number; valid: boolean
}
export interface BookSnapshot { bids: [number, number][]; asks: [number, number][]; lastUpdateId: number; ts?: number }
export interface BookDiff { bids: [number, number][]; asks: [number, number][]; U?: number; u?: number; eventTime?: number }
export interface HeatFrame { ts: number; bids: BookLevel[]; asks: BookLevel[] }
export interface OrderBookDiffConfig { maxLevels: number; heatmapWindowSec: number; heatSampleMs: number; distanceDecayBps: number }
export type DiffApplyResult = 'applied' | 'stale' | 'gap' | 'invalid'

type BookEvents = {
  'book:update': OrderBook
  'micro:update': MicrostructureData
  'book:resync-required': { expected: number; first: number; last: number }
}

const finiteLevel = ([p, q]: [number, number]) => Number.isFinite(p) && p > 0 && Number.isFinite(q) && q >= 0

function slopeByDistance(levels: BookLevel[], mid: number): number {
  if (levels.length < 2 || !mid) return 0
  const xs = levels.map(level => Math.abs(level.price - mid) / mid * 10_000)
  const ys = levels.map(level => Math.log1p(level.notional))
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < xs.length; i++) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean)
    denominator += (xs[i] - xMean) ** 2
  }
  return denominator ? numerator / denominator : 0
}

export class OrderBookDiff {
  private book: OrderBook = { bids: [], asks: [], ts: 0, lastUpdateId: 0, synced: false }
  private bidMap = new Map<string, BookLevel>()
  private askMap = new Map<string, BookLevel>()
  private heatHistory: HeatFrame[] = []
  private config: OrderBookDiffConfig
  private listeners = new Map<keyof BookEvents, Set<(payload: never) => void>>()
  private lastHeatTs = 0

  constructor(config?: Partial<OrderBookDiffConfig>, private readonly clock: Clock = systemClock) {
    this.config = { maxLevels: 200, heatmapWindowSec: 30, heatSampleMs: 100, distanceDecayBps: 30, ...config }
  }

  on<K extends keyof BookEvents>(event: K, fn: (data: BookEvents[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set()
    set.add(fn as (payload: never) => void)
    this.listeners.set(event, set)
    return () => set.delete(fn as (payload: never) => void)
  }

  private emit<K extends keyof BookEvents>(event: K, data: BookEvents[K]): void {
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn(data as never)
  }

  private key(price: number): string { return price.toString() }

  private createLevel(price: number, qty: number): BookLevel {
    return { price, qty, notional: price * qty }
  }

  private rebuildArrays(): void {
    this.book.bids = [...this.bidMap.values()].sort((a, b) => b.price - a.price).slice(0, this.config.maxLevels)
    this.book.asks = [...this.askMap.values()].sort((a, b) => a.price - b.price).slice(0, this.config.maxLevels)
    this.bidMap = new Map(this.book.bids.map(level => [this.key(level.price), level]))
    this.askMap = new Map(this.book.asks.map(level => [this.key(level.price), level]))
  }

  applySnapshot(symbol: string, snapshot: BookSnapshot): void {
    this.bidMap.clear()
    this.askMap.clear()
    for (const level of snapshot.bids ?? []) if (finiteLevel(level) && level[1] > 0) this.bidMap.set(this.key(level[0]), this.createLevel(level[0], level[1]))
    for (const level of snapshot.asks ?? []) if (finiteLevel(level) && level[1] > 0) this.askMap.set(this.key(level[0]), this.createLevel(level[0], level[1]))
    this.book = {
      bids: [], asks: [], symbol, ts: snapshot.ts ?? this.clock.now(),
      lastUpdateId: snapshot.lastUpdateId ?? 0, synced: true
    }
    this.rebuildArrays()
    const micro = this.recompute()
    this.emit('book:update', this.getBook())
    if (micro) this.emit('micro:update', micro)
  }

  applyDelta(diff: BookDiff): DiffApplyResult {
    if (!this.book.synced) return 'gap'
    const first = diff.U
    const last = diff.u
    if (last !== undefined && last <= this.book.lastUpdateId) return 'stale'
    if (first !== undefined && last !== undefined && this.book.lastUpdateId > 0) {
      const expected = this.book.lastUpdateId + 1
      if (!(first <= expected && expected <= last)) {
        this.book.synced = false
        this.emit('book:resync-required', { expected, first, last })
        return 'gap'
      }
    }
    if (![...(diff.bids ?? []), ...(diff.asks ?? [])].every(finiteLevel)) return 'invalid'

    const applySide = (levels: [number, number][], map: Map<string, BookLevel>) => {
      for (const [price, qty] of levels) {
        const key = this.key(price)
        if (qty === 0) map.delete(key)
        else map.set(key, this.createLevel(price, qty))
      }
    }
    applySide(diff.bids ?? [], this.bidMap)
    applySide(diff.asks ?? [], this.askMap)
    this.rebuildArrays()
    this.book.lastUpdateId = last ?? this.book.lastUpdateId
    this.book.ts = diff.eventTime ?? this.clock.now()
    const micro = this.recompute()
    this.emit('book:update', this.getBook())
    if (micro) this.emit('micro:update', micro)
    return 'applied'
  }

  /** Backwards-compatible boolean API. Prefer applyDelta. */
  applyDiff(diff: BookDiff): boolean { return this.applyDelta(diff) === 'applied' }

  /** Replace a top-N snapshot, used by Binance partial-book streams and normalized OKX books. */
  replaceTop(symbol: string, bids: [number, number][], asks: [number, number][], ts: number, seq = 0): MicrostructureData | null {
    this.applySnapshot(symbol, { bids, asks, lastUpdateId: seq, ts })
    return this.computeMicrostructure()
  }

  private computeMicrostructure(): MicrostructureData | null {
    const bid = this.book.bids[0]
    const ask = this.book.asks[0]
    if (!bid || !ask || bid.price > ask.price || bid.qty <= 0 || ask.qty <= 0) return null
    const spread = ask.price - bid.price
    const mid = (ask.price + bid.price) / 2
    const levels = Math.min(20, this.book.bids.length, this.book.asks.length)
    let weightedBid = 0, weightedAsk = 0, depthBid = 0, depthAsk = 0
    for (const level of this.book.bids.slice(0, levels)) {
      const distanceBps = Math.abs(level.price - mid) / mid * 10_000
      const weight = Math.exp(-distanceBps / this.config.distanceDecayBps)
      weightedBid += level.notional * weight
      depthBid += level.qty
    }
    for (const level of this.book.asks.slice(0, levels)) {
      const distanceBps = Math.abs(level.price - mid) / mid * 10_000
      const weight = Math.exp(-distanceBps / this.config.distanceDecayBps)
      weightedAsk += level.notional * weight
      depthAsk += level.qty
    }
    const microprice = (ask.price * bid.qty + bid.price * ask.qty) / (bid.qty + ask.qty)
    const microDev = spread > 0 ? (microprice - mid) / (spread / 2) : 0
    return {
      bestBid: bid.price, bestAsk: ask.price, spread, spreadBps: mid ? spread / mid * 10_000 : 0, mid,
      obi: (weightedBid - weightedAsk) / (weightedBid + weightedAsk || 1), microprice, microDev,
      bidSlope: slopeByDistance(this.book.bids.slice(0, levels), mid),
      askSlope: slopeByDistance(this.book.asks.slice(0, levels), mid),
      depthBid, depthAsk, valid: true
    }
  }

  recompute(): MicrostructureData | null {
    const micro = this.computeMicrostructure()
    const now = this.clock.now()
    if (micro && now - this.lastHeatTs >= this.config.heatSampleMs) {
      this.lastHeatTs = now
      this.heatHistory.push({ ts: now, bids: this.book.bids.slice(0, 20).map(x => ({ ...x })), asks: this.book.asks.slice(0, 20).map(x => ({ ...x })) })
      const cutoff = now - this.config.heatmapWindowSec * 1000
      this.heatHistory = this.heatHistory.filter(frame => frame.ts >= cutoff)
    }
    return micro
  }

  getMicrostructure(): MicrostructureData | null { return this.computeMicrostructure() }
  isStale(thresholdMs: number): boolean { return !this.book.ts || this.clock.now() - this.book.ts > thresholdMs }
  isSynced(): boolean { return this.book.synced }
  getBook(): OrderBook { return { ...this.book, bids: this.book.bids.map(x => ({ ...x })), asks: this.book.asks.map(x => ({ ...x })) } }
  getHeatHistory(): HeatFrame[] { return this.heatHistory.map(frame => ({ ...frame, bids: frame.bids.map(x => ({ ...x })), asks: frame.asks.map(x => ({ ...x })) })) }
  reset(): void {
    this.bidMap.clear(); this.askMap.clear(); this.heatHistory = []; this.lastHeatTs = 0
    this.book = { bids: [], asks: [], ts: 0, lastUpdateId: 0, synced: false }
  }
}
