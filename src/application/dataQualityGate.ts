import type { DataQuality } from '../types'

export interface DataQualityInput {
  now: number; lastTradeTs: number; lastBookTs: number; bookSynced: boolean
  requiredFeaturesValid: boolean; tradeStaleMs?: number; bookStaleMs?: number
}
export interface DataQualityResult { quality: DataQuality; reasons: string[] }

export class DataQualityGate {
  evaluate(input: DataQualityInput): DataQualityResult {
    const tradeLimit = input.tradeStaleMs ?? 5000, bookLimit = input.bookStaleMs ?? 1500
    const reasons: string[] = []
    if (!input.bookSynced) reasons.push('order book is not synchronized')
    if (!input.lastTradeTs || input.now - input.lastTradeTs > tradeLimit) reasons.push('trade stream is stale')
    if (!input.lastBookTs || input.now - input.lastBookTs > bookLimit) reasons.push('book stream is stale')
    if (!input.bookSynced || !input.lastTradeTs || !input.lastBookTs) return { quality: 'invalid', reasons }
    if (input.now - input.lastTradeTs > tradeLimit || input.now - input.lastBookTs > bookLimit) return { quality: 'degraded', reasons }
    if (!input.requiredFeaturesValid) return { quality: 'warming', reasons: ['required features are warming up'] }
    return { quality: 'good', reasons: [] }
  }
}
