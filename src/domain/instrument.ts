export interface InstrumentSpec {
  symbol: string
  tickSize: number
  lotSize: number
  contractMultiplier: number
  quoteAsset: string
  maxLeverage: number
}

export const DEFAULT_INSTRUMENT: InstrumentSpec = {
  symbol: 'BTCUSDT',
  tickSize: 0.1,
  lotSize: 0.001,
  contractMultiplier: 1,
  quoteAsset: 'USDT',
  maxLeverage: 20
}

export function decimalsForStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 8
  const text = step.toString().toLowerCase()
  if (text.includes('e-')) return Number(text.split('e-')[1] ?? 8)
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0
}

export function roundToStep(value: number, step: number, mode: 'nearest' | 'down' | 'up' = 'nearest'): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value
  const scaled = value / step
  const units = mode === 'down' ? Math.floor(scaled) : mode === 'up' ? Math.ceil(scaled) : Math.round(scaled)
  return Number((units * step).toFixed(decimalsForStep(step)))
}

export function inferInstrument(symbol: string, price = 0): InstrumentSpec {
  const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const tickSize = price >= 1000 ? 0.1 : price >= 10 ? 0.01 : price >= 1 ? 0.001 : price >= 0.1 ? 0.0001 : 0.000001
  return { ...DEFAULT_INSTRUMENT, symbol: normalized || DEFAULT_INSTRUMENT.symbol, tickSize }
}
