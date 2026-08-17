export type PlanDirection = 'LONG' | 'SHORT' | 'NEUTRAL'
export type SignalBias = 'bullish' | 'bearish' | 'warning'

export interface MicroSignal {
  id: string
  type: string
  bias: SignalBias
  confidence: number
  baseConfidence?: number
  description: string
  price: number
  evidence: Record<string, unknown>
  ts: number
  decay: number
  expiresAt: number
}

export interface WallEntry {
  price: number
  qty: number
  notional: number
  persistence: number
}

export interface TradePlan {
  direction: PlanDirection
  confidence: number
  entry?: number
  stop?: number
  tp1?: number
  tp2?: number
  rr?: number
  ts: number
  reason?: string
  walls?: { strongWallBid?: WallEntry; strongWallAsk?: WallEntry }
}

export interface PositionSize {
  riskPct: number
  qty: number
  notional: number
  contractMultiplier: number
  margin: number
  leverage: number
  fee: number
  breakEven: number
  /** Simplified isolated-margin screening estimate; not an exchange liquidation quote. */
  liqPriceEstimate: number
  maxRiskUSD: number
  rr: number
}
