import type { DetectorResult, DetectorContext } from './detector';

interface TradeRecord {
  price: number;
  qty: number;
  side: 'buy' | 'sell';
  ts: number;
}

export class IcebergDetector {
  name = 'iceberg';
  private trades: TradeRecord[] = [];
  private lookbackMs = 60000; // 60 second lookback
  private multiplier = 2;

  onTrade(price: number, side: 'buy' | 'sell', qty: number, ts: number): void {
    this.trades.push({ price, qty, side, ts });
    this.prune(ts);
  }

  detect(ctx: DetectorContext): DetectorResult {
    this.prune(ctx.eventTs);
    const visibleBid = ctx.bids.slice(0, 10).reduce((s, l) => s + l.price * l.qty, 0);
    const visibleAsk = ctx.asks.slice(0, 10).reduce((s, l) => s + l.price * l.qty, 0);
    const visibleTotal = visibleBid + visibleAsk;
    if (visibleTotal <= 0) return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };

    // Calculate recent executed volume vs visible depth
    const recentBuyVol = this.trades.filter(t => t.side === 'buy').reduce((s, t) => s + t.price * t.qty, 0);
    const recentSellVol = this.trades.filter(t => t.side === 'sell').reduce((s, t) => s + t.price * t.qty, 0);

    // Iceberg on bid: aggressive sells absorbed by hidden bid liquidity
    // Recent sell volume much larger than visible ask depth → hidden bid (bullish)
    const sellAbsorption = visibleAsk > 0 ? recentSellVol / visibleAsk : 0;
    // Iceberg on ask: aggressive buys absorbed by hidden ask liquidity
    // Recent buy volume much larger than visible bid depth → hidden ask (bearish)
    const buyAbsorption = visibleBid > 0 ? recentBuyVol / visibleBid : 0;

    if (sellAbsorption < this.multiplier && buyAbsorption < this.multiplier) {
      return { detector: this.name, side: 'neutral', confidence: 0, evidence: { sellAbsorption, buyAbsorption } };
    }

    // Return the stronger signal
    if (sellAbsorption > buyAbsorption) {
      return {
        detector: this.name,
        side: 'bullish',
        confidence: Math.min((sellAbsorption - this.multiplier) / this.multiplier, 1),
        evidence: { sellAbsorption, buyAbsorption, recentSellVol, visibleAsk },
      };
    } else {
      return {
        detector: this.name,
        side: 'bearish',
        confidence: Math.min((buyAbsorption - this.multiplier) / this.multiplier, 1),
        evidence: { sellAbsorption, buyAbsorption, recentBuyVol, visibleBid },
      };
    }
  }

  private prune(now: number): void {
    const cutoff = now - this.lookbackMs;
    this.trades = this.trades.filter(t => t.ts >= cutoff);
  }

  reset(): void { this.trades = []; }
}
