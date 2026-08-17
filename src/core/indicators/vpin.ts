import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'
import { TypedEventBus } from '../../application/eventBus'
import type { Side } from '../../types'

export type VpinLabel = 'Warming' | 'Low' | 'Medium' | 'Toxic'
export interface VPINState {
  value: number; label: VpinLabel; buckets: number[]; currentBuy: number; currentSell: number
  currentNotional: number; bucketSize: number; valid: boolean; warmup: number; lastUpdateTs: number
}
export interface VPINConfig {
  maxBuckets: number; tradeLookback: number; minBucketNotional: number; bucketTimeoutMs: number
  minWarmupBuckets: number; rollingBucketFraction: number
}

type VpinEvents = { 'vpin:update': VPINState }
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

export class VPIN {
  private state: VPINState
  private config: VPINConfig
  private lastBucketTs = 0
  private events = new TypedEventBus<VpinEvents>()

  constructor(config?: Partial<VPINConfig>, private readonly clock: Clock = systemClock) {
    this.config = {
      maxBuckets: 50, tradeLookback: 200, minBucketNotional: 100_000, bucketTimeoutMs: 60_000,
      minWarmupBuckets: 10, rollingBucketFraction: 0.02, ...config
    }
    this.state = this.initialState()
  }

  private initialState(): VPINState {
    return { value: 0, label: 'Warming', buckets: [], currentBuy: 0, currentSell: 0, currentNotional: 0,
      bucketSize: this.config.minBucketNotional, valid: false, warmup: 0, lastUpdateTs: 0 }
  }

  on(event: 'vpin:update', fn: (state: VPINState) => void): () => void { return this.events.on(event, fn) }
  private emit(): void { this.events.emit('vpin:update', this.getState()) }

  private closeBucket(ts: number): void {
    const total = this.state.currentBuy + this.state.currentSell
    if (total > 0) this.state.buckets.push(Math.abs(this.state.currentBuy - this.state.currentSell) / total)
    if (this.state.buckets.length > this.config.maxBuckets) this.state.buckets.splice(0, this.state.buckets.length - this.config.maxBuckets)
    this.state.currentBuy = 0; this.state.currentSell = 0; this.state.currentNotional = 0; this.lastBucketTs = ts
  }

  private recompute(ts: number): void {
    this.state.value = mean(this.state.buckets)
    this.state.warmup = Math.min(1, this.state.buckets.length / this.config.minWarmupBuckets)
    this.state.valid = this.state.buckets.length >= this.config.minWarmupBuckets
    this.state.label = !this.state.valid ? 'Warming' : this.state.value < 0.3 ? 'Low' : this.state.value < 0.7 ? 'Medium' : 'Toxic'
    this.state.lastUpdateTs = ts
  }

  update(
    trade: { price: number; qty: number; side: Side; notional: number; ts?: number },
    allTrades: { notional: number }[] = []
  ): VPINState {
    const ts = trade.ts ?? this.clock.now()
    if (!Number.isFinite(trade.notional) || trade.notional <= 0) return this.getState()
    const rollingVolume = allTrades.slice(-this.config.tradeLookback).reduce((sum, item) => sum + Math.max(0, item.notional), 0) + trade.notional
    this.state.bucketSize = Math.max(this.config.minBucketNotional, rollingVolume * this.config.rollingBucketFraction)
    if (!this.lastBucketTs) this.lastBucketTs = ts
    if (this.state.currentNotional > 0 && ts - this.lastBucketTs >= this.config.bucketTimeoutMs) this.closeBucket(ts)

    let remaining = trade.notional
    while (remaining > 0) {
      const room = Math.max(0, this.state.bucketSize - this.state.currentNotional)
      if (room === 0) { this.closeBucket(ts); continue }
      const amount = Math.min(room, remaining)
      if (trade.side === 'buy') this.state.currentBuy += amount
      else this.state.currentSell += amount
      this.state.currentNotional += amount
      remaining -= amount
      if (this.state.currentNotional >= this.state.bucketSize - 1e-9) this.closeBucket(ts)
    }
    this.recompute(ts)
    this.emit()
    return this.getState()
  }

  getState(): VPINState { return { ...this.state, buckets: [...this.state.buckets] } }
  getValue(): number { return this.state.value }
  getLabel(): VpinLabel { return this.state.label }
  reset(): void { this.lastBucketTs = 0; this.state = this.initialState() }
}
