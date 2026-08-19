// ClaimMoney v3 — Signal Domain Types
// ApprovedSignal is the single event consumed by UI, tracker, planner, and notification.

import type { SymbolId } from './events';

export interface FilterDecision {
  id: string;
  mode: 'hard-veto' | 'soft-penalty';
  pass: boolean;
  reason: string;
  adjustment: number;
}

export interface ApprovedSignal {
  id: string;
  symbol: SymbolId;
  side: 'BUY' | 'SELL';
  eventTs: number;
  price: number;
  score: number;
  calibratedProbability: number | null;
  frameId: string;
  strategyVersion: string;
  filters: FilterDecision[];
}

// --- Detector intermediate signal (not approved yet) ---

export interface DetectorSignal {
  id: string;
  detector: string;
  symbol: SymbolId;
  side: 'bullish' | 'bearish' | 'neutral';
  eventTs: number;
  confidence: number;
  evidence: Record<string, number>;
  ttlMs: number;
}

// --- Helpers ---

export function makeFilterDecision(id: string, mode: FilterDecision['mode'], pass: boolean, reason: string, adjustment = 0): FilterDecision {
  return { id, mode, pass, reason, adjustment };
}

export function hasHardVeto(filters: FilterDecision[]): boolean {
  return filters.some(f => f.mode === 'hard-veto' && !f.pass);
}

export function softPenaltySum(filters: FilterDecision[]): number {
  return filters.filter(f => f.mode === 'soft-penalty' && !f.pass).reduce((sum, f) => sum + f.adjustment, 0);
}

export function isExpired(signal: ApprovedSignal, now: number, ttlMs = 60000): boolean {
  return now - signal.eventTs > ttlMs;
}
