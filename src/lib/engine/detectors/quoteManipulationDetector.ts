import type { DetectorResult, DetectorContext } from './detector';

interface WallObservation {
  price: number;
  qty: number;
  side: 'bid' | 'ask';
  firstSeen: number;
  lastSeen: number;
  refreshCount: number;
  maxQty: number;
  pulled: boolean;
}

export class QuoteManipulationDetector {
  name = 'quote_manipulation';
  private observations = new Map<string, WallObservation>();
  private maxAge = 20000;
  private pullThreshold = 0.4;   // qty drops below 60% of max → pulled
  private refreshRateThreshold = 5; // refreshes per second considered suspicious
  private minNotional = 30000;

  detect(ctx: DetectorContext): DetectorResult {
    const now = ctx.eventTs;
    this.pruneOld(now);
    this.updateObservations(ctx.bids, 'bid', now);
    this.updateObservations(ctx.asks, 'ask', now);
    return this.detectManipulation(ctx, now);
  }

  private updateObservations(levels: { price: number; qty: number }[], side: 'bid' | 'ask', now: number): void {
    const seenKeys = new Set<string>();
    for (let i = 0; i < Math.min(levels.length, 15); i++) {
      const lvl = levels[i];
      const key = `${side}_${lvl.price}`;
      seenKeys.add(key);
      const existing = this.observations.get(key);
      if (!existing) {
        // Only track new levels if they meet minimum notional
        if (lvl.price * lvl.qty < this.minNotional) continue;
        this.observations.set(key, {
          price: lvl.price, qty: lvl.qty, side, firstSeen: now, lastSeen: now,
          refreshCount: 0, maxQty: lvl.qty, pulled: false,
        });
      } else {
        existing.lastSeen = now;
        existing.refreshCount++;
        if (lvl.qty > existing.maxQty) existing.maxQty = lvl.qty;
        if (existing.maxQty > 0 && lvl.qty < existing.maxQty * (1 - this.pullThreshold)) {
          existing.pulled = true;
        }
        existing.qty = lvl.qty;
      }
    }
    // Mark levels that disappeared as pulled
    for (const [key, obs] of this.observations) {
      if (obs.side === side && !seenKeys.has(key) && !obs.pulled) {
        obs.pulled = true;
        obs.lastSeen = now;
      }
    }
  }

  private detectManipulation(ctx: DetectorContext, now: number): DetectorResult {
    let bestResult: DetectorResult = { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
    for (const [, obs] of this.observations) {
      const age = now - obs.firstSeen;
      if (age < 500 || age > this.maxAge) continue; // need at least 500ms of observation
      const elapsed = (obs.lastSeen - obs.firstSeen) / 1000;
      const refreshRate = elapsed > 0 ? obs.refreshCount / elapsed : 0;
      if (obs.pulled && obs.side === 'bid') {
        // Bid wall pulled → bullish (fake sell pressure removed)
        const conf = Math.min(refreshRate / this.refreshRateThreshold, 1) * 0.8;
        if (conf > bestResult.confidence) {
          bestResult = { detector: this.name, side: 'bullish', confidence: conf, evidence: { pullPrice: obs.price, maxQty: obs.maxQty, currentQty: obs.qty, refreshRate, age } };
        }
      } else if (obs.pulled && obs.side === 'ask') {
        // Ask wall pulled → bearish (fake buy pressure removed)
        const conf = Math.min(refreshRate / this.refreshRateThreshold, 1) * 0.8;
        if (conf > bestResult.confidence) {
          bestResult = { detector: this.name, side: 'bearish', confidence: conf, evidence: { pullPrice: obs.price, maxQty: obs.maxQty, currentQty: obs.qty, refreshRate, age } };
        }
      } else if (refreshRate > this.refreshRateThreshold && !obs.pulled) {
        // High refresh rate without pull → potential spoof-in-progress
        const conf = Math.min((refreshRate - this.refreshRateThreshold) / this.refreshRateThreshold, 0.6);
        const spoofSide = obs.side === 'bid' ? 'bearish' : 'bullish'; // fake wall on bid = fake support = bearish
        if (conf > bestResult.confidence) {
          bestResult = { detector: this.name, side: spoofSide, confidence: conf, evidence: { spoofPrice: obs.price, qty: obs.qty, refreshRate, age } };
        }
      }
    }
    return bestResult;
  }

  private pruneOld(now: number): void {
    for (const [key, obs] of this.observations) {
      if (now - obs.lastSeen > this.maxAge) this.observations.delete(key);
    }
  }

  reset(): void { this.observations.clear(); }
}
