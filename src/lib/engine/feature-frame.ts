import type { Candle, FeatureRow, FeatureFrame } from './types';
import { sma, ema, rsi, atr, vwap, bollingerBands, macd, average } from './helpers';

type CustomFeatureFn = (candles: Candle[]) => number[];

export class FeatureFrameBuilder {
  private customFeatures: Map<string, CustomFeatureFn> = new Map();

  addCustomFeature(name: string, fn: CustomFeatureFn): void {
    this.customFeatures.set(name, fn);
  }

  buildFrame(candles: Candle[], symbol: string, interval: string): FeatureFrame {
    if (candles.length === 0) {
      return { symbol, interval, rows: [] };
    }

    const closes = candles.map((c) => c.c);
    const highs = candles.map((c) => c.h);
    const lows = candles.map((c) => c.l);
    const volumes = candles.map((c) => c.v);

    const sma20 = sma(closes, 20);
    const sma50 = sma(closes, 50);
    const ema9 = ema(closes, 9);
    const ema21 = ema(closes, 21);
    const rsi14 = rsi(closes, 14);
    const atr14 = atr(candles, 14);
    const vwapVals = vwap(candles);
    const bb = bollingerBands(closes, 20, 2);
    const macdVals = macd(closes);

    const avgVol = average(volumes);
    const avgHL = average(highs.map((h, i) => h - lows[i]));

    const rows: FeatureRow[] = candles.map((candle, i) => {
      const features: Record<string, number> = {
        sma_20: sma20[i],
        sma_50: sma50[i],
        ema_9: ema9[i],
        ema_21: ema21[i],
        rsi_14: rsi14[i],
        atr_14: atr14[i],
        vwap: vwapVals[i],
        bb_upper: bb.upper[i],
        bb_middle: bb.middle[i],
        bb_lower: bb.lower[i],
        macd: macdVals.macd[i],
        macd_signal: macdVals.signal[i],
        macd_hist: macdVals.histogram[i],
        volume_ratio: avgVol > 0 ? candle.v / avgVol : 0,
        range: candle.h - candle.l,
        body: Math.abs(candle.c - candle.o),
        upper_wick: candle.h - Math.max(candle.o, candle.c),
        lower_wick: Math.min(candle.o, candle.c) - candle.l,
        avg_range: avgHL,
      };

      // Custom features
      this.customFeatures.forEach((fn, name) => {
        const vals = fn(candles.slice(0, i + 1));
        features[name] = vals[vals.length - 1] ?? 0;
      });

      // Label: future return (if available)
      if (i < candles.length - 1) {
        features.label = (candles[i + 1].c - candle.c) / candle.c;
      }

      return { ts: candle.ts, symbol, features };
    });

    return { symbol, interval, rows };
  }
}
