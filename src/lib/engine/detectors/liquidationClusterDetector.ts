import type { DetectorResult, DetectorContext } from './detector';

interface LiquidationEvent {
  price: number;
  qty: number;
  side: 'long' | 'short';
  ts: number;
  notional: number;
}

export class LiquidationClusterDetector {
  name = 'liquidation_cluster';
  private liquidations: LiquidationEvent[] = [];
  private windowMs = 10000;
  private minCount = 5;
  private minNotional = 500000;

  /** Feed a liquidation event from external source (e.g. WS feed) */
  onLiquidation(price: number, qty: number, side: 'long' | 'short', ts: number): void {
    this.liquidations.push({ price, qty, side, ts, notional: price * qty });
    this.prune(ts);
  }

  detect(ctx: DetectorContext): DetectorResult {
    this.prune(ctx.eventTs);
    if (this.liquidations.length < this.minCount) {
      return { detector: this.name, side: 'neutral', confidence: 0, evidence: { count: this.liquidations.length } };
    }
    const totalNotional = this.liquidations.reduce((s, l) => s + l.notional, 0);
    if (totalNotional < this.minNotional) {
      return { detector: this.name, side: 'neutral', confidence: 0, evidence: { totalNotional, count: this.liquidations.length } };
    }
    const longLiqs = this.liquidations.filter(l => l.side === 'long');
    const shortLiqs = this.liquidations.filter(l => l.side === 'short');
    const longNotional = longLiqs.reduce((s, l) => s + l.notional, 0);
    const shortNotional = shortLiqs.reduce((s, l) => s + l.notional, 0);
    // Long liquidations = forced selling = bearish signal (but may indicate capitulation → reversal)
    // Short liquidations = forced buying = bullish signal
    // Primary signal: liquidation cascade direction
    let side: 'bullish' | 'bearish' | 'neutral';
    let confidence: number;
    if (longNotional > shortNotional * 2) {
      // Heavy long liquidations → cascade selling → bearish
      side = 'bearish';
      confidence = Math.min(totalNotional / (this.minNotional * 3), 1);
    } else if (shortNotional > longNotional * 2) {
      // Heavy short liquidations → cascade buying → bullish
      side = 'bullish';
      confidence = Math.min(totalNotional / (this.minNotional * 3), 1);
    } else {
      side = 'neutral';
      confidence = 0;
    }
    // Price clustering: if many liquidations at similar price → magnet level
    const prices = this.liquidations.map(l => l.price);
    const priceRange = Math.max(...prices) - Math.min(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    return {
      detector: this.name,
      side,
      confidence,
      evidence: {
        count: this.liquidations.length,
        totalNotional,
        longNotional,
        shortNotional,
        priceRange,
        clusterPrice: avgPrice,
      },
    };
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.liquidations = this.liquidations.filter(l => l.ts >= cutoff);
  }

  reset(): void { this.liquidations = []; }
}
