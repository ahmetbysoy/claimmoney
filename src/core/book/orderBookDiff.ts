import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'
import { TypedEventBus } from '../../application/eventBus'

export interface BookLevel { price: number; qty: number; notional: number }
export interface OrderBook { symbol?: string; bids: BookLevel[]; asks: BookLevel[]; lastUpdateId: number; synced: boolean; ts: number }

export interface BookSnapshot { bids: [number, number][]; asks: [number, number][]; lastUpdateId: number; ts?: number }
export interface BookDelta { bids: [number, number][]; asks: [number, number][]; U: number; u: number; previousSeq?: number; ts?: number }
export type DeltaStatus = 'applied' | 'stale' | 'gap' | 'unsynced' | 'invalid'
export interface MicrostructureData {
  bestBid: number; bestAsk: number; spread: number; spreadBps: number; mid: number
  obi: number; microprice: number; microDev: number; bidSlope: number; askSlope: number
  depthBid: number; depthAsk: number; topBidQty: number; topAskQty: number; valid: boolean
}
export interface OrderBookConfig {
  maxLevels: number
  /** Full internal depth retained for future deltas. Must be >= maxLevels. */
  maxStoredLevels: number
  distanceDecayBps: number
}

const finiteLevel = ([price, qty]: [number, number]): boolean =>
  Number.isFinite(price) && price > 0 && Number.isFinite(qty) && qty >= 0

function slopeByDistance(levels: BookLevel[], mid: number): number {
  if (levels.length < 2 || !mid) return 0
  const xs = levels.map(level => Math.abs(level.price - mid) / mid * 10_000)
  const ys = levels.map(level => Math.log1p(level.notional))
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length
  let numerator = 0, denominator = 0
  for (let index = 0; index < xs.length; index += 1) {
    numerator += (xs[index] - xMean) * (ys[index] - yMean)
    denominator += (xs[index] - xMean) ** 2
  }
  return denominator ? numerator / denominator : 0
}
type BookEvents = { 'book:resync-required': { expected: number; received: number; previousSeq?: number } }

export class OrderBookDiff {
  private events = new TypedEventBus<BookEvents>()
  private bidMap = new Map<number, number>()
  private askMap = new Map<number, number>()
  private book: OrderBook = { symbol: '', bids: [], asks: [], lastUpdateId: 0, synced: false, ts: 0 }
  private config: OrderBookConfig

  constructor(config?: Partial<OrderBookConfig>, private readonly clock: Clock = systemClock) {
    this.config = { maxLevels: 200, maxStoredLevels: 1_000, distanceDecayBps: 30, ...config }
    this.config.maxStoredLevels = Math.max(this.config.maxLevels, this.config.maxStoredLevels)
  }

  applySnapshot(symbol: string, snapshot: BookSnapshot): MicrostructureData | null {
    this.bidMap.clear(); this.askMap.clear()
    this.applyLevels(this.bidMap, snapshot.bids)
    this.applyLevels(this.askMap, snapshot.asks)
    this.pruneStoredDepth()
    this.book = { symbol, bids: [], asks: [], lastUpdateId: snapshot.lastUpdateId, synced: true, ts: snapshot.ts ?? this.clock.now() }
    this.refreshVisibleBook()
    return this.getMicrostructure()
  }

  applyDelta(delta: BookDelta): DeltaStatus {
    if (!this.book.synced) return 'unsynced'
    if (delta.u <= this.book.lastUpdateId) return 'stale'
    if (![...delta.bids, ...delta.asks].every(finiteLevel)) return 'invalid'

    const hasExplicitPrevious = Number.isFinite(delta.previousSeq)
    const contiguous = hasExplicitPrevious
      ? delta.previousSeq === this.book.lastUpdateId
      : delta.U <= this.book.lastUpdateId + 1 && delta.u >= this.book.lastUpdateId + 1
    if (!contiguous) {
      const expected = this.book.lastUpdateId + 1
      this.markUnsynced()
      this.events.emit('book:resync-required', { expected, received: delta.U, previousSeq: delta.previousSeq })
      return 'gap'
    }

    this.applyLevels(this.bidMap, delta.bids)
    this.applyLevels(this.askMap, delta.asks)
    this.pruneStoredDepth()
    this.book.lastUpdateId = delta.u
    this.book.ts = delta.ts ?? this.clock.now()
    this.refreshVisibleBook()
    return 'applied'
  }

