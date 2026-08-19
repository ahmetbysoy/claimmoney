import type { Candle, Regime } from './types';
import { atr, sma, average } from './helpers';

export class RegimeClassifier {
  classify(candles: Candle[]): Regime {
    if (candles.length < 30) return 'ranging';

    const closes = candles.map((c) => c.c);
    const atrVals = atr(candles, 14);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const lastAtr = atrVals[atrVals.length - 1];
    const lastPrice = closes[closes.length - 1];
    const lastSma20 = sma20[sma20.length - 1];
    const lastSma50 = sma50[sma50.length - 1];

    // Volatility check: if ATR > 2% of price, volatile
    if (lastPrice > 0 && lastAtr / lastPrice > 0.02) return 'volatile';

    // Trending check: SMA20 vs SMA50
    if (candles.length >= 50) {
      if (lastSma20 > lastSma50 && lastPrice > lastSma20) return 'trending_up';
      if (lastSma20 < lastSma50 && lastPrice < lastSma20) return 'trending_down';
    }

    // Shorter trend check
    const recent20 = closes.slice(-20);
    const first5Avg = average(recent20.slice(0, 5));
    const last5Avg = average(recent20.slice(-5));
    const change = (last5Avg - first5Avg) / (first5Avg || 1);

    if (change > 0.005) return 'trending_up';
    if (change < -0.005) return 'trending_down';

    return 'ranging';
  }

  getRegimeProbability(candles: Candle[]): Record<Regime, number> {
    if (candles.length < 30) {
      return { trending_up: 0.25, trending_down: 0.25, ranging: 0.25, volatile: 0.25 };
    }

    const closes = candles.map((c) => c.c);
    const atrVals = atr(candles, 14);
    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const lastAtr = atrVals[atrVals.length - 1];
    const lastPrice = closes[closes.length - 1];
    const lastSma20 = sma20[sma20.length - 1];
    const lastSma50 = sma50[sma50.length - 1];

    const volScore = lastPrice > 0 ? Math.min(lastAtr / lastPrice / 0.02, 1) : 0;
    const trendScore =
      candles.length >= 50
        ? Math.abs(lastSma20 - lastSma50) / (lastSma50 || 1) / 0.01
        : 0;

    const dirScore =
      lastSma20 > lastSma50 ? 1 : lastSma20 < lastSma50 ? -1 : 0;

    const volatile = volScore * 0.6;
    const trending = Math.min(trendScore, 1) * 0.4;
    const upTrend = dirScore > 0 ? trending : 0;
    const downTrend = dirScore < 0 ? trending : 0;
    const ranging = Math.max(1 - volatile - trending, 0);

    const total = volatile + upTrend + downTrend + ranging || 1;
    return {
      trending_up: upTrend / total,
      trending_down: downTrend / total,
      ranging: ranging / total,
      volatile: volatile / total,
    };
  }

  getTransitionHistory(
    candles: Candle[]
  ): { ts: number; regime: Regime }[] {
    const history: { ts: number; regime: Regime }[] = [];
    let lastRegime: Regime | null = null;
    const step = Math.max(1, Math.floor(candles.length / 100));

    for (let i = 20; i < candles.length; i += step) {
      const window = candles.slice(0, i + 1);
      const regime = this.classify(window);
      if (regime !== lastRegime) {
        history.push({ ts: candles[i].ts, regime });
        lastRegime = regime;
      }
    }
    return history;
  }
}
