import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'
import type { InstrumentSpec } from '../../domain/instrument'
import { DEFAULT_INSTRUMENT, roundToStep } from '../../domain/instrument'
import type { Side } from '../../types'

export type FlowMode = 'time' | 'volume'
export interface FlowBucket {
  startTs: number; openPrice: number; high: number; low: number; closePrice: number
  buy: number; sell: number; activity: number; liquidations: number; absorption: boolean
  pressureOpen: number; pressureHigh: number; pressureLow: number; pressureClose: number
  volumeAtPrice: Map<string, { price: number; buyVol: number; sellVol: number }>
}
export interface VolumeAtPrice { price: number; buyVol: number; sellVol: number; delta: number; total: number; buyNotional: number; sellNotional: number }
export interface FlowCandle {
  ts: number; pressureOpen: number; pressureHigh: number; pressureLow: number; pressureClose: number
  buy: number; sell: number; delta: number; activity: number; strength: number
  priceOpen: number; priceHigh: number; priceLow: number; priceClose: number
  liquidations: number; absorption: boolean; volumeProfile: VolumeAtPrice[]; pocPrice: number; absorptionLevels: VolumeAtPrice[]
}
export interface FlowEngineConfig { mode: FlowMode; timeframeMs: number; volumeTarget: number; maxCandles: number; absorptionMoveBps: number; absorptionActivityMultiple: number }
export interface FlowTrade { price: number; notional: number; side: Side; ts: number }

type FlowEvents = { 'flow:update': FlowCandle }
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export class FlowEngine {
  private candles: FlowCandle[] = []
  private bucket: FlowBucket | null = null
  private listeners = new Set<(candle: FlowCandle) => void>()
  private config: FlowEngineConfig

  constructor(config?: Partial<FlowEngineConfig>, private readonly clock: Clock = systemClock, private instrument: InstrumentSpec = DEFAULT_INSTRUMENT) {
    this.config = { mode: 'time', timeframeMs: 5000, volumeTarget: 1_000_000, maxCandles: 80, absorptionMoveBps: 8, absorptionActivityMultiple: 2, ...config }
  }

  on<K extends keyof FlowEvents>(event: K, fn: (data: FlowEvents[K]) => void): () => void {
    if (event !== 'flow:update') return () => undefined
    this.listeners.add(fn as (candle: FlowCandle) => void)
    return () => this.listeners.delete(fn as (candle: FlowCandle) => void)
  }
  private emit(candle: FlowCandle): void { for (const fn of [...this.listeners]) fn(candle) }

  private alignedStart(ts: number): number {
    return this.config.mode === 'time' ? Math.floor(ts / this.config.timeframeMs) * this.config.timeframeMs : ts
  }

  private startBucket(trade: FlowTrade): void {
    const previousPressure = this.candles.at(-1)?.pressureClose ?? 0
    this.bucket = {
      startTs: this.alignedStart(trade.ts), openPrice: trade.price, high: trade.price, low: trade.price, closePrice: trade.price,
      buy: 0, sell: 0, activity: 0, liquidations: 0, absorption: false,
      pressureOpen: previousPressure, pressureHigh: previousPressure, pressureLow: previousPressure, pressureClose: previousPressure,
      volumeAtPrice: new Map()
    }
  }

  private addTrade(trade: FlowTrade, notional = trade.notional): void {
    const bucket = this.bucket
    if (!bucket || notional <= 0) return
    if (trade.side === 'buy') bucket.buy += notional
    else bucket.sell += notional
    bucket.activity += notional
    bucket.high = Math.max(bucket.high, trade.price)
    bucket.low = Math.min(bucket.low, trade.price)
    bucket.closePrice = trade.price
    const pressure = clamp((bucket.buy - bucket.sell) / (bucket.activity || 1) * 100, -100, 100)
    bucket.pressureClose = pressure
    bucket.pressureHigh = Math.max(bucket.pressureHigh, pressure)
    bucket.pressureLow = Math.min(bucket.pressureLow, pressure)
    const price = roundToStep(trade.price, this.instrument.tickSize)
    const key = price.toFixed(12)
    const current = bucket.volumeAtPrice.get(key) ?? { price, buyVol: 0, sellVol: 0 }
    if (trade.side === 'buy') current.buyVol += notional
    else current.sellVol += notional
    bucket.volumeAtPrice.set(key, current)
  }

  updateBucket(trade: FlowTrade): void {
    if (!Number.isFinite(trade.price) || trade.price <= 0 || !Number.isFinite(trade.notional) || trade.notional <= 0) return
    if (this.bucket && trade.ts < this.bucket.startTs) return

    if (this.config.mode === 'time') {
      if (this.bucket && trade.ts >= this.bucket.startTs + this.config.timeframeMs) this.closeBucket()
      if (!this.bucket) this.startBucket(trade)
      this.addTrade(trade)
      return
    }

    let remaining = trade.notional
    while (remaining > 0) {
      if (!this.bucket) this.startBucket(trade)
      const room = Math.max(0, this.config.volumeTarget - (this.bucket?.activity ?? 0))
      if (room === 0) { this.closeBucket(); continue }
      const allocation = Math.min(room, remaining)
      this.addTrade(trade, allocation)
      remaining -= allocation
      if ((this.bucket?.activity ?? 0) >= this.config.volumeTarget) this.closeBucket()
    }
  }

  tick(lastPrice: number, recentLiquidationCount = 0, at = this.clock.now()): void {
    if (!this.bucket) return
    if (Number.isFinite(lastPrice) && lastPrice > 0) this.bucket.closePrice = lastPrice
    this.bucket.liquidations = recentLiquidationCount
    if (this.config.mode === 'time' && at >= this.bucket.startTs + this.config.timeframeMs) this.closeBucket()
    if (this.config.mode === 'volume' && this.bucket.activity >= this.config.volumeTarget) this.closeBucket()
  }

  private closeBucket(): FlowCandle | null {
    if (!this.bucket || this.bucket.activity <= 0) { this.bucket = null; return null }
    const bucket = this.bucket
    const delta = bucket.buy - bucket.sell
    const pressure = clamp(delta / bucket.activity * 100, -100, 100)
    const strength = Math.abs(pressure)
    const priceMoveBps = Math.abs(bucket.closePrice - bucket.openPrice) / (bucket.openPrice || 1) * 10_000
    const history = this.candles.slice(-10)
    const avgActivity = history.length ? history.reduce((sum, candle) => sum + candle.activity, 0) / history.length : bucket.activity
    const absorption = history.length >= 3 && priceMoveBps < this.config.absorptionMoveBps && bucket.activity > avgActivity * this.config.absorptionActivityMultiple

    const volumeProfile: VolumeAtPrice[] = [...bucket.volumeAtPrice.values()].map(value => ({
      price: value.price, buyVol: value.buyVol, sellVol: value.sellVol,
      delta: value.buyVol - value.sellVol, total: value.buyVol + value.sellVol,
      buyNotional: value.buyVol, sellNotional: value.sellVol
    })).sort((a, b) => b.price - a.price)
    const poc = volumeProfile.reduce((best, current) => current.total > best.total ? current : best, volumeProfile[0] ?? { price: bucket.openPrice, total: 0 } as VolumeAtPrice)
    const levelThreshold = Math.max(avgActivity * 0.03, bucket.activity * 0.01)
    const absorptionLevels = volumeProfile.filter(level => {
      const small = Math.min(level.buyVol, level.sellVol)
      const large = Math.max(level.buyVol, level.sellVol)
      const ratio = small > 0 ? large / small : large > 0 ? Infinity : 0
      return ratio >= 3 && level.total >= levelThreshold
    })

    const candle: FlowCandle = {
      ts: bucket.startTs, pressureOpen: bucket.pressureOpen, pressureHigh: bucket.pressureHigh,
      pressureLow: bucket.pressureLow, pressureClose: pressure, buy: bucket.buy, sell: bucket.sell,
      delta, activity: bucket.activity, strength, priceOpen: bucket.openPrice, priceHigh: bucket.high,
      priceLow: bucket.low, priceClose: bucket.closePrice, liquidations: bucket.liquidations,
      absorption, volumeProfile, pocPrice: poc.price, absorptionLevels
    }
    this.candles.push(candle)
    if (this.candles.length > this.config.maxCandles) this.candles.splice(0, this.candles.length - this.config.maxCandles)
    this.bucket = null
    this.emit(candle)
    return candle
  }

  getCandles(): FlowCandle[] { return this.candles.map(candle => ({ ...candle, volumeProfile: candle.volumeProfile.map(x => ({ ...x })), absorptionLevels: candle.absorptionLevels.map(x => ({ ...x })) })) }
  getLastCandle(): FlowCandle | null { const candle = this.candles.at(-1); return candle ? { ...candle } : null }
  getActiveBucket(): Readonly<FlowBucket> | null { return this.bucket }
  updateConfig(cfg: Partial<FlowEngineConfig>): void {
    if ((cfg.mode && cfg.mode !== this.config.mode) || (cfg.timeframeMs && cfg.timeframeMs !== this.config.timeframeMs)) this.closeBucket()
    this.config = { ...this.config, ...cfg }
  }
  setInstrument(instrument: InstrumentSpec): void { this.instrument = instrument }
  reset(): void { this.candles = []; this.bucket = null }
}
