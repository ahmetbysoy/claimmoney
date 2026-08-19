import { describe, it, expect } from 'vitest';
import { OKXIntegration } from '@/lib/engine/okx-integration';
import type { OKXMessage } from '@/lib/engine/types';
import crc32 from 'crc32';

describe('OKXIntegration', () => {
  it('validates CRC32 checksum correctly', () => {
    const okx = new OKXIntegration();
    const message: OKXMessage = {
      id: '1',
      ts: 1000,
      data: [{ ts: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 }],
      arg: { channel: 'candle1m', instId: 'BTC-USDT' },
    };
    const dataStr = JSON.stringify(message.data);
    const realChecksum = crc32(dataStr).toString(16).padStart(8, '0');
    expect(okx.validateOKXChecksum(message, realChecksum)).toBe(true);
    expect(okx.validateOKXChecksum(message, 'wrongchecksum')).toBe(false);
  });

  it('parses OKX candle format', () => {
    const okx = new OKXIntegration();
    const candle = okx.parseOKXCandle([1690000000000, '100.5', '105.0', '99.0', '103.0', '1000', '100.5', '103000', '1']);
    expect(candle.ts).toBe(1690000000000);
    expect(candle.o).toBe(100.5);
    expect(candle.h).toBe(105);
    expect(candle.l).toBe(99);
    expect(candle.c).toBe(103);
    expect(candle.v).toBe(1000);
  });

  it('parses OKX trade format', () => {
    const okx = new OKXIntegration();
    const tick = okx.parseOKXTrade(['BTC-USDT', '100.5', '0.5', 'buy', 1690000000000, '12345']);
    expect(tick.ts).toBe(1690000000000);
    expect(tick.price).toBe(100.5);
    expect(tick.size).toBe(0.5);
    expect(tick.side).toBe('buy');
  });
});
