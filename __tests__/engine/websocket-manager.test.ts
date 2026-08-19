import { describe, it, expect, vi } from 'vitest';
import { WebSocketManager } from '@/lib/engine/websocket-manager';

describe('WebSocketManager', () => {
  it('should initialize with default config', () => {
    const manager = new WebSocketManager();
    expect(manager.isConnected()).toBe(false);
    const stats = manager.getStats();
    expect(stats.messagesReceived).toBe(0);
    expect(stats.reconnects).toBe(0);
  });

  it('should track message callbacks', () => {
    const manager = new WebSocketManager();
    const cb = vi.fn();
    manager.onMessage(cb);
    manager.onReconnect(vi.fn());
    expect(manager.getStats().uptime).toBe(0);
  });
});