  private applyLevels(map: Map<number, number>, levels: [number, number][]): void {
    for (const [price, qty] of levels) {
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty < 0) continue
      if (qty === 0) map.delete(price)
      else map.set(price, qty)
    }
  }

  private pruneStoredDepth(): void {
    if (this.bidMap.size > this.config.maxStoredLevels) {
      const retained = [...this.bidMap.entries()].sort((a, b) => b[0] - a[0]).slice(0, this.config.maxStoredLevels)
      this.bidMap = new Map(retained)
    }
    if (this.askMap.size > this.config.maxStoredLevels) {
      const retained = [...this.askMap.entries()].sort((a, b) => a[0] - b[0]).slice(0, this.config.maxStoredLevels)
      this.askMap = new Map(retained)
    }
  }

  private refreshVisibleBook(): void {
    this.book.bids = this.sortedLevels(this.bidMap, 'desc')
    this.book.asks = this.sortedLevels(this.askMap, 'asc')
  }

  private sortedLevels(map: Map<number, number>, direction: 'asc' | 'desc'): BookLevel[] {
    return [...map.entries()]
      .sort((a, b) => direction === 'desc' ? b[0] - a[0] : a[0] - b[0])
      .slice(0, this.config.maxLevels)
      .map(([price, qty]) => ({ price, qty, notional: price * qty }))
  }

  getMicrostructure(): MicrostructureData | null {
    const bid = this.book.bids[0], ask = this.book.asks[0]
    if (!bid || !ask || bid.price <= 0 || ask.price <= bid.price || bid.qty <= 0 || ask.qty <= 0) return null
    const spread = ask.price - bid.price, mid = (bid.price + ask.price) / 2
    const levels = Math.min(20, this.book.bids.length, this.book.asks.length)
    let weightedBid = 0, weightedAsk = 0, depthBid = 0, depthAsk = 0
    for (const level of this.book.bids.slice(0, levels)) {
      const distanceBps = Math.abs(level.price - mid) / mid * 10_000
      const weight = Math.exp(-distanceBps / this.config.distanceDecayBps)
      weightedBid += level.notional * weight; depthBid += level.qty
    }
    for (const level of this.book.asks.slice(0, levels)) {
      const distanceBps = Math.abs(level.price - mid) / mid * 10_000
      const weight = Math.exp(-distanceBps / this.config.distanceDecayBps)
      weightedAsk += level.notional * weight; depthAsk += level.qty
    }
    const microprice = (ask.price * bid.qty + bid.price * ask.qty) / (bid.qty + ask.qty)
    return {
      bestBid: bid.price, bestAsk: ask.price, spread, spreadBps: mid ? spread / mid * 10_000 : 0, mid,
      obi: (weightedBid - weightedAsk) / (weightedBid + weightedAsk || 1), microprice,
      microDev: spread > 0 ? (microprice - mid) / (spread / 2) : 0,
      bidSlope: slopeByDistance(this.book.bids.slice(0, levels), mid),
      askSlope: slopeByDistance(this.book.asks.slice(0, levels), mid),
      depthBid, depthAsk, topBidQty: bid.qty, topAskQty: ask.qty, valid: this.book.synced
    }
  }

  on(event: 'book:resync-required', listener: (payload: BookEvents['book:resync-required']) => void): () => void {
    return this.events.on(event, listener)
  }
  getBook(): OrderBook {
    return { ...this.book, bids: this.book.bids.map(level => ({ ...level })), asks: this.book.asks.map(level => ({ ...level })) }
  }
  isSynced(): boolean { return this.book.synced }
  getLastUpdateId(): number { return this.book.lastUpdateId }
  markUnsynced(): void { this.book.synced = false }
  reset(): void {
    this.bidMap.clear(); this.askMap.clear()
    this.book = { symbol: '', bids: [], asks: [], lastUpdateId: 0, synced: false, ts: 0 }
  }
}
