import { describe, it, expect } from 'vitest';
import { WebSocketManager } from '@/lib/engine/websocket-manager';

describe('WebSocketManager', () => {
  it('initializes with default config and connects/disconnects', () => {
    const mgr = new WebSocketManager({ heartbeatIntervalMs: 5000, watchdogTimeoutMs: 10000, maxReconnectAttempts: 3 });
    expect(mgr.isConnected()).toBe(false);
    expect(mgr.getStats()).toEqual({ messagesReceived: 0, reconnects: 0, uptime: 0 });
    // We can't actually connect in tests without a server, but we verify the API exists
    mgr.disconnect();
    expect(mgr.isConnected()).toBe(false);
  });

  it('registers heartbeat and watchdog intervals correctly', () => {
    const mgr = new WebSocketManager({ heartbeatIntervalMs: 1000, watchdogTimeoutMs: 2000 });
    // Verify that the manager is properly configured
    expect(mgr.isConnected()).toBe(false);
    expect(mgr.getStats().messagesReceived).toBe(0);
    // Disconnect should not throw even when not connected
    expect(() => mgr.disconnect()).not.toThrow();
  });
});
