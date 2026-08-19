import type { TradingSession, SessionExport } from './types';
import { crc32c } from './okx-integration';

export function serializeSession(session: TradingSession): string {
  const json = JSON.stringify(session);
  return JSON.stringify({
    version: '2.0.0',
    exportedAt: Date.now(),
    session: JSON.parse(json),
    checksum: crc32c(json),
  } satisfies SessionExport);
}

export function deserializeSession(data: string): TradingSession {
  const parsed = JSON.parse(data) as SessionExport;
  const sessionJson = JSON.stringify(parsed.session);
  const checksum = crc32c(sessionJson);
  if (checksum !== parsed.checksum) throw new Error('Checksum mismatch');
  return parsed.session;
}

export function roundtripSession(session: TradingSession): TradingSession {
  const serialized = serializeSession(session);
  return deserializeSession(serialized);
}
