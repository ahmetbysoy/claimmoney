import { describe, it, expect } from 'vitest';
import { validateOKXChecksum, parseOKXCandle, parseOKXTrade, crc32c } from '@/lib/engine/okx-integration';
import type { OKXMessage } from '@/lib/engine/types';

describe('OKX Integration', () => {
  it('should validate CRC32 checksum', () => {
    const data = [{ a: 1, b: 2 }];
    const checksum = crc32c(JSON.stringify(data));
    const msg: OKXMessage = { id: '1', ts: 1000, data, arg: { channel: 'candle1m', instId: 'BTC-USDT' }, checksum };
    expect(validateOKXChecksum(msg, checksum)).toBe(true);
  });

  it('should parse OKX candle format', () => {
    const okxCandle = [1597026383085, 9300, 9350, 9250, 9320, 100];
    const candle = parseOKXCandle(okxCandle);
    expect(candle.ts).toBe(1597026383085);
    expect(candle.o).toBe(9300);
    expect(candle.c).toBe(9320);
  });

  it('should parse OKX trade format', () => {
    const trade = { ts: '1597026383085', px: '9320.5', sz: '1.5', side: 'buy' };
    const tick = parseOKXTrade(trade);
    expect(tick.price).toBe(9320.5);
    expect(tick.size).toBe(1.5);
    expect(tick.side).toBe('buy');
  });
});
