// ClaimMoney v3 — Market Event Domain Types
// All raw market data flows through these discriminated unions.
// Rule: Raw event handlers MUST NOT produce signals.

export type ExchangeId = 'okx' | 'binance' | 'bybit' | 'mexc';
export type SymbolId = string;
export type AggressorSide = 'buy' | 'sell';

export interface Level {
  price: number;
  qty: number;
  tickSize?: number;
}

// --- Discriminated union: single canonical event type ---

export type MarketEvent =
  | MarketTradeEvent
  | MarketBookSnapshotEvent
  | MarketBookDeltaEvent
  | MarketMarkPriceEvent
  | MarketLiquidationEvent;

export interface MarketTradeEvent {
  readonly kind: 'trade';
  readonly exchange: ExchangeId;
  readonly symbol: SymbolId;
  readonly eventTs: number;
  readonly receiveTs: number;
  readonly tradeId: string;
  readonly price: number;
  readonly qty: number;
  readonly aggressor: AggressorSide;
}

export interface MarketBookSnapshotEvent {
  readonly kind: 'bookSnapshot';
  readonly exchange: ExchangeId;
  readonly symbol: SymbolId;
  readonly eventTs: number;
  readonly receiveTs: number;
  readonly seq: number;
  readonly bids: readonly Level[];
  readonly asks: readonly Level[];
  readonly checksum?: number;
}

export interface MarketBookDeltaEvent {
  readonly kind: 'bookDelta';
  readonly exchange: ExchangeId;
  readonly symbol: SymbolId;
  readonly eventTs: number;
  readonly receiveTs: number;
  readonly firstSeq: number;
  readonly lastSeq: number;
  readonly bids: readonly Level[];
  readonly asks: readonly Level[];
  readonly checksum?: number;
}

export interface MarketMarkPriceEvent {
  readonly kind: 'markPrice';
  readonly exchange: ExchangeId;
  readonly symbol: SymbolId;
  readonly eventTs: number;
  readonly receiveTs: number;
  readonly price: number;
}

export interface MarketLiquidationEvent {
  readonly kind: 'liquidation';
  readonly exchange: ExchangeId;
  readonly symbol: SymbolId;
  readonly eventTs: number;
  readonly receiveTs: number;
  readonly side: 'long' | 'short';
  readonly price: number;
  readonly qty: number;
}

// --- Helpers ---

export function isTradeEvent(e: MarketEvent): e is MarketTradeEvent {
  return e.kind === 'trade';
}

export function isBookSnapshotEvent(e: MarketEvent): e is MarketBookSnapshotEvent {
  return e.kind === 'bookSnapshot';
}

export function isBookDeltaEvent(e: MarketEvent): e is MarketBookDeltaEvent {
  return e.kind === 'bookDelta';
}

export function isMarkPriceEvent(e: MarketEvent): e is MarketMarkPriceEvent {
  return e.kind === 'markPrice';
}

export function isLiquidationEvent(e: MarketEvent): e is MarketLiquidationEvent {
  return e.kind === 'liquidation';
}

// --- Canonical time ---
// Every event carries eventTs + receiveTs.
// Replay and live produce the same result using eventTs.
// receiveTs is for latency telemetry only.

export function eventTime(e: MarketEvent): number {
  return e.eventTs;
}

// --- Instrument metadata ---

export interface Instrument {
  exchange: ExchangeId;
  symbol: SymbolId;
  tickSize: number;
  lotSize: number;
  pricePrecision: number;
  qtyPrecision: number;
  contractMultiplier: number;
  minNotional: number;
  makerFee: number;
  takerFee: number;
}

// Default BTC-USDT-SWAP instrument
export const DEFAULT_INSTRUMENT: Instrument = {
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
};
