// ClaimMoney v3 — Typed Event Bus
// Generic, type-safe publish/subscribe with automatic unsubscription.

export class EventBus<T extends Record<string, unknown[]>> {
  private readonly listeners = new Map<keyof T, Set<(...args: unknown[]) => void>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  subscribe<K extends keyof T>(
    event: K,
    handler: (...args: T[K]) => void,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as (...args: unknown[]) => void);

    return () => {
      const s = this.listeners.get(event);
      if (s) {
        s.delete(handler as (...args: unknown[]) => void);
        if (s.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit an event, invoking all registered handlers.
   */
  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of Array.from(set)) {
        handler(...args);
      }
    }
  }

  /**
   * Remove all listeners for all events.
   */
  clear(): void {
    this.listeners.clear();
  }
}
