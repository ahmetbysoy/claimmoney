import { normalizeWeights, type Weights } from './engine'

export interface AggregatorInput {
  cvdZ: number; obi: number; velocityZ: number; microDev: number
  vpinAdj?: number; vpin?: number; vpinValid?: boolean
  detectorBull: number; detectorBear: number; divergenceAdj?: number
  validity?: Partial<Record<'cvd' | 'obi' | 'velocity' | 'micro' | 'detector', boolean>>
}
export type AggregatorWeights = Required<Weights>

export function computeDetectorScore(bull: number, bear: number): number {
  if (!Number.isFinite(bull) || !Number.isFinite(bear)) return 0
  const total = Math.abs(bull) + Math.abs(bear)
  if (total === 0) return 0
  return Math.max(-1, Math.min(1, (bull - bear) / Math.max(100, total)))
}

export function aggregateScore(input: AggregatorInput, weights: AggregatorWeights, divergenceAdj = input.divergenceAdj ?? 0) {
  const normalized = normalizeWeights(weights)
  const detectorScore = computeDetectorScore(input.detectorBull, input.detectorBear)
  const validity = { cvd: true, obi: true, velocity: true, micro: true, detector: true, ...input.validity }
  const components = [
    { id: 'cvd', valid: validity.cvd, value: input.cvdZ, weight: normalized.w1 },
    { id: 'obi', valid: validity.obi, value: input.obi, weight: normalized.w2 },
    { id: 'velocity', valid: validity.velocity, value: input.velocityZ, weight: normalized.w3 },
    { id: 'micro', valid: validity.micro, value: input.microDev, weight: normalized.w4 },
    { id: 'detector', valid: validity.detector, value: detectorScore, weight: normalized.w6 }
  ]
  const validWeight = components.filter(component => component.valid && Number.isFinite(component.value)).reduce((sum, component) => sum + component.weight, 0)
  const directional = components.reduce((sum, component) => component.valid && Number.isFinite(component.value) ? sum + component.value * component.weight / (validWeight || 1) : sum, 0)

  // VPIN is toxicity, not direction. It scales conviction instead of selecting a side.
  const vpin = input.vpin ?? Math.max(0, Math.min(1, (input.vpinAdj ?? 0) + 0.3))
  const toxicityMultiplier = input.vpinValid === false ? 0.85 : Math.max(0.55, 1 - Math.max(0, vpin - 0.3) * normalized.w5 * 2)
  const score = Math.max(-3, Math.min(3, directional * toxicityMultiplier + divergenceAdj))
  return {
    score, detectorScore, toxicityMultiplier,
    breakdown: { cvdZ: input.cvdZ, obi: input.obi, velocityZ: input.velocityZ, microDev: input.microDev,
      vpin, detectorScore, divergenceAdj, validWeight }
  }
}
