import type { FeatureValue } from '../domain/frames';
import { onlineEMA } from './statistics';

export class OBIFeature {
  private prevOBI = 0;
  private tauMs: number;
  private lastTs = 0;
  private count = 0;

  constructor(tauS = 5) {
    this.tauMs = tauS * 1000;
  }

  compute(bids: { price: number; qty: number }[], asks: { price: number; qty: number }[], mid: number, ts: number): FeatureValue {
    const levels = 10;
    const spread = asks.length > 0 && bids.length > 0 ? asks[0].price - bids[0].price : 0;
    if (spread <= 0 || mid <= 0) {
      return { value: 0, valid: false, warmup: 0, ageMs: ts - this.lastTs };
    }

    let bidWeighted = 0;
    let askWeighted = 0;
    const bidLevels = bids.slice(0, levels);
    const askLevels = asks.slice(0, levels);

    for (const lvl of bidLevels) {
      const dist = (mid - lvl.price) / spread;
      if (dist < 0) continue;
      const weight = Math.exp(-dist * 2);
      bidWeighted += lvl.qty * weight;
    }

    for (const lvl of askLevels) {
      const dist = (lvl.price - mid) / spread;
      if (dist < 0) continue;
      const weight = Math.exp(-dist * 2);
      askWeighted += lvl.qty * weight;
    }

    const total = bidWeighted + askWeighted;
    const rawOBI = total > 0 ? (bidWeighted - askWeighted) / total : 0;

    const dt = this.lastTs > 0 ? ts - this.lastTs : this.tauMs;
    const timeAlpha = dt > 0 ? 1 - Math.exp(-dt / this.tauMs) : this.alpha;
    this.prevOBI = onlineEMA(this.prevOBI, rawOBI, Math.min(timeAlpha, 1));
    this.lastTs = ts;
    this.count++;

    return {
      value: this.prevOBI,
      valid: this.count >= 5,
      warmup: Math.min(this.count, 20),
      ageMs: 0,
      evidence: { rawOBI, bidWeighted, askWeighted, spread },
    };
  }

  reset(): void { this.prevOBI = 0; this.count = 0; this.lastTs = 0; }
}
