import type { DetectorResult, DetectorContext } from './detector';

export class LiquidityVoidDetector {
  name = 'liquidity_void';
  private gapMultiplier = 3;

  detect(ctx: DetectorContext): DetectorResult {
    // Scan both bid and ask sides for voids
    const bidResult = this.scanSide(ctx.bids, 'bid');
    const askResult = this.scanSide(ctx.asks, 'ask');
    // Return the strongest signal
    if (bidResult.confidence >= askResult.confidence) return bidResult;
    return askResult;
  }

  private scanSide(levels: { price: number; qty: number }[], side: 'bid' | 'ask'): DetectorResult {
    const sorted = [...levels].sort((a, b) => side === 'bid' ? b.price - a.price : a.price - b.price);
    const top = sorted.slice(0, 10);
    if (top.length < 3) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const gaps: number[] = [];
    for (let i = 1; i < top.length; i++) {
      gaps.push(Math.abs(top[i - 1].price - top[i].price));
    }
    if (gaps.length === 0) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const avgGap = this.median(gaps);
    const maxGap = Math.max(...gaps);
    if (maxGap < avgGap * this.gapMultiplier) {
      return { detector: this.name, side: 'neutral', confidence: 0, evidence: { maxGap, avgGap, side } };
    }
    const voidIdx = gaps.indexOf(maxGap);
    const voidTopPrice = top[voidIdx].price;
    const voidBottomPrice = top[voidIdx + 1].price;
    const voidMid = (voidTopPrice + voidBottomPrice) / 2;
    // Void in bid side (below current price) = vacuum below = bearish risk
    // Void in ask side (above current price) = vacuum above = bullish risk
    const vacSide = side === 'bid' ? 'bearish' : 'bullish';
    const confidence = Math.min(maxGap / (avgGap * 5), 0.8);
    return {
      detector: this.name,
      side: vacSide,
      confidence,
      evidence: { maxGap, avgGap, voidIdx, voidMid, voidTopPrice, voidBottomPrice, side: side === 'bid' ? -1 : 1 },
    };
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}