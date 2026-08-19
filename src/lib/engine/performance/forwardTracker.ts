import type { ApprovedSignal } from '../domain/signals';

interface HorizonSample {
  signalId: string;
  signalTs: number;
  horizonMs: number;
  returnPct: number;
  mfePct: number;
  maePct: number;
  realized: boolean;
  side: 'BUY' | 'SELL';
  entryPrice: number;
}

export class ForwardTracker {
  private samples: HorizonSample[] = [];
  private horizons = [15000, 30000, 60000, 300000, 900000];
  private maxSamplesPerHorizon = 500;

  onSignal(signal: ApprovedSignal): void {
    for (const h of this.horizons) {
      this.samples.push({
        signalId: signal.id,
        signalTs: signal.eventTs,
        horizonMs: h,
        returnPct: 0, mfePct: 0, maePct: 0, realized: false,
        side: signal.side,
        entryPrice: signal.price,
      });
    }
    this.prune();
  }

  updatePrice(price: number, ts: number): void {
    for (const s of this.samples) {
      if (s.realized) continue;
      const elapsed = ts - s.signalTs;
      if (elapsed < s.horizonMs) {
        const ret = s.side === 'BUY'
          ? (price - s.entryPrice) / s.entryPrice
          : (s.entryPrice - price) / s.entryPrice;
        s.returnPct = ret;
        s.mfePct = Math.max(s.mfePct, ret);
        s.maePct = Math.min(s.maePct, ret);
      } else {
        s.realized = true;
      }
    }
  }

  private prune(): void {
    for (const h of this.horizons) {
      const hs = this.samples.filter(s => s.horizonMs === h);
      if (hs.length > this.maxSamplesPerHorizon) {
        const removeCount = hs.length - this.maxSamplesPerHorizon;
        let removed = 0;
        this.samples = this.samples.filter(s => {
          if (s.horizonMs !== h || removed >= removeCount) return true;
          removed++;
          return false;
        });
      }
    }
  }

  getMetrics(): { horizon: number; count: number; winRate: number; avgReturn: number; expectancy: number; medianReturn: number }[] {
    return this.horizons.map(h => {
      const hs = this.samples.filter(s => s.horizonMs === h && s.realized);
      const wins = hs.filter(s => s.returnPct > 0);
      const returns = hs.map(s => s.returnPct);
      const sorted = [...returns].sort((a, b) => a - b);
      const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
      return {
        horizon: h,
        count: hs.length,
        winRate: hs.length > 0 ? wins.length / hs.length : 0,
        avgReturn: returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0,
        expectancy: hs.length > 0 ? hs.reduce((s, x) => s + x.returnPct, 0) / hs.length : 0,
        medianReturn: median,
      };
    });
  }

  reset(): void { this.samples = []; }
}
