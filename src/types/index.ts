export type Side = 'buy' | 'sell'
export type SignalSide = 'BUY' | 'SELL'
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'resyncing' | 'degraded'
export type TabId = 'radar' | 'chart' | 'signals' | 'microstructure' | 'paper' | 'research' | 'settings'
export type Source = 'okx' | 'binance'
export type DepthKind = 'snapshot' | 'delta'

export interface EventMeta {
  exchange: Source
  symbol: string
  eventTs: number
  receiveTs: number
}

export interface NormalizedTrade {
  price: number
  priceStr?: string
  qty: number
  side: Side
  ts: number
  tradeId?: string
  notional?: number
  exchange?: Source
  symbol?: string
  receiveTs?: number
}

export interface NormalizedDepth {
  bids: [number, number][]
  asks: [number, number][]
  ts: number
  kind?: DepthKind
  firstSeq?: number
  lastSeq?: number
  checksum?: number
  exchange?: Source
  symbol?: string
  receiveTs?: number
}

export interface NormalizedMark {
  price: number
  priceStr?: string
  ts: number
  exchange?: Source
  symbol?: string
  receiveTs?: number
}

export type MarketEvent =
  | ({ kind: 'trade'; trade: NormalizedTrade } & EventMeta)
  | ({ kind: 'bookSnapshot'; bids: [number, number][]; asks: [number, number][]; seq: number; checksum?: number } & EventMeta)
  | ({ kind: 'bookDelta'; bids: [number, number][]; asks: [number, number][]; firstSeq: number; lastSeq: number; checksum?: number } & EventMeta)
  | ({ kind: 'markPrice'; price: number; priceStr?: string } & EventMeta)
  | ({ kind: 'liquidation'; side: 'long' | 'short'; price: number; qty: number; notional: number } & EventMeta)

export interface Candle {
  time: number
  open: number
  openStr?: string
  high: number
  low: number
  close: number
  closeStr?: string
  volume: number
  buyVolume?: number
  sellVolume?: number
  complete?: boolean
}

export interface FeatureValue {
  value: number
  valid: boolean
  warmup: number
  ageMs: number
  evidence?: Record<string, number>
}

export type DataQuality = 'good' | 'degraded' | 'invalid' | 'warming'

export interface FeatureFrame {
  id: string
  symbol: string
  exchange: Source
  eventTs: number
  receiveTs: number
  quality: DataQuality
  cvdNorm: FeatureValue
  cvdZ: FeatureValue
  obi: FeatureValue
  velocityZ: FeatureValue
  microDev: FeatureValue
  vpin: FeatureValue
  detectorScore: FeatureValue
  volatility: FeatureValue
  divergence: FeatureValue
  price: number
  priceStr?: string
  spread: number
}

export interface FilterDecision {
  id: string
  mode: 'hard-veto' | 'soft-penalty'
  pass: boolean
  reason: string
  adjustment: number
}

export interface SignalResearchContext {
  regime: string
  regimeConfidence: number
  dataQuality: DataQuality
  detectorTypes: string[]
  volatilityBps: number
  vpin: number
  spreadBps: number
  isTest: boolean
}

export interface Signal {
  id: string
  symbol?: string
  exchange?: Source
  side: SignalSide
  price: number
  priceStr?: string
  confidence: number
  calibratedProbability?: number | null
  score: number
  breakdown: {
    cvd: number
    obi: number
    vel: number
    micro?: number
    vpin?: number
    detector?: number
    divergence?: number
    w1: number
    w2: number
    w3: number
    w4?: number
    w5?: number
    w6?: number
  }
  filters?: FilterDecision[]
  frameId?: string
  strategyVersion?: string
  research?: SignalResearchContext
  ts: number
}

export interface Metrics {
  cvd: number
  cvdNorm: number
  cvdZ: number
  obi: number
  obiRaw: number
  velocity: number
  velocityZ: number
  microprice: number
  microDev: number
  vpin: number
  vpinLabel: string
  detectorScore: number
  volatility: number
  divergence: number
  score: number
  quality: DataQuality
  filterReasons: string[]
  price: number
  priceStr?: string
}
