import type { DetectorResult, DetectorContext } from './detector';

export interface DetectorResult {
  detector: string;
  side: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  evidence: Record<string, number>;
}

export interface DetectorContext {
  bids: { price: number; qty: number }[];
  asks: { price: number; qty: number }[];
  mid: number;
  spread: number;
  bestBid: number;
  bestAsk: number;
  lastFlowDelta: number;
  lastFlowVolume: number;
  flowPressure: number;
  vpin: number;
  eventTs: number;
}
