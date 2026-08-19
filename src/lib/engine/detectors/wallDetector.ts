import type { DetectorResult, DetectorContext } from './detector';

interface WallTrack {
  price: number;
  side: 'bid' | 'ask';
  qty: number;
  initialQty: number;
  seenAt: number;
  lastQty: number;
  refreshCount: number;
  state: 'appeared' | 'strengthened' | 'pulled' | 'consumed';
}

export class WallDetector {
  name = 'wall';
  private walls = new Map<string, WallTrack>();
  private maxAge = 30000;
  private qtyMultiplier = 3;

  detect(ctx: DetectorContext): DetectorResult {
    const now = ctx.eventTs;
    const bullish = this.scanSide(ctx.bids, 'bid', now);
    const bearish = this.scanSide(ctx.asks, 'ask', now);
    for (const [key, wall] of this.walls) {
      if (now - wall.seenAt > this.maxAge) this.walls.delete(key);
    }
    if (bullish.confidence > 0 && bearish.confidence > 0) {
      return { detector: 'compression', side: 'neutral', confidence: Math.min(bullish.confidence, bearish.confidence) * 0.7, evidence: { ...bullish.evidence, ...bearish.evidence } };
    }
    return bullish.confidence >= bearish.confidence ? bullish : bearish;
  }

  private scanSide(levels: { price: number; qty: number }[], side: 'bid' | 'ask', now: number): DetectorResult {
    if (levels.length < 5) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    const qtys = levels.slice(0, 15).map(l => l.qty);
    const medQty = this.median(qtys);
    const threshold = medQty * this.qtyMultiplier;
    const notionalThreshold = 50000;
    let result: DetectorResult = { detector: this.name, side: side === 'bid' ? 'bullish' : 'bearish', confidence: 0, evidence: { medQty } };
    for (const lvl of levels.slice(0, 15)) {
      if (lvl.qty < threshold || lvl.price * lvl.qty < notionalThreshold) continue;
      const key = side + '_' + lvl.price;
      const existing = this.walls.get(key);
      if (!existing) {
        this.walls.set(key, { price: lvl.price, side, qty: lvl.qty, initialQty: lvl.qty, seenAt: now, lastQty: lvl.qty, refreshCount: 0, state: 'appeared' });
        result = { detector: this.name, side: result.side, confidence: 0.7, evidence: { wallPrice: lvl.price, wallQty: lvl.qty, wallSide: side === 'bid' ? 1 : -1, medQty } };
        break;
      } else {
        existing.lastQty = lvl.qty;
        if (lvl.qty > existing.initialQty * 1.2) existing.state = 'strengthened';
        else if (lvl.qty < existing.initialQty * 0.6) existing.state = 'pulled';
        existing.refreshCount++;
      }
    }
    return result;
  }

  private median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  reset(): void { this.walls.clear(); }
}
