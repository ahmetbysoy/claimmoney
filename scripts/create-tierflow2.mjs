const fs = require('fs');
const base='/home/z/my-project/src/lib/engine';
const F={};
function w(p,c){const d=p.substring(0,p.lastIndexOf('/'));fs.mkdirSync(d,{recursive:true});fs.writeFileSync(p,c);}

// === DOMAIN ===
F['domain/events.ts']=`import type { Side } from './types';

export type ExchangeId = 'okx' | 'binance' | 'bybit' | 'mexc';
export type SymbolId = string;

export interface Level { price: number; qty: number; }

export type MarketEvent =
  | { kind: 'trade'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; tradeId: string; price: number; qty: number; aggressor: Side }
  | { kind: 'bookSnapshot'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; seq: number; bids: Level[]; asks: Level[]; checksum?: number }
  | { kind: 'bookDelta'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; firstSeq: number; lastSeq: number; bids: Level[]; asks: Level[]; checksum?: number }
  | { kind: 'markPrice'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; price: number };
`;

F['domain/frames.ts']=`import type { FeatureValue } from './signals';

export interface FeatureValue {
  value: number;
  valid: boolean;
  warmup: number;
  ageMs: number;
  evidence?: Record<string, number>;
}

export interface FeatureFrame {
  id: string;
  symbol: string;
  eventTs: number;
  dataQuality: 'good' | 'degraded' | 'invalid';
  cvdZ: FeatureValue;
  obi: FeatureValue;
  velocityZ: FeatureValue;
  microDev: FeatureValue;
  vpin: FeatureValue;
  detectorScore: FeatureValue;
  volatility: FeatureValue;
}

export function emptyFrame(symbol: string, eventTs: number): FeatureFrame {
  const inv = (): FeatureValue => ({ value: 0, valid: false, warmup: Infinity, ageMs: Infinity });
  return { id: '', symbol, eventTs, dataQuality: 'invalid', cvdZ: inv(), obi: inv(), velocityZ: inv(), microDev: inv(), vpin: inv(), detectorScore: inv(), volatility: inv() };
}
`;

F['domain/signals.ts']=`export interface FilterDecision {
  id: string;
  mode: 'hard-veto' | 'soft-penalty';
  pass: boolean;
  reason: string;
  adjustment: number;
}

export interface ApprovedSignal {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  eventTs: number;
  price: number;
  score: number;
  calibratedProbability: number | null;
  frameId: string;
  strategyVersion: string;
  filters: FilterDecision[];
}
`;

F['domain/types.ts']=`export type Side = 'buy' | 'sell';
export type SignalDirection = 'BUY' | 'SELL';
export type Regime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'stale' | 'resyncing' | 'rate_limited';
`;

// === INFRASTRUCTURE ===
F['infrastructure/clock.ts']=`let _now = Date.now;
export function setClock(fn: () => number): void { _now = fn; }
export function now(): number { return _now(); }
export function resetClock(): void { _now = Date.now; }
`;

F['infrastructure/eventBus.ts']=`type Listener<T> = (data: T) => void;

export class EventBus<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<Listener<unknown>>>();

  on<K extends keyof T>(event: K, fn: Listener<T[K]>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    const wrapped = fn as Listener<unknown>;
    set.add(wrapped);
    return () => set.delete(wrapped);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const set = this.listeners.get(event);
    if (set) set.forEach(fn => { try { fn(data); } catch { /* telemetry */ } });
  }

  removeAll(): void { this.listeners.clear(); }
}
`;

F['infrastructure/wsSupervisor.ts']=`import type { ConnectionState } from '../domain/types';
import { EventBus } from './eventBus';

interface WSState {
  connectionState: ConnectionState;
  lastMessageAt: number;
  reconnectCount: number;
  messagesReceived: number;
}

export class WsSupervisor {
  private state: WSState;
  public events: EventBus<{ stateChange: ConnectionState; message: unknown; reconnect: number }>;

  constructor() {
    this.state = { connectionState: 'disconnected', lastMessageAt: 0, reconnectCount: 0, messagesReceived: 0 };
    this.events = new EventBus();
  }

  setConnected(): void {
    const prev = this.state.connectionState;
    this.state.connectionState = 'connected';
    this.state.lastMessageAt = Date.now();
    if (prev !== 'connected') this.events.emit('stateChange', 'connected');
  }

  setDisconnected(): void {
    const prev = this.state.connectionState;
    this.state.connectionState = 'disconnected';
    if (prev !== 'disconnected') this.events.emit('stateChange', 'disconnected');
  }

  setDegraded(): void {
    this.state.connectionState = 'degraded';
    this.events.emit('stateChange', 'degraded');
  }

  setStale(thresholdMs: number): void {
    if (Date.now() - this.state.lastMessageAt > thresholdMs) {
      this.state.connectionState = 'stale';
      this.events.emit('stateChange', 'stale');
    }
  }

  onMessage(): void {
    this.state.messagesReceived++;
    this.state.lastMessageAt = Date.now();
    if (this.state.connectionState === 'stale') this.setConnected();
  }

  onReconnect(): void {
    this.state.reconnectCount++;
    this.events.emit('reconnect', this.state.reconnectCount);
  }

  getState(): Readonly<WSState> { return { ...this.state }; }

  reset(): void {
    this.state = { connectionState: 'disconnected', lastMessageAt: 0, reconnectCount: 0, messagesReceived: 0 };
  }
}
`;

console.log('infrastructure OK');
for (const [p] of Object.keys(F)) console.log('  ' + p);
for (const [p, c] of Object.entries(F)) { const d = base + '/' + p; const dir = d.substring(0, d.lastIndexOf('/')); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(d, c, 'utf8'); }
console.log('Total files: ' + Object.keys(F).length);
