// ClaimMoney v3 — Compression Detector
// Detects when both bid and ask sides have strong walls near each other
// with a very narrow spread — a "squeeze" warning flag.

import type { DetectorContext, DetectorResult } from './detector';

/** Spread threshold: flag compression when spread < 0.05% of mid. */
const DEFAULT_SPREAD_THRESHOLD_PCT = 0.0005;

/** A wall must have qty > WALL_MULTIPLIER × median qty of that side. */
const WALL_MULTIPLIER = 3;

export class CompressionDetector {
  readonly name = 'compression';

  private readonly spreadThresholdPct: number;

  constructor(spreadThresholdPct = DEFAULT_SPREAD_THRESHOLD_PCT) {
    this.spreadThresholdPct = spreadThresholdPct;
  }

  detect(ctx: DetectorContext): DetectorResult {
    const bidWall = this.findStrongestWall(ctx.bids);
    const askWall = this.findStrongestWall(ctx.asks);

    // Both sides need a wall to constitute compression.
    if (bidWall === null || askWall === null) {
      return {
        detector: this.name,
        side: 'neutral',
        confidence: 0,
        evidence: {},
      };
    }

    const spreadPct = ctx.mid > 0 ? ctx.spread / ctx.mid : 1;

    if (spreadPct < this.spreadThresholdPct) {
      return {
        detector: this.name,
        side: 'neutral',
        confidence: 0.85,
        evidence: {
          bidWallQty: bidWall.qty,
          askWallQty: askWall.qty,
          spreadPct: Math.round(spreadPct * 1e6) / 1e6,
        },
      };
    }

    return {
      detector: this.name,
      side: 'neutral',
      confidence: 0,
      evidence: {
        bidWallQty: bidWall.qty,
        askWallQty: askWall.qty,
        spreadPct: Math.round(spreadPct * 1e6) / 1e6,
      },
    };
  }

  /**
   * Find the level whose qty exceeds WALL_MULTIPLIER × median qty.
   * Returns the level with the highest qty among those, or null.
   */
  private findStrongestWall(
    levels: { price: number; qty: number }[],
  ): { price: number; qty: number } | null {
    if (levels.length === 0) return null;

    const qtys = levels.map((l) => l.qty);
    const median = this.median(qtys);
    const threshold = median * WALL_MULTIPLIER;

    let best: { price: number; qty: number } | null = null;
    for (const level of levels) {
      if (level.qty > threshold) {
        if (best === null || level.qty > best.qty) {
          best = level;
        }
      }
    }
    return best;
  }

  private median(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const arr = [...sorted].sort((a, b) => a - b);
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0
      ? arr[mid]
      : (arr[mid - 1] + arr[mid]) / 2;
  }
}
