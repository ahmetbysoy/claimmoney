export type EventMap = Record<string, unknown>
export type Unsubscribe = () => void

export class TypedEventBus<Events extends EventMap> {
  private listeners = new Map<keyof Events, Set<(payload: Events[keyof Events]) => void>>()

  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): Unsubscribe {
    const set = this.listeners.get(event) ?? new Set()
    set.add(listener as (payload: Events[keyof Events]) => void)
    this.listeners.set(event, set)
    return () => {
      set.delete(listener as (payload: Events[keyof Events]) => void)
      if (set.size === 0) this.listeners.delete(event)
    }
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(payload)
  }

  clear(): void { this.listeners.clear() }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0
  }
}
