import type { Candle } from './types';
import { average, ema, sma, atr, vwap, standardDeviation } from './helpers';

export interface MarketState {
  currentPrice: number;
  previousPrice: number;
  vwap: number;
  ema9: number;
  ema21: number;
  sma50: number;
  atr14: number;
  volume: number;
  avgVolume: number;
  high24h: number;
  low24h: number;
  volatility: number;
  candleCount: number;
  lastCandle: Candle | null;
  allCandles: Candle[];
}

export class MarketRuntime {
  private state: MarketState;

  constructor() {
    this.state = this.emptyState();
  }

  private emptyState(): MarketState {
    return {
      currentPrice: 0,
      previousPrice: 0,
      vwap: 0,
      ema9: 0,
      ema21: 0,
      sma50: 0,
      atr14: 0,
      volume: 0,
      avgVolume: 0,
      high24h: 0,
      low24h: Infinity,
      volatility: 0,
      candleCount: 0,
      lastCandle: null,
      allCandles: [],
    };
  }

  processCandle(candle: Candle): void {
    this.state.allCandles.push(candle);
    const candles = this.state.allCandles;
    const n = candles.length;

    this.state.previousPrice = this.state.currentPrice;
    this.state.currentPrice = candle.c;
    this.state.candleCount = n;
    this.state.lastCandle = candle;

    // VWAP
    const vwapVals = vwap(candles);
    this.state.vwap = vwapVals[vwapVals.length - 1];

    // EMAs
    const closes = candles.map((c) => c.c);
    const ema9 = ema(closes, 9);
    const ema21 = ema(closes, 21);
    this.state.ema9 = ema9[ema9.length - 1];
    this.state.ema21 = ema21[ema21.length - 1];

    // SMA50
    if (n >= 50) {
      const sma50 = sma(closes, 50);
      this.state.sma50 = sma50[sma50.length - 1];
    }

    // ATR14
    if (n >= 2) {
      const atrVals = atr(candles, 14);
      this.state.atr14 = atrVals[atrVals.length - 1];
    }

    // Volume
    this.state.volume = candle.v;
    const vols = candles.map((c) => c.v);
    this.state.avgVolume = average(vols);

    // High/Low
    if (candle.h > this.state.high24h) this.state.high24h = candle.h;
    if (candle.l < this.state.low24h) this.state.low24h = candle.l;

    // Volatility
    if (n >= 2) {
      const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
      this.state.volatility = standardDeviation(returns);
    }
  }

  getState(): MarketState {
    return { ...this.state, allCandles: [...this.state.allCandles] };
  }

  getStatistics(): { open: number; high: number; low: number; close: number; volume: number; candles: number } {
    const candles = this.state.allCandles;
    if (candles.length === 0) return { open: 0, high: 0, low: 0, close: 0, volume: 0, candles: 0 };
    return {
      open: candles[0].o,
      high: Math.max(...candles.map((c) => c.h)),
      low: Math.min(...candles.map((c) => c.l)),
      close: candles[candles.length - 1].c,
      volume: candles.reduce((s, c) => s + c.v, 0),
      candles: candles.length,
    };
  }

  reset(): void {
    this.state = this.emptyState();
  }
}
