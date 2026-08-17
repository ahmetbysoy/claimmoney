import type { SignalSide } from '../types'

export interface CalibrationObservation { score: number; side: SignalSide; won: boolean; ts: number; strategyVersion: string }
export interface CalibrationBin { lower: number; upper: number; wins: number; total: number; probability: number }

export class ProbabilityCalibrator {
  private observations: CalibrationObservation[] = []
  constructor(private readonly maxObservations = 2000, private readonly binWidth = 0.25, private readonly minSamples = 20) {}

  add(observation: CalibrationObservation): void {
    if (!Number.isFinite(observation.score)) return
    this.observations.push({ ...observation })
    if (this.observations.length > this.maxObservations) this.observations.splice(0, this.observations.length - this.maxObservations)
  }

  probability(score: number, strategyVersion?: string): number | null {
    const magnitude = Math.abs(score)
    const lower = Math.floor(magnitude / this.binWidth) * this.binWidth
    const eligible = this.observations.filter(item => Math.abs(item.score) >= lower && Math.abs(item.score) < lower + this.binWidth && (!strategyVersion || item.strategyVersion === strategyVersion))
    if (eligible.length < this.minSamples) return null
    const wins = eligible.filter(item => item.won).length
    return (wins + 2) / (eligible.length + 4) // Beta(2,2) shrinkage
  }

  bins(strategyVersion?: string): CalibrationBin[] {
    const result: CalibrationBin[] = []
    for (let lower = 0; lower < 3; lower += this.binWidth) {
      const eligible = this.observations.filter(item => Math.abs(item.score) >= lower && Math.abs(item.score) < lower + this.binWidth && (!strategyVersion || item.strategyVersion === strategyVersion))
      const wins = eligible.filter(item => item.won).length
      result.push({ lower, upper: lower + this.binWidth, wins, total: eligible.length, probability: eligible.length ? (wins + 2) / (eligible.length + 4) : 0.5 })
    }
    return result
  }

  export(): string { return JSON.stringify({ version: 1, observations: this.observations }) }
  import(serialized: string): void {
    const parsed = JSON.parse(serialized)
    if (parsed?.version !== 1 || !Array.isArray(parsed.observations)) throw new Error('Unsupported calibration payload')
    this.observations = parsed.observations.filter((item: CalibrationObservation) => Number.isFinite(item.score) && typeof item.won === 'boolean').slice(-this.maxObservations)
  }
  clear(): void { this.observations = [] }
  size(): number { return this.observations.length }
}
