import { describe, it, expect } from 'vitest';
import { SessionManager } from '@/lib/engine/session-manager';
import { resetIdCounter, generateId } from '@/lib/engine/helpers';
import type { Signal, Position } from '@/lib/engine/types';

describe('SessionManager', () => {
  it('creates a session and retrieves it', () => {
    resetIdCounter();
    const mgr = new SessionManager();
    const session = mgr.createSession('test-session', 10000);
    expect(session.name).toBe('test-session');
    expect(session.startEquity).toBe(10000);
    expect(session.currentEquity).toBe(10000);

    const retrieved = mgr.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(session.id);
  });

  it('exports and imports a session with checksum verification', () => {
    resetIdCounter();
    const mgr = new SessionManager();
    const session = mgr.createSession('export-test', 5000);

    const exported = mgr.exportSession(session.id);
    expect(exported).not.toBeNull();
    expect(exported!.version).toBeTruthy();
    expect(exported!.checksum).toBeTruthy();

    // Import into a new manager
    const mgr2 = new SessionManager();
    const imported = mgr2.importSession(JSON.stringify(exported!));
    expect(imported).not.toBeNull();
    expect(imported!.name).toBe('export-test');
    expect(imported!.startEquity).toBe(5000);

    // Tamper with checksum
    const tampered = JSON.stringify({ ...exported!, checksum: 'bad' });
    const tamperedImport = mgr2.importSession(tampered);
    expect(tamperedImport).toBeNull();
  });

  it('purges walk-forward sessions keeping N', () => {
    resetIdCounter();
    const mgr = new SessionManager();
    mgr.createSession('session-1', 10000);
    mgr.createSession('session-2', 10000);
    mgr.createSession('session-3', 10000);

    const all = mgr.getAllSessions();
    expect(all.length).toBe(3);

    const kept = mgr.purgeWalkForward(all, 2);
    expect(kept.length).toBe(2);
    // The two most recent should be kept
    expect(mgr.getAllSessions().length).toBe(2);
  });
});
