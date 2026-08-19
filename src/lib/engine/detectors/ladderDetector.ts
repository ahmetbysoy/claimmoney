import type { DetectorResult, DetectorContext } from './detector';

export class LadderDetector {
  name = 'ladder';
  private minWalls = 3;
  private spacingTolerance = 0.3;

  detect(ctx: DetectorContext): DetectorResult {
    const bidWalls = this.findWalls(ctx.bids, 'bullish');
    const askWalls = this.findWalls(ctx.asks, 'bearish');
    const bidResult = this.checkLadder(bidWalls);
    const askResult = this.checkLadder(askWalls);
    return bidResult.confidence >= askResult.confidence ? bidResult : askResult;
  }

  private findWalls(levels: { price: number; qty: number }[], side: 'bullish' | 'bearish'): { walls: { price: number; qty: number }[]; confidence: number; side: 'bullish' | 'bearish' } {
    const qtys = levels.slice(0, 15).map(l => l.qty);
    const medQty = this.median(qtys);
    if (medQty === 0) return { detector: this.name, side: 'neutral', confidence: 0, evidence: { wallCount: 0 } };
    const walls: { price: number; qty: number }[] = [];
    for (const lvl of levels) {
      if (lvl.qty >= medQty * 2) walls.push({ price: lvl.price, qty: lvl.qty });
    }
    return { walls, side, confidence: Math.min(walls.length / 5, 0.8) };
  }

  private checkLadder(walls: { price: number; qty: number }[]): DetectorResult {
    if (walls.length < this.minWalls) return { detector: this.name, side: 'neutral', confidence: 0, evidence: { wallCount: walls.length } };
    if (walls.length < 2) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const prices = walls.map(w => w.price);
    const spacings: number[] = [];
    for (let i = 1; i < prices.length; i++) spacings.push(Math.abs(prices[i] - prices[i - 1]));
    const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
    const stdSpacing = Math.sqrt(spacings.reduce((s, sp) => s + (sp - avgSpacing) ** 2, 0) / spacings.length);
    const cv = stdSpacing / (avgSpacing || 1);
    if (cv > this.spacingTolerance) return { detector: this.name, side: 'neutral', confidence: 0, evidence: { cv, avgSpacing } };
    return {
      detector: this.name,
      side,
      confidence: Math.min(walls.length / 5, 0.8),
      evidence: { wallCount: walls.length, cv },
    };
  }
}
