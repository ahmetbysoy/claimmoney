export type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error'

export interface TelemetryEvent {
  level: TelemetryLevel
  code: string
  message: string
  ts: number
  context?: Record<string, unknown>
}

export interface TelemetrySink {
  record(event: TelemetryEvent): void
}

export class MemoryTelemetry implements TelemetrySink {
  private events: TelemetryEvent[] = []
  constructor(private readonly capacity = 250) {}
  record(event: TelemetryEvent): void {
    this.events.push(event)
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity)
  }
  getAll(): readonly TelemetryEvent[] { return [...this.events] }
  clear(): void { this.events = [] }
}

export const consoleTelemetry: TelemetrySink = {
  record(event) {
    if (event.level === 'error') console.error(`[${event.code}] ${event.message}`, event.context ?? '')
    else if (event.level === 'warn') console.warn(`[${event.code}] ${event.message}`, event.context ?? '')
  }
}
