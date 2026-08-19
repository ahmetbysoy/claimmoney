import type { FeatureValue } from '../domain/frames';
import { clamp } from './statistics';

interface FlowCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  pressure: number;
  absorption: number;
  poc: number;
}

export class FlowFeature {
  private candles: FlowCandle[] = [];
  private activeCandle: FlowCandle | null = null;
  private bucketMs: number;
  private bucketSize: number;
  private currentBucketVol = 0;
  private lastTickTs = 0;

  constructor(config?: { bucketMs?: number; bucketSize?: number }) {
    this.bucketMs = config?.bucketMs ?? 5000;
    this.bucketSize = config?.bucketSize ?? 500000;
  }

  onTrade(price: number, side: 'buy' | 'sell', qty: number, ts: number): void {
    const bucketStart = Math.floor(ts / this.bucketMs) * this.bucketMs;
    // Close bucket if time boundary changed
    if (this.activeCandle && this.activeCandle.ts !== bucketStart) {
      this.closeBucket();
    }
    // Start new bucket if needed
    if (!this.activeCandle) {
      this.activeCandle = {
        ts: bucketStart, open: price, high: price, low: price, close: price,
        volume: 0, buyVolume: 0, sellVolume: 0, delta: 0, pressure: 0, absorption: 0, poc: price,
      };
      this.currentBucketVol = 0;
    }
    // Accumulate trade into active candle
    const c = this.activeCandle;
    c.close = price;
    c.high = Math.max(c.high, price);
    c.low = Math.min(c.low, price);
    c.volume += qty;
    if (side === 'buy') c.buyVolume += qty; else c.sellVolume += qty;
    this.currentBucketVol += qty;
    // Volume-triggered close: include triggering trade in NEW bucket
    if (this.currentBucketVol >= this.bucketSize) {
      const closedTs = c.ts;
      this.closeBucket();
      // The triggering trade starts the new bucket (prevent loss)
      this.activeCandle = {
        ts: closedTs + this.bucketMs, open: price, high: price, low: price, close: price,
        volume: qty, buyVolume: side === 'buy' ? qty : 0, sellVolume: side === 'sell' ? qty : 0,
        delta: side === 'buy' ? qty : -qty, pressure: 0, absorption: 0, poc: price,
      };
      this.currentBucketVol = qty;
    }
    this.lastTickTs = ts;
  }

  tick(price: number, ts: number): void {
    if (this.activeCandle && ts - this.lastTickTs > this.bucketMs) {
      this.closeBucket();
    }
  }

  private closeBucket(): void {
    if (!this.activeCandle) return;
    const c = this.activeCandle;
    c.delta = c.buyVolume - c.sellVolume;
    c.pressure = c.volume > 0 ? clamp(c.delta / c.volume, -1, 1) : 0;
    c.absorption = c.volume > 0 ? 1 - Math.abs(c.delta) / c.volume : 0;
    c.poc = (c.high + c.low) / 2;
    this.candles.push(c);
    if (this.candles.length > 200) this.candles.shift();
    this.activeCandle = null;
  }

  getLastCandle(): FlowCandle | null {
    return this.activeCandle ?? (this.candles.length > 0 ? this.candles[this.candles.length - 1] : null);
  }

  getCandles(): FlowCandle[] { return [...this.candles]; }
  reset(): void {
    this.candles = [];
    this.activeCandle = null;
  }
}