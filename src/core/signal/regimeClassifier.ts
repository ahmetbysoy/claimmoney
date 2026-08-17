import type { FeatureFrame } from '../../types'

export type MarketRegime = 'warming' | 'stale' | 'quiet' | 'trending' | 'volatile' | 'toxic'
export interface RegimeResult { regime: MarketRegime; confidence: number; reasons: string[] }

export function classifyRegime(frame: FeatureFrame): RegimeResult {
  if (frame.quality === 'warming') return { regime: 'warming', confidence: 1, reasons: ['Features are warming up'] }
  if (frame.quality === 'invalid' || frame.quality === 'degraded') return { regime: 'stale', confidence: 1, reasons: [`Data quality ${frame.quality}`] }
  if (frame.vpin.valid && frame.vpin.value >= 0.7) return { regime: 'toxic', confidence: Math.min(1, frame.vpin.value), reasons: [`VPIN ${frame.vpin.value.toFixed(2)}`] }
  if (frame.volatility.valid && frame.volatility.value > 8) return { regime: 'volatile', confidence: Math.min(1, frame.volatility.value / 20), reasons: ['High realized volatility'] }
  const trendStrength = Math.max(Math.abs(frame.cvdZ.value), Math.abs(frame.velocityZ.value))
  if (trendStrength > 1 && Math.sign(frame.cvdZ.value) === Math.sign(frame.velocityZ.value)) return { regime: 'trending', confidence: Math.min(1, trendStrength / 3), reasons: ['CVD and velocity aligned'] }
  return { regime: 'quiet', confidence: 0.6, reasons: ['No dominant directional regime'] }
}
