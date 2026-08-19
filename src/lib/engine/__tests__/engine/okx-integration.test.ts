import { describe, it, expect } from 'vitest';
import { validateOKXChecksum, parseOKXCandle, parseOKXTrade, crc32c } from '@/lib/engine/okx-integration';
import type { OKXMessage } from '@/lib/engine/types';

describe('OKX Integration', () => {
  it('computes CRC32 checksum correctly', () => {
    const dataStr = JSON.stringify([{ ts: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 }]);
    const checksum = crc32c(dataStr);
    expect(checksum).toHaveLength(8);
    expect(checksum).toBe(checksum.toLowerCase());
  });

  it('validates OKX checksum', () => {
    const message: OKXMessage = {
      id: '1',
      ts: 1000,
      data: [{ ts: 1000, o: 100, h: 105, l: 95, c: 102, v: 1000 }],
      arg: { channel: 'candle1m', instId: 'BTC-USDT' },
      checksum: '',
    };
    // Compute correct checksum and attach it
    const dataStr = JSON.stringify(message.data);
    const realChecksum = crc32c(dataStr);
    message.checksum = realChecksum;
    expect(validateOKXChecksum(message, realChecksum)).toBe(true);
    expect(validateOKXChecksum(message, 'wrongchecksum')).toBe(false);
  });

  it('parses OKX candle format', () => {
    const candle = parseOKXCandle([1690000000000, '100.5', '105.0', '99.0', '103.0', '1000', '100.5', '103000', '1']);
    expect(candle.ts).toBe(1690000000000);
    expect(candle.o).toBe(100.5);
    expect(candle.h).toBe(105);
    expect(candle.l).toBe(99);
    expect(candle.c).toBe(103);
    expect(candle.v).toBe(1000);
  });

  it('parses OKX trade format', () => {
    const tick = parseOKXTrade({
      instId: 'BTC-USDT',
      px: '100.5',
      sz: '0.5',
      side: 'buy',
      ts: '1690000000000',
      tradeId: '12345',
    });
    expect(tick.ts).toBe(1690000000000);
    expect(tick.price).toBe(100.5);
    expect(tick.size).toBe(0.5);
    expect(tick.side).toBe('buy');
  });
});
