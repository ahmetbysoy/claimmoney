// ClaimMoney v3 — Feature Frame Domain Types
// A FeatureFrame is the single canonical snapshot at 10Hz cadence.
// Feature validity is mandatory: valid=false means IGNORE, not zero.

import type { SymbolId } from './events';

export interface FeatureValue {
  value: number;
  valid: boolean;
  warmup: number;       // 0..N how many samples collected
  ageMs: number;        // ms since last update
  evidence?: Record<string, number>;
}

export type DataQuality = 'good' | 'degraded' | 'invalid';

export interface FeatureFrame {
  id: string;
  symbol: SymbolId;
  eventTs: number;
  dataQuality: DataQuality;
  cvdZ: FeatureValue;
  obi: FeatureValue;
  velocityZ: FeatureValue;
  microDev: FeatureValue;
  vpin: FeatureValue;
  detectorScore: FeatureValue;
  volatility: FeatureValue;
}

// Helpers

export function emptyFeatureValue(ts: number): FeatureValue {
  return { value: 0, valid: false, warmup: 0, ageMs: ts > 0 ? Date.now() - ts : 0 };
}

export function validFeatureValue(value: number, warmup: number, ageMs: number, evidence?: Record<string, number>): FeatureValue {
  return { value, valid: true, warmup, ageMs, evidence };
}

export function invalidFeatureValue(ageMs: number): FeatureValue {
  return { value: 0, valid: false, warmup: 0, ageMs };
}

export function computeDataQuality(features: FeatureValue[]): DataQuality {
  const validCount = features.filter(f => f.valid).length;
  if (validCount >= 5) return 'good';
  if (validCount >= 3) return 'degraded';
  return 'invalid';
}

export function getFrameFeatureValues(frame: FeatureFrame): FeatureValue[] {
  return [frame.cvdZ, frame.obi, frame.velocityZ, frame.microDev, frame.vpin, frame.detectorScore, frame.volatility];
}

export function countValidFeatures(frame: FeatureFrame): number {
  return getFrameFeatureValues(frame).filter(f => f.valid).length;
}
