import { describe, it, expect } from 'vitest';
import { serializeSession, deserializeSession, computeChecksum } from '@/lib/engine/serialization';
import type { TradingSession } from '@/lib/engine/types';
import { resetIdCounter, generateId } from '@/lib/engine/helpers';

function makeSession(): TradingSession {
  resetIdCounter();
  return {
    id: generateId('sess'),
    name: 'test-session',
    startedAt: 1000,
    endedAt: 2000,
    signals: [],
    positions: [],
    startEquity: 10000,
    currentEquity: 10500,
    peakEquity: 10500,
    maxDrawdown: 0.05,
    totalFees: 10,
    winRate: 0.6,
    profitFactor: 1.5,
    sharpeRatio: 1.2,
  };
}

describe('Serialization', () => {
  it('serializes a session to JSON with checksum', () => {
    const session = makeSession();
    const json = serializeSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBeTruthy();
    expect(parsed.checksum).toBeTruthy();
    expect(parsed.session.name).toBe('test-session');
  });

  it('deserializes and verifies checksum', () => {
    const session = makeSession();
    const json = serializeSession(session);
    const deserialized = deserializeSession(json);
    expect(deserialized).not.toBeNull();
    expect(deserialized!.name).toBe('test-session');
    expect(deserialized!.startEquity).toBe(10000);

    // Tamper with the data
    const tampered = json.replace('test-session', 'tampered');
    const tamperedResult = deserializeSession(tampered);
    expect(tamperedResult).toBeNull();
  });

  it('roundtrips a session correctly', () => {
    const session = makeSession();
    const json = serializeSession(session);
    const restored = deserializeSession(json);
    expect(restored).toEqual(session);
  });
});
