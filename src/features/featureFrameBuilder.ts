import { RingBuffer } from '../core/buffers/ringBuffer'
import type { MicrostructureData } from '../core/book/orderBookDiff'
import type { VPINState } from '../core/indicators/vpin'
import type { DataQuality, FeatureFrame, FeatureValue, NormalizedTrade, Source } from '../types'

interface TimedValue { ts: number; value: number }
interface PricePoint { ts: number; price: number; priceStr?: string }
export interface FeatureFrameInput {
  at: number; receiveTs?: number; symbol: string; exchange: Source; price: number; priceStr?: string
  micro: MicrostructureData | null; bookSynced: boolean; bookAgeMs: number; tradeAgeMs: number
  vpin: VPINState; detectorBull: number; detectorBear: number
}

const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}
const robustZ = (history: TimedValue[], current: number, period: number) => {
  const baseline = history.slice(-period - 1, -1).map(item => item.value)
  if (baseline.length < 5) return { value: 0, valid: false, warmup: baseline.length / 5 }
  const sorted = [...baseline].sort((a, b) => a - b)
  const lower = sorted[Math.floor(sorted.length * 0.05)] ?? sorted[0]
  const upper = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? sorted.at(-1)!
  const clipped = baseline.map(value => Math.max(lower, Math.min(upper, value)))
  const deviation = standardDeviation(clipped)
  return { value: deviation > 1e-9 ? (current - mean(clipped)) / deviation : 0, valid: deviation > 1e-9, warmup: Math.min(1, baseline.length / period) }
}
const feature = (value: number, valid: boolean, warmup: number, ageMs: number, evidence?: Record<string, number>): FeatureValue => ({
  value: Number.isFinite(value) ? value : 0, valid: valid && Number.isFinite(value), warmup: Math.max(0, Math.min(1, warmup)), ageMs: Math.max(0, ageMs), evidence
})

export class FeatureFrameBuilder {
  private trades = new RingBuffer<NormalizedTrade>(5000)
  private prices: PricePoint[] = []
  private cvdHistory: TimedValue[] = []
  private velocityHistory: TimedValue[] = []
  private returns: TimedValue[] = []
  private lastSampleAt = 0
  private sampleMs: number

  constructor(sampleMs = 100) { this.sampleMs = sampleMs }
  addTrade(trade: NormalizedTrade): void { this.trades.push(trade) }

  private prune(at: number): void {
    const priceCutoff = at - 5 * 60_000
    this.prices = this.prices.filter(item => item.ts >= priceCutoff).slice(-3000)
    this.cvdHistory = this.cvdHistory.filter(item => item.ts >= priceCutoff).slice(-3000)
    this.velocityHistory = this.velocityHistory.filter(item => item.ts >= priceCutoff).slice(-3000)
    this.returns = this.returns.filter(item => item.ts >= priceCutoff).slice(-3000)
  }

  private samplePrice(price: number, priceStr: string | undefined, at: number): number {
    if (!Number.isFinite(price) || price <= 0) return 0
    const previous = this.prices.at(-1)
    let velocityBps = this.velocityHistory.at(-1)?.value ?? 0
    if (previous && at > previous.ts) {
      const dt = (at - previous.ts) / 1000
      const logReturnBps = Math.log(price / previous.price) * 10_000
      velocityBps = 0.3 * (logReturnBps / dt) + 0.7 * velocityBps
      this.returns.push({ ts: at, value: logReturnBps })
    }
    this.prices.push({ price, priceStr, ts: at })
    this.velocityHistory.push({ ts: at, value: velocityBps })
    return velocityBps
  }

  private cvdNorm(at: number): number {
    const cutoff = at - 60_000
    let signed = 0, total = 0
    for (const trade of this.trades.toArray()) {
      if (trade.ts < cutoff || trade.ts > at) continue
      const notional = trade.notional ?? trade.price * trade.qty
      signed += trade.side === 'buy' ? notional : -notional
      total += notional
    }
    return total > 0 ? signed / total : 0
  }

