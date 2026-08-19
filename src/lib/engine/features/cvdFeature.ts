import type { FeatureValue } from '../domain/frames';
import { onlineEMA, robustStd, zScore } from './statistics';

interface CVDState {
  rollingBuys: number;
  rollingSells: number;
  emaCVD: number;
  emaMean: number;
  emaStd: number;
  count: number;
  lastTs: number;
  cvdHistory: number[];
}

export class CVDFeature {
  private state: CVDState;
  private windowMs: number;
  private alpha: number;
  private seenIds: Set<string>;

  constructor(windowS = 60, period = 20) {
    this.windowMs = windowS * 1000;
    this.alpha = 2 / (period + 1);
    this.seenIds = new Set();
    this.state = this.emptyState();
  }

  private emptyState(): CVDState {
    return { rollingBuys: 0, rollingSells: 0, emaCVD: 0, emaMean: 0, emaStd: 0, count: 0, lastTs: 0, cvdHistory: [] };
  }

  onTrade(tradeId: string, side: 'buy' | 'sell', qty: number, ts: number): void {
    if (this.seenIds.has(tradeId)) return;
    this.seenIds.add(tradeId);
    if (side === 'buy') this.state.rollingBuys += qty;
    else this.state.rollingSells += qty;
    this.state.lastTs = ts;
    this.state.count++;
    const total = this.state.rollingBuys + this.state.rollingSells;
    if (total === 0) return;
    const cvdNorm = (this.state.rollingBuys - this.state.rollingSells) / total;
    this.state.emaCVD = onlineEMA(this.state.emaCVD, cvdNorm, this.alpha);
    // Update running mean/std for z-score
    this.state.cvdHistory.push(cvdNorm);
    if (this.state.cvdHistory.length > 120) this.state.cvdHistory.shift();
    if (this.state.cvdHistory.length >= 2) {
      this.state.emaMean = onlineEMA(this.state.emaMean, cvdNorm, 0.05);
      const variance = this.state.cvdHistory.reduce((s, v) => s + (v - this.state.emaMean) ** 2, 0) / this.state.cvdHistory.length;
      this.state.emaStd = Math.sqrt(variance);
    }
    // Expire old trades from rolling window
    const cutoff = ts - this.windowMs;
    // (simplified: seenIds handles dedup, periodic prune needed for memory)
    if (this.state.count % 500 === 0 && this.seenIds.size > 2000) {
      this.seenIds.clear();
    }
  }

  getValue(ts: number): FeatureValue {
    const z = zScore(this.state.emaCVD, this.state.emaMean, this.state.emaStd);
    const warmup = Math.min(this.state.count, 60);
    return {
      value: z,
      valid: warmup >= 20,
      warmup,
      ageMs: ts - this.state.lastTs,
      evidence: { cvdNorm: this.state.emaCVD, emaMean: this.state.emaMean, emaStd: this.state.emaStd },
    };
  }

  reset(): void {
    this.state = this.emptyState();
    this.seenIds.clear();
  }
}
