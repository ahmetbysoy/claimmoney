import type { Candle, Side } from '../types'

export class CandleBuilder {
  private candles: Candle[] = []
  private current: Candle | null = null
  constructor(private readonly intervalSec = 15, private readonly capacity = 300) {}

  update(price: number, ts: number, qty = 0, side?: Side): Candle | null {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ts)) return this.current
    const time = Math.floor(ts / 1000 / this.intervalSec) * this.intervalSec
    if (!this.current || this.current.time !== time) {
      if (this.current) { this.current.complete = true; this.candles.push({ ...this.current }) }
      if (this.candles.length > this.capacity) this.candles.splice(0, this.candles.length - this.capacity)
      this.current = { time, open: price, high: price, low: price, close: price, volume: Math.max(0, qty),
        buyVolume: side === 'buy' ? Math.max(0, qty) : 0, sellVolume: side === 'sell' ? Math.max(0, qty) : 0, complete: false }
    } else {
      this.current.high = Math.max(this.current.high, price); this.current.low = Math.min(this.current.low, price); this.current.close = price
      this.current.volume += Math.max(0, qty)
      if (side === 'buy') this.current.buyVolume = (this.current.buyVolume ?? 0) + Math.max(0, qty)
      if (side === 'sell') this.current.sellVolume = (this.current.sellVolume ?? 0) + Math.max(0, qty)
    }
    return { ...this.current }
  }
  getCandles(): Candle[] { return [...this.candles, ...(this.current ? [{ ...this.current }] : [])] }
  reset(): void { this.candles = []; this.current = null }
}