  private divergence(at: number): { value: number; valid: boolean } {
    const prices = this.prices.filter(item => item.ts >= at - 30_000)
    const cvd = this.cvdHistory.filter(item => item.ts >= at - 30_000)
    if (prices.length < 20 || cvd.length < 20) return { value: 0, valid: false }
    const halfP = Math.floor(prices.length / 2), halfC = Math.floor(cvd.length / 2)
    const p1 = prices.slice(0, halfP), p2 = prices.slice(halfP), c1 = cvd.slice(0, halfC), c2 = cvd.slice(halfC)
    const pHigh1 = Math.max(...p1.map(x => x.price)), pHigh2 = Math.max(...p2.map(x => x.price))
    const pLow1 = Math.min(...p1.map(x => x.price)), pLow2 = Math.min(...p2.map(x => x.price))
    const cHigh1 = Math.max(...c1.map(x => x.value)), cHigh2 = Math.max(...c2.map(x => x.value))
    const cLow1 = Math.min(...c1.map(x => x.value)), cLow2 = Math.min(...c2.map(x => x.value))
    if (pHigh2 > pHigh1 && cHigh2 < cHigh1) return { value: -0.25, valid: true }
    if (pLow2 < pLow1 && cLow2 > cLow1) return { value: 0.25, valid: true }
    return { value: 0, valid: true }
  }

  build(input: FeatureFrameInput): FeatureFrame | null {
    const at = input.at
    if (this.lastSampleAt && at - this.lastSampleAt < this.sampleMs) return null
    this.lastSampleAt = at
    const velocity = this.samplePrice(input.price, input.priceStr, at)
    const cvdNorm = this.cvdNorm(at)
    this.cvdHistory.push({ ts: at, value: cvdNorm })
    const cvdZ = robustZ(this.cvdHistory, cvdNorm, 60)
    const velocityZ = robustZ(this.velocityHistory, velocity, 60)
    const recentReturns = this.returns.filter(item => item.ts >= at - 60_000).map(item => item.value)
    const volatility = standardDeviation(recentReturns)
    const detectorTotal = Math.abs(input.detectorBull) + Math.abs(input.detectorBear)
    const detectorScore = detectorTotal ? (input.detectorBull - input.detectorBear) / Math.max(100, detectorTotal) : 0
    const divergence = this.divergence(at)
    const microValid = Boolean(input.micro?.valid && input.bookSynced && input.bookAgeMs <= 1500)
    const priceValid = input.price > 0 && input.tradeAgeMs <= 5000
    const quality: DataQuality = !priceValid || !input.bookSynced ? 'invalid'
      : input.bookAgeMs > 1500 || input.tradeAgeMs > 3000 ? 'degraded'
      : !cvdZ.valid || !velocityZ.valid || !input.vpin.valid ? 'warming' : 'good'

    this.prune(at)
    return {
      id: `${input.symbol}:${at}`, symbol: input.symbol, exchange: input.exchange, eventTs: at,
      receiveTs: input.receiveTs ?? at, quality,
      cvdNorm: feature(cvdNorm, this.trades.size >= 10, Math.min(1, this.trades.size / 100), input.tradeAgeMs),
      cvdZ: feature(cvdZ.value, cvdZ.valid, cvdZ.warmup, input.tradeAgeMs),
      obi: feature(input.micro?.obi ?? 0, microValid, microValid ? 1 : 0, input.bookAgeMs),
      velocityZ: feature(velocityZ.value, velocityZ.valid, velocityZ.warmup, input.tradeAgeMs),
      microDev: feature(input.micro?.microDev ?? 0, microValid, microValid ? 1 : 0, input.bookAgeMs),
      vpin: feature(input.vpin.value, input.vpin.valid, input.vpin.warmup, Math.max(0, at - input.vpin.lastUpdateTs), { buckets: input.vpin.buckets.length }),
      detectorScore: feature(detectorScore, detectorTotal > 0, Math.min(1, detectorTotal / 150), input.bookAgeMs),
      volatility: feature(volatility, recentReturns.length >= 10, Math.min(1, recentReturns.length / 60), input.tradeAgeMs),
      divergence: feature(divergence.value, divergence.valid, divergence.valid ? 1 : 0, input.tradeAgeMs),
      price: input.price, priceStr: input.priceStr, spread: input.micro?.spread ?? 0
    }
  }

  getTrades(): NormalizedTrade[] { return this.trades.toArray() }
  getPriceHistory(): { price: number; ts: number }[] { return this.prices.map(({ price, ts }) => ({ price, ts })) }
  getCvdHistory(): TimedValue[] { return this.cvdHistory.map(item => ({ ...item })) }
  reset(): void {
    this.trades.clear(); this.prices = []; this.cvdHistory = []; this.velocityHistory = []; this.returns = []; this.lastSampleAt = 0
  }
}
