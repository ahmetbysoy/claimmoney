import crc32 from 'crc32';
import type { Candle, Tick, OKXMessage } from './types';

export function crc32c(str: string): string {
  const val = crc32(str);
  return (val >>> 0).toString(16).padStart(8, '0');
}

export function validateOKXChecksum(message: OKXMessage, expectedChecksum: string): boolean {
  if (!message.data || !message.checksum) return false;
  const dataStr = JSON.stringify(message.data);
  return crc32c(dataStr) === expectedChecksum;
}

export function parseOKXCandle(data: unknown): Candle {
  const arr = data as unknown[];
  return {
    ts: Number(arr[0]),
    o: Number(arr[1]),
    h: Number(arr[2]),
    l: Number(arr[3]),
    c: Number(arr[4]),
    v: Number(arr[5]),
  };
}

export function parseOKXTrade(data: unknown): Tick {
  const obj = data as Record<string, unknown>;
  return {
    ts: Number(obj.ts),
    price: Number(obj.px),
    size: Number(obj.sz),
    side: obj.side === 'buy' ? 'buy' : 'sell',
  };
}

export function buildOKXSubscribe(instId: string, channels: string[]): string {
 const args = channels.map((ch) => ({ channel: ch, instId }));
 return JSON.stringify({ op: 'subscribe', args });
}
