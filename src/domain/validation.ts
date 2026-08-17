import type { MarketEvent, NormalizedDepth, NormalizedTrade } from '../types'

export interface ValidationResult<T> {
  ok: boolean
  value?: T
  errors: string[]
}

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0

export function validateTrade(trade: NormalizedTrade): ValidationResult<NormalizedTrade> {
  const errors: string[] = []
  if (!finitePositive(trade.price)) errors.push('trade.price must be finite and positive')
  if (!finitePositive(trade.qty)) errors.push('trade.qty must be finite and positive')
  if (!Number.isFinite(trade.ts) || trade.ts <= 0) errors.push('trade.ts must be a positive timestamp')
  if (trade.side !== 'buy' && trade.side !== 'sell') errors.push('trade.side is invalid')
  return { ok: errors.length === 0, value: errors.length ? undefined : trade, errors }
}

export function validateDepth(depth: NormalizedDepth): ValidationResult<NormalizedDepth> {
  const errors: string[] = []
  const validateSide = (levels: [number, number][], side: string) => {
    for (const [price, qty] of levels) {
      if (!finitePositive(price)) errors.push(`${side} price must be finite and positive`)
      if (!Number.isFinite(qty) || qty < 0) errors.push(`${side} qty must be finite and non-negative`)
    }
  }
  validateSide(depth.bids, 'bid')
  validateSide(depth.asks, 'ask')
  if (!Number.isFinite(depth.ts) || depth.ts <= 0) errors.push('depth.ts must be a positive timestamp')
  return { ok: errors.length === 0, value: errors.length ? undefined : depth, errors }
}

export function validateMarketEvent(event: MarketEvent): ValidationResult<MarketEvent> {
  const errors: string[] = []
  if (!event.symbol) errors.push('symbol is required')
  if (event.exchange !== 'okx' && event.exchange !== 'binance') errors.push('exchange is invalid')
  if (!Number.isFinite(event.eventTs) || event.eventTs <= 0) errors.push('eventTs is invalid')
  if (!Number.isFinite(event.receiveTs) || event.receiveTs <= 0) errors.push('receiveTs is invalid')
  if (event.kind === 'trade') errors.push(...validateTrade(event.trade).errors)
  if (event.kind === 'bookSnapshot' || event.kind === 'bookDelta') {
    errors.push(...validateDepth({ bids: event.bids, asks: event.asks, ts: event.eventTs }).errors)
  }
  if ((event.kind === 'bookSnapshot' || event.kind === 'bookDelta') && event.bids.length && event.asks.length) {
    const bestBid = Math.max(...event.bids.map(([p]) => p))
    const bestAsk = Math.min(...event.asks.map(([p]) => p))
    if (bestBid > bestAsk) errors.push('crossed order book')
  }
  return { ok: errors.length === 0, value: errors.length ? undefined : event, errors }
}
