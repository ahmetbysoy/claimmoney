import type { DetectorResult, DetectorContext } from './detector';

export class LiquidityVoidDetector {
  name = 'liquidity_void';
  private gapMultiplier = 3;

  detect(ctx: DetectorContext): DetectorResult {
    const levels = ctx.bids.slice(0, 10);
    if (levels.length < 3) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const gaps: number[] = [];
    for (let i = 1; i < levels.length; i++) {
      const gap = Math.abs(levels[i - 1].price - levels[i].price);
      gaps.push(gap);
    }
    if (gaps.length === 0) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const avgGap = this.median(gaps);
    const maxGap = Math.max(...gaps);
    if (maxGap < avgGap * this.gapMultiplier) {
      return { detector: this.name, side: 'neutral', confidence: 0, evidence: { maxGap, avgGap } };
    // Void = vacuum risk — direction = vacuum side
    const voidSide = levels.findIndex((l, i) => l.price === maxGap) > -1;
    const side = voidSide >= 0 ? 'ask' : 'bid';
    const vacSide = side === 'bid' ? 'bearish' : 'bullish';
    return {
      detector: this.name,
      side: vacSide,
      confidence: Math.min(maxGap / (avgGap * 5), 0.8),
      evidence: { maxGap, avgGap, voidSide: voidSide === 'bid' ? 1 : -1 },
    };
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}
