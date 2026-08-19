// ClaimMoney v3 — Instrument Catalog
// Centralized instrument metadata per exchange.

import type { ExchangeId, Instrument, SymbolId, Level } from './events';

// In-memory catalog — in production this would come from exchange REST API
const catalog = new Map<string, Instrument>();

export function registerInstrument(inst: Instrument): void {
  const key = `${inst.exchange}:${inst.symbol}`;
  catalog.set(key, inst);
}

export function getInstrument(exchange: ExchangeId, symbol: SymbolId): Instrument | undefined {
  return catalog.get(`${exchange}:${symbol}`);
}

export function getOrThrow(exchange: ExchangeId, symbol: SymbolId): Instrument {
  const inst = getInstrument(exchange, symbol);
  if (!inst) throw new Error(`Instrument not found: ${exchange}:${symbol}`);
  return inst;
}

export function clearCatalog(): void {
  catalog.clear();
}

// --- Price/Qty helpers that use instrument metadata ---

export function tickToPrice(ticks: number, inst: Instrument): number {
  return ticks * inst.tickSize;
}

export function priceToTick(price: number, inst: Instrument): number {
  return Math.round(price / inst.tickSize);
}

export function roundPrice(price: number, inst: Instrument): number {
  const ticks = priceToTick(price, inst);
  return tickToPrice(ticks, inst);
}

export function roundQty(qty: number, inst: Instrument): number {
  const lots = Math.floor(qty / inst.lotSize);
  return lots * inst.lotSize;
}

export function notional(price: number, qty: number, multiplier = 1): number {
  return price * qty * multiplier;
}

export function isLevelValid(level: Level): boolean {
  return isFinite(level.price) && level.price > 0 && isFinite(level.qty) && level.qty >= 0;
}

export function sortBids(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => b.price - a.price);
}

export function sortAsks(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => a.price - b.price);
}

export function isValidBook(bids: Level[], asks: Level[]): boolean {
  if (bids.length === 0 || asks.length === 0) return false;
  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  return bestBid < bestAsk;
}

// Pre-register default instruments
registerInstrument({
  exchange: 'okx',
  symbol: 'BTC-USDT-SWAP',
  tickSize: 0.1,
  lotSize: 0.01,
  pricePrecision: 1,
  qtyPrecision: 2,
  contractMultiplier: 1,
  minNotional: 5,
  makerFee: 0.0002,
  takerFee: 0.0005,
});

registerInstrument({
  exchange: 'okx',
  symbol: 'ETH-USDT-SWAP',
  tickSize: 0.01,
  lotSize: 0.1,
  pricePrecision: 2,
  qtyPrecision: 1,
  contractMultiplier: 1,
  minNotional: 5,
  makerFee: 0.0002,
  takerFee: 0.0005,
});

registerInstrument({
  exchange: 'binance',
  symbol: 'BTCUSDT',
  tickSize: 0.1,
  lotSize: 0.001,
  pricePrecision: 1,
  qtyPrecision: 3,
  contractMultiplier: 1,
  minNotional: 5,
  makerFee: 0.0002,
  takerFee: 0.0005,
});
