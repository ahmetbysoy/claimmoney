import type { FeatureValue } from '../domain/frames';
import { onlineEMA, robustStd } from './statistics';

export class VolatilityFeature {
  private returns: number[] = [];
  private emaVol: number = 0;
  private alpha: number;
  private prevPrice = 0;
  private count = 0;

  constructor(period = 20) {
    this.alpha = 2 / (period + 1);
  }

  onPrice(price: number): void {
    if (this.prevPrice > 0) {
      const ret = (price - this.prevPrice) / this.prevPrice;
      this.returns.push(ret);
      if (this.returns.length > 300) this.returns.shift();
      const std = robustStd(this.returns);
      this.emaVol = onlineEMA(this.emaVol, std, this.alpha);
    }
    this.prevPrice = price;
    this.count++;
  }

  getValue(ts: number): FeatureValue {
    return {
      value: this.emaVol * 10000,
      valid: this.count >= 30,
      warmup: Math.min(this.count, 30),
      ageMs: 0,
      evidence: { volBps: this.emaVol * 10000 },
    };
  }

  reset(): void { this.returns = []; this.emaVol = 0; this.prevPrice = 0; this.count = 0; }
}