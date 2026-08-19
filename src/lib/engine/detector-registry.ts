import type { Signal, DetectorConfig, DetectorResult, Regime } from './types';
import { generateId } from './helpers';

type DetectorFn = (state: Record<string, unknown>) => Signal[];

export class DetectorRegistry {
  private detectors: Map<string, { config: DetectorConfig; fn: DetectorFn }> = new Map();

  register(config: DetectorConfig, detector: DetectorFn): void {
    this.detectors.set(config.name, { config, fn: detector });
  }

  unregister(name: string): void {
    this.detectors.delete(name);
  }

  runAll(state: Record<string, unknown>): DetectorResult[] {
    const results: DetectorResult[] = [];
    for (const [name, { config, fn }] of this.detectors) {
      if (!config.enabled) {
        results.push({ detector: name, signals: [], processingTimeMs: 0 });
        continue;
      }
      const start = Date.now();
      let signals: Signal[] = [];
      try {
        signals = fn(state);
      } catch {
        signals = [];
      }
      const elapsed = Date.now() - start;
      results.push({ detector: name, signals, processingTimeMs: elapsed });
    }
    return results;
  }

  getDetectors(): DetectorConfig[] {
    return Array.from(this.detectors.values()).map((d) => ({ ...d.config }));
  }

  enable(name: string): void {
    const d = this.detectors.get(name);
    if (d) d.config.enabled = true;
  }

  disable(name: string): void {
    const d = this.detectors.get(name);
    if (d) d.config.enabled = false;
  }
}

// Built-in detectors
export function createMeanReversionDetector(): {
  config: DetectorConfig;
  fn: DetectorFn;
} {
  const config: DetectorConfig = {
    name: 'mean_reversion',
    version: '1.0.0',
    params: { period: 20, threshold: 2 },
    enabled: true,
  };

  const fn: DetectorFn = (state) => {
    const signals: Signal[] = [];
    const { candles, currentPrice, bb_lower, bb_upper, regime } = state as Record<string, unknown>;
    const cArr = (candles ?? []) as Array<{ c: number; ts: number }>;
    if (cArr.length < 20) return signals;

    const price = (currentPrice ?? 0) as number;
    const lower = (bb_lower ?? 0) as number;
    const upper = (bb_upper ?? 0) as number;

    if (price <= lower && price > 0) {
      signals.push({
        id: generateId('mr'),
        ts: cArr[cArr.length - 1].ts,
        detector: 'mean_reversion',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: 'long',
        confidence: 0.7,
        regime: (regime as Regime) ?? 'ranging',
        metadata: { type: 'oversold', price },
      });
    }
    if (price >= upper && price > 0) {
      signals.push({
        id: generateId('mr'),
        ts: cArr[cArr.length - 1].ts,
        detector: 'mean_reversion',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: 'short',
        confidence: 0.7,
        regime: (regime as Regime) ?? 'ranging',
        metadata: { type: 'overbought', price },
      });
    }
    return signals;
  };

  return { config, fn };
}

export function createMomentumDetector(): {
  config: DetectorConfig;
  fn: DetectorFn;
} {
  const config: DetectorConfig = {
    name: 'momentum',
    version: '1.0.0',
    params: { rsiPeriod: 14, overbought: 70, oversold: 30 },
    enabled: true,
  };

  const fn: DetectorFn = (state) => {
    const signals: Signal[] = [];
    const { rsi, candles, regime } = state as Record<string, unknown>;
    const rsiVal = (rsi ?? 50) as number;
    const cArr = (candles ?? []) as Array<{ ts: number }>; 

    if (cArr.length < 15) return signals;

    if (rsiVal < 30) {
      signals.push({
        id: generateId('mom'),
        ts: cArr[cArr.length - 1].ts,
        detector: 'momentum',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: 'long',
        confidence: (30 - rsiVal) / 30,
        regime: (regime as Regime) ?? 'trending_up',
        metadata: { rsi: rsiVal, type: 'oversold' },
      });
    }
    if (rsiVal > 70) {
      signals.push({
        id: generateId('mom'),
        ts: cArr[cArr.length - 1].ts,
        detector: 'momentum',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: 'short',
        confidence: (rsiVal - 70) / 30,
        regime: (regime as Regime) ?? 'trending_down',
        metadata: { rsi: rsiVal, type: 'overbought' },
      });
    }
    return signals;
  };

  return { config, fn };
}

export function createBreakoutDetector(): {
  config: DetectorConfig;
  fn: DetectorFn;
} {
  const config: DetectorConfig = {
    name: 'breakout',
    version: '1.0.0',
    params: { lookback: 20, threshold: 0.005 },
    enabled: true,
  };

  const fn: DetectorFn = (state) => {
    const signals: Signal[] = [];
    const { candles, currentPrice, regime } = state as Record<string, unknown>;
    const cArr = (candles ?? []) as Array<{ h: number; l: number; c: number; ts: number }>; 
    const price = (currentPrice ?? 0) as number;
    const lookback = 20;

    if (cArr.length < lookback + 1) return signals;

    const recent = cArr.slice(-lookback - 1, -1);
    const rangeHigh = Math.max(...recent.map((c) => c.h));
    const rangeLow = Math.min(...recent.map((c) => c.l));

    if (price > rangeHigh && rangeHigh > 0) {
      signals.push({
        id: generateId('brk'),
        ts: cArr[cArr.length - 1].ts,
        detector: 'breakout',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: 'long',
        confidence: 0.8,
        regime: (regime as Regime) ?? 'trending_up',
        metadata: { breakoutLevel: rangeHigh },
      });
    }
    if (price < rangeLow && rangeLow > 0) {
      signals.push({
        id: generateId('brk'),
        ts: cArr[cArr.length - 1].ts,
        detector: 'breakout',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: 'short',
        confidence: 0.8,
        regime: (regime as Regime) ?? 'trending_down',
        metadata: { breakoutLevel: rangeLow },
      });
    }
    return signals;
  };

  return { config, fn };
}

export function createVolumeSpikeDetector(): {
  config: DetectorConfig;
  fn: DetectorFn;
} {
  const config: DetectorConfig = {
    name: 'volume_spike',
    version: '1.0.0',
    params: { multiplier: 2.0 },
    enabled: true,
  };

  const fn: DetectorFn = (state) => {
    const signals: Signal[] = [];
    const { candles, avgVolume, regime } = state as Record<string, unknown>;
    const cArr = (candles ?? []) as Array<{ v: number; c: number; o: number; ts: number }>; 
    const avgVol = (avgVolume ?? 1) as number;

    if (cArr.length < 10) return signals;
    const last = cArr[cArr.length - 1];

    if (last.v > avgVol * 2 && avgVol > 0) {
      const bullish = last.c > last.o;
      signals.push({
        id: generateId('vol'),
        ts: last.ts,
        detector: 'volume_spike',
        symbol: (state.symbol as string) ?? 'UNKNOWN',
        side: bullish ? 'long' : 'short',
        confidence: Math.min(last.v / (avgVol * 2), 1),
        regime: (regime as Regime) ?? 'volatile',
        metadata: { volumeRatio: last.v / avgVol, bullish },
      });
    }
    return signals;
  };

  return { config, fn };
}
