import { describe, it, expect } from 'vitest';
import { serializeSession, deserializeSession, roundtripSession } from '@/lib/engine/serialization';
import type { TradingSession } from '@/lib/engine/types';

describe('Serialization', () => {
  it('should serialize session to JSON', () => {
    const session: TradingSession = {
      id: 'test', name: 'Test', startedAt: 1000, signals: [], positions: [],
      startEquity: 10000, currentEquity: 10500, peakEquity: 10500,
      maxDrawdown: 0.02, totalFees: 10, winRate: 0.6, profitFactor: 1.5, sharpeRatio: 1.2,
    };
    const json = serializeSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('2.0.0');
    expect(parsed.checksum).toBeTruthy();
  });

  it('should deserialize session from JSON', () => {
    const session: TradingSession = {
      id: 'test2', name: 'Test2', startedAt: 1000, signals: [], positions: [],
      startEquity: 10000, currentEquity: 10500, peakEquity: 10500,
      maxDrawdown: 0.02, totalFees: 10, winRate: 0.6, profitFactor: 1.5, sharpeRatio: 1.2,
    };
    const json = serializeSession(session);
    const deserialized = deserializeSession(json);
    expect(deserialized.id).toBe('test2');
    expect(deserialized.name).toBe('Test2');
  });

  it('should roundtrip session correctly', () => {
    const session: TradingSession = {
      id: 'rt', name: 'RoundTrip', startedAt: 5000, signals: [], positions: [],
      startEquity: 20000, currentEquity: 22000, peakEquity: 22000,
      maxDrawdown: 0.01, totalFees: 5, winRate: 0.7, profitFactor: 2.0, sharpeRatio: 1.8,
    };
    const result = roundtripSession(session);
    expect(result.id).toBe(session.id);
    expect(result.currentEquity).toBe(session.currentEquity);
  });
});
