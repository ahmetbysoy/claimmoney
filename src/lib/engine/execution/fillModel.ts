// ClaimMoney v3 — L2 Depth-Based Fill / Slippage Model
// Walks through order-book levels to estimate realistic fill price.

export interface FillResult {
  /** Weighted-average price at which the order would fill. */
  fillPrice: number;
  /** Actual quantity filled (may be less than requested if book is thin). */
  fillQty: number;
  /** Slippage vs mid price, in basis points. */
  slippage: number;
}

export interface FillModelConfig {
 /** Maximum slippage cap in basis points (default 50 bps). */
  maxSlippageBps?: number;
 /** Extra impact factor multiplier applied to qty (default 1.0). */
  impactFactor?: number;
}

interface BookLevel {
  price: number;
  qty: number;
}

export class FillModel {
  private readonly maxSlippageBps: number;
  private readonly impactFactor: number;

  constructor(config?: FillModelConfig) {
    this.maxSlippageBps = config?.maxSlippageBps ?? 50;
    this.impactFactor = config?.impactFactor ?? 1.0;
  }

  /**
   * Estimate the fill for a market order.
   *
   * @param side   'buy'  → walk up through asks
   *              'sell' → walk down through bids
   * @param qty    Desired quantity to fill.
   * @param book   { bids, asks } — must be sorted best-first.
   * @param mid    Current mid price for slippage calculation.
   */
  estimateFill(
    side: 'buy' | 'sell',
    qty: number,
    book: { bids: BookLevel[]; asks: BookLevel[] },
    mid: number,
  ): FillResult {
    if (qty <= 0 || mid <= 0) {
      return { fillPrice: mid, fillQty: 0, slippage: 0 };
    }

    const levels = side === 'buy' ? book.asks : book.bids;

    let remaining = qty * this.impactFactor;
    let cost = 0; // accumulated (price × qty)
    let filled = 0;

    for (const level of levels) {
      if (remaining <= 0) break;

      const take = Math.min(level.qty, remaining);
      cost += level.price * take;
      filled += take;
      remaining -= take;
    }

    if (filled <= 0) {
      // Book completely empty for this side — assume mid with max slippage.
      const worstPrice =
        side === 'buy'
          ? mid * (1 + this.maxSlippageBps / 10_000)
          : mid * (1 - this.maxSlippageBps / 10_000);
      return {
        fillPrice: worstPrice,
        fillQty: 0,
        slippage: this.maxSlippageBps,
      };
    }

    const avgPrice = cost / filled;

    // Slippage in bps: (avgPrice - mid) / mid * 10_000
    // For sells this is naturally negative; we take the absolute magnitude.
    const rawSlippageBps = Math.abs((avgPrice - mid) / mid) * 10_000;
    const slippage = Math.min(rawSlippageBps, this.maxSlippageBps);

    // Actual filled qty (before impact scaling) — cap at what was requested.
    const actualFill = Math.min(filled / this.impactFactor, qty);

    return {
      fillPrice: avgPrice,
      fillQty: actualFill,
      slippage: Math.round(slippage * 100) / 100,
    };
  }
}
