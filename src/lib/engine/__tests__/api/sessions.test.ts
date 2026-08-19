import { describe, it, expect } from 'vitest';
import { SessionManager } from '@/lib/engine/session-manager';
import { resetIdCounter } from '@/lib/engine/helpers';

describe('Sessions API', () => {
  it('GET sessions returns all sessions', () => {
    resetIdCounter();
    const mgr = new SessionManager();
    mgr.createSession('s1', 10000);
    mgr.createSession('s2', 20000);
    const sessions = mgr.getAllSessions();
    // Equivalent to GET /api/sessions
    const response = { success: true, data: sessions };
    expect(response.success).toBe(true);
    expect(response.data.length).toBe(2);
  });

  it('POST session creates a new session', () => {
    resetIdCounter();
    const mgr = new SessionManager();
    const session = mgr.createSession('new-session', 15000);
    // Equivalent to POST /api/sessions
    expect(session.name).toBe('new-session');
    expect(session.startEquity).toBe(15000);
    expect(mgr.getAllSessions().length).toBe(1);
  });
});
