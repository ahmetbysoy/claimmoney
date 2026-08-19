import type { FeatureValue } from '../domain/frames';
import { onlineEMA } from './statistics';

export class MicropriceFeature {
  private prevDev = 0;
  private alpha = 0.3;
  private count = 0;
  private lastTs = 0;

  compute(mid: number, bestBid: number, bestAsk: number, ts: number): FeatureValue {
    const bbo = (bestBid + bestAsk) / 2;
    if (bbo <= 0) return { value: 0, valid: false, warmup: 0, ageMs: ts - this.lastTs };
    const deviation = (mid - bbo) / bbo * 10000;
    this.prevDev = onlineEMA(this.prevDev, deviation, this.alpha);
    this.lastTs = ts;
    this.count++;
    return {
      value: this.prevDev / 100,
      valid: this.count >= 5,
      warmup: Math.min(this.count, 10),
      ageMs: 0,
      evidence: { deviation, bbo },
    };
  }

  reset(): void { this.prevDev = 0; this.count = 0; this.lastTs = 0; }
}