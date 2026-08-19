import type { FeatureValue } from '../domain/frames';
import { onlineEMA, robustStd, zScore } from './statistics';

export class VelocityFeature {
  private prevPrice = 0;
  private emaVelocity = 0;
  private history: number[] = [];
  private alpha: number;
  private count = 0;
  private lastTs = 0;

  constructor(period = 30) {
    this.alpha = 2 / (period + 1);
  }

  onPrice(price: number, ts: number): void {
    if (this.prevPrice <= 0 || this.lastTs === 0) {
      this.prevPrice = price;
      this.lastTs = ts;
      return;
    }
    const dt = (ts - this.lastTs) / 1000;
    if (dt <= 0 || dt > 10) {
      this.prevPrice = price;
      this.lastTs = ts;
      return;
    }
    const bpsPerSec = ((price - this.prevPrice) / this.prevPrice) * 10000 / dt;
    this.emaVelocity = onlineEMA(this.emaVelocity, bpsPerSec, this.alpha);
    this.history.push(this.emaVelocity);
    if (this.history.length > 120) this.history.shift();
    this.prevPrice = price;
    this.lastTs = ts;
    this.count++;
  }

  getValue(ts: number): FeatureValue {
    if (this.history.length < 10) {
      return { value: 0, valid: false, warmup: this.history.length, ageMs: ts - this.lastTs };
    }
    const recent = this.history.slice(-30);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const sigma = robustStd(recent);
    const z = zScore(this.emaVelocity, mean, sigma);
    return {
      value: z,
      valid: this.count >= 30,
      warmup: Math.min(this.count, 30),
      ageMs: ts - this.lastTs,
      evidence: { velocity: this.emaVelocity, mean, sigma },
    };
  }

  reset(): void {
    this.prevPrice = 0;
    this.emaVelocity = 0;
    this.history = [];
    this.count = 0;
    this.lastTs = 0;
  }
}