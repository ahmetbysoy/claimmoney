import type { DetectorResult, DetectorContext } from './detector';

export class IcebergDetector {
  name = 'iceberg';
  private lookbackTrades = 80;
  private multiplier = 2;

  detect(ctx: DetectorContext): DetectorResult {
    const visibleBid = ctx.bids.slice(0, 10).reduce((s, l) => s + l.price * l.qty, 0);
    const visibleAsk = ctx.asks.slice(0, 10).reduce((s, l) => s + l.price * l.qty, 0);
    const visibleTotal = visibleBid + visibleAsk;
    const recentVol = ctx.lastFlowVolume;
    if (recentVol <= 0 || visibleTotal <= 0) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const ratio = recentVol / visibleTotal;
    if (ratio < this.multiplier) return { detector: this.name, side: 'neutral', confidence: 0, evidence: { ratio } };
    // Aggressive sells absorbed by bid depth = bullish, aggressive buys absorbed by ask depth = bearish
    const side = ctx.lastFlowDelta > 0 ? 'bearish' : 'bullish';
    return {
      detector: this.name,
      side,
      confidence: Math.min((ratio - this.multiplier) / this.multiplier, 1),
      evidence: { ratio, recentVol, visibleTotal, delta: ctx.lastFlowDelta },
    };
  }
}