import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '@/lib/engine/session-manager';
import type { Signal, Position } from '@/lib/engine/types';

describe('SessionManager', () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  it('should create and manage sessions', () => {
    const session = sm.createSession('Test', 10000);
    expect(session.name).toBe('Test');
    expect(session.startEquity).toBe(10000);
    expect(sm.getAllSessions().length).toBe(1);
  });

  it('should export and import session with checksum', () => {
    const session = sm.createSession('Export', 10000);
    const exported = sm.exportSession(session.id);
    expect(exported.checksum).toBeTruthy();
    expect(exported.version).toBe('2.0.0');

    const sm2 = new SessionManager();
    const imported = sm2.importSession(JSON.stringify(exported));
    expect(imported.id).toBe(session.id);
    expect(imported.name).toBe('Export');
  });

  it('should purge walk-forward sessions', () => {
    for (let i = 0; i < 10; i++) sm.createSession('S' + i, 10000);
    const all = sm.getAllSessions();
    const purged = sm.purgeWalkForward(all, 3);
    expect(purged.length).toBe(3);
  });
});
