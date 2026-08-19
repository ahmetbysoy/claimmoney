import type { Candle } from './types';

let _idCounter = 0;

export function generateId(prefix = 'cm'): string {
  _idCounter += 1;
  return `${prefix}_${_idCounter.toString(36).padStart(8, '0')}`;
}

export function resetIdCounter(): void {
  _idCounter = 0;
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = average(values);
  const variance = average(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(0);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      result.push(average(slice));
    }
  }
  return result;
}

export function rsi(values: number[], period = 14): number[] {
  if (values.length < period + 1) return values.map(() => 50);
  const result: number[] = new Array(period).fill(50);
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return result;
}

export function atr(candles: Candle[], period = 14): number[] {
  if (candles.length < 2) return candles.map(() => 0);
  const trs: number[] = [candles[0].h - candles[0].l];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    );
    trs.push(tr);
  }
  const result: number[] = [trs[0]];
  for (let i = 1; i < trs.length; i++) {
    result.push((result[i - 1] * (period - 1) + trs[i]) / period);
  }
  return result;
}

export function vwap(candles: Candle[]): number[] {
  let cumTPV = 0;
  let cumV = 0;
  return candles.map((c) => {
    const tp = (c.h + c.l + c.c) / 3;
    cumTPV += tp * c.v;
    cumV += c.v;
    return cumV === 0 ? c.c : cumTPV / cumV;
  });
}

export function bollingerBands(values: number[], period = 20, mult = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(0);
      lower.push(0);
    } else {
      const slice = values.slice(i - period + 1, i + 1);
      const std = standardDeviation(slice);
      upper.push(middle[i] + mult * std);
      lower.push(middle[i] - mult * std);
    }
  }
  return { upper, middle, lower };
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine = fastEma.map((v, i) => v - slowEma[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}
