import type { Level } from '../domain/events';

type ConnectionState = 'disconnected' | 'connected' | 'resyncing';

export interface BookState {
  bids: Level[];
  asks: Level[];
  mid: number;
  spread: number;
  bestBid: number;
  bestAsk: number;
  lastSeq: number;
  lastUpdateTs: number;
  connectionState: ConnectionState;
}

export class OrderBook {
  private state: BookState;
  private maxLevels: number;

  constructor(maxLevels = 50) {
    this.maxLevels = maxLevels;
    this.state = this.emptyState();
  }

  private emptyState(): BookState {
    return { bids: [], asks: [], mid: 0, spread: 0, bestBid: 0, bestAsk: 0, lastSeq: 0, lastUpdateTs: 0, connectionState: 'disconnected' as ConnectionState };
  }

  applySnapshot(bids: Level[], asks: Level[], seq: number, ts: number): void {
    this.state.bids = this.sortLevels(bids, 'bid');
    this.state.asks = this.sortLevels(asks, 'ask');
    this.state.lastSeq = seq;
    this.state.lastUpdateTs = ts;
    this.state.connectionState = 'connected';
    this.recompute();
  }

  applyDelta(bids: Level[], asks: Level[], firstSeq: number, lastSeq: number, ts: number): boolean {
    if (this.state.lastSeq > 0 && firstSeq !== this.state.lastSeq + 1) {
      this.state.connectionState = 'resyncing';
      return false;
    }
    for (const lvl of bids) this.applyLevel(lvl, 'bid');
    for (const lvl of asks) this.applyLevel(lvl, 'ask');
    this.state.lastSeq = lastSeq;
    this.state.lastUpdateTs = ts;
    this.pruneLevels();
    this.recompute();
    return true;
  }

  private applyLevel(lvl: Level, side: 'bid' | 'ask'): void {
    const arr = side === 'bid' ? this.state.bids : this.state.asks;
    if (lvl.qty === 0) {
      const idx = arr.findIndex(l => l.price === lvl.price);
      if (idx >= 0) arr.splice(idx, 1);
    } else {
      const idx = arr.findIndex(l => l.price === lvl.price);
      if (idx >= 0) arr[idx] = lvl;
      else arr.push(lvl);
    }
  }

  private pruneLevels(): void {
    this.state.bids = this.sortLevels(this.state.bids, 'bid').slice(0, this.maxLevels);
    this.state.asks = this.sortLevels(this.state.asks, 'ask').slice(0, this.maxLevels);
  }

  private sortLevels(levels: Level[], side: 'bid' | 'ask'): Level[] {
    return [...levels].sort((a, b) => side === 'bid' ? b.price - a.price : a.price - b.price);
  }

  private recompute(): void {
    if (this.state.bids.length > 0) this.state.bestBid = this.state.bids[0].price;
    if (this.state.asks.length > 0) this.state.bestAsk = this.state.asks[0].price;
    this.state.mid = (this.state.bestBid + this.state.bestAsk) / 2;
    this.state.spread = this.state.bestAsk - this.state.bestBid;
  }

  isStale(thresholdMs: number): boolean {
    return Date.now() - this.state.lastUpdateTs > thresholdMs;
  }

  getState(): Readonly<BookState> {
    return { ...this.state, bids: [...this.state.bids], asks: [...this.state.asks] };
  }

  reset(): void { this.state = this.emptyState(); }
}
