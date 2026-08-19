import type { DetectorResult, DetectorContext } from './detector';

export class SkewDetector {
  name = 'skew';
  private threshold = 0.4;

  detect(ctx: DetectorContext): DetectorResult {
    const levels = 10;
    const bidNotional = ctx.bids.slice(0, levels).reduce((s, l) => s + l.price * l.qty, 0);
    const askNotional = ctx.asks.slice(0, levels).reduce((s, l) => s + l.price * l.qty, 0);
    const total = bidNotional + askNotional;
    if (total === 0) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const skew = (bidNotional - askNotional) / total;
    const absSkew = Math.abs(skew);
    if (absSkew < this.threshold) return { detector: this.name, side: 'neutral', confidence: 0, evidence: { skew } };
    return {
      detector: this.name,
      side: skew > 0 ? 'bullish' : 'bearish',
      confidence: Math.min(absSkew / 0.8, 1),
      evidence: { skew, bidNotional, askNotional },
    };
  }
}