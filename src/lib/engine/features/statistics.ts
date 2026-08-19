import type { FeatureValue } from '../domain/frames';

export function onlineEMA(prev: number, value: number, alpha: number): number {
  return value * alpha + prev * (1 - alpha);
}

export function robustStd(values: number[], useMAD = false): number {
  if (values.length < 2) return 0;
  if (useMAD) {
    const med = median(values);
    const devs = values.map(v => Math.abs(v - med));
    return median(devs) * 1.4826;
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function zScore(value: number, mean: number, sigma: number): number {
  if (sigma === 0) return 0;
  return (value - mean) / sigma;
}
