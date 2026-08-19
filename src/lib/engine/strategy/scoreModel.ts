import type { FeatureFrame } from '../domain/frames';

export interface ScoreWeights {
  wCVD: number;
  wOBI: number;
  wVelocity: number;
  wMicro: number;
  wVPIN: number;
  wDetector: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = { wCVD: 0.25, wOBI: 0.15, wVelocity: 0.15, wMicro: 0.1, wVPIN: 0.05, wDetector: 0.3 };

export function normalizeWeights(w: ScoreWeights): ScoreWeights {
  const total = w.wCVD + w.wOBI + w.wVelocity + wMicro + wVPIN + wDetector;
  if (total <= 0) return DEFAULT_WEIGHTS;
  return {
    wCVD: w.wCVD / total, wOBI: w.wOBI / total, wVelocity: w.wVelocity / total,
    wMicro: w.wMicro / total, wVPIN: w.wVPIN / total, wDetector: w.wDetector / total,
  };
}

export function computeCompositeScore(frame: FeatureFrame, weights: ScoreWeights = DEFAULT_WEIGHTS): number {
  const nw = normalizeWeights(weights);
  let score = 0;
  let weightSum = 0;
  const features = [
    { v: frame.cvdZ, w: nw.wCVD },
    { v: frame.obi, w: nw.wOBI },
    { v: frame.velocityZ, w: nw.wVelocity },
    { v: frame.microDev, w: nw.wMicro },
    { v: frame.vpin, w: nw.wVPIN },
    { v: frame.detectorScore, w: nw.wDetector },
  ];
  for (const { v, w } of features) {
    if (v.valid) {
      const clamped = Math.max(-2, Math.min(2, v.value));
      score += clamped * w;
      weightSum += w;
    }
  }
  return weightSum > 0 ? Math.max(-1, Math.min(1, score / weightSum)) : 0;
}