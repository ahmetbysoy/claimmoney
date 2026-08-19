import type { FeatureFrame } from '../domain/frames';
import type { FilterDecision } from '../domain/signals';

export interface FilterResult {
  passed: boolean;
  decisions: FilterDecision[];
}

export function runFilters(frame: FeatureFrame, params?: { flatThreshold?: number; minOBI?: number; vpinVeto?: number }): FilterResult {
  const flatThreshold = params?.flatThreshold ?? 0.0005;
  const minOBI = params?.minOBI ?? 0.06;
  const vpinVeto = params?.vpinVeto ?? 0.8;
  const decisions: FilterDecision[] = [];
  let passed = true;
  const vol = frame.volatility;
  if (vol.valid && vol.value < flatThreshold) {
    decisions.push({ id: 'flat_market', mode: 'hard-veto', pass: false, reason: 'Market too flat', adjustment: 0 });
    passed = false;
  }
  if (frame.obi.valid && Math.abs(frame.obi.value) < minOBI) {
    decisions.push({ id: 'obi_confluence', mode: 'hard-veto', pass: false, reason: 'OBI too low', adjustment: 0 });
    passed = false;
  }
  if (frame.vpin.valid && frame.vpin.value > vpinVeto) {
    decisions.push({ id: 'vpin_veto', mode: 'hard-veto', pass: false, reason: 'VPIN too toxic', adjustment: -0.3 });
    passed = false;
  }
  if (frame.dataQuality === 'invalid') {
    decisions.push({ id: 'data_quality', mode: 'hard-veto', pass: false, reason: 'Invalid data quality', adjustment: 0 });
    passed = false;
  }
  return { passed, decisions };
}
