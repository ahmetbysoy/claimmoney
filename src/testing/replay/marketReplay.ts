import type { ManualClock } from '../../application/clock'
import type { MarketEvent } from '../../types'
import { validateMarketEvent } from '../../domain/validation'

export interface ReplayTarget { ingest(event: MarketEvent): void; flush?(at: number): void }
export interface ReplayResult { processed: number; rejected: number; firstTs: number; lastTs: number }

export function parseJsonLines(text: string): MarketEvent[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line) as MarketEvent }
    catch (error) { throw new Error(`Invalid JSONL at line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`) }
  })
}

export class MarketReplay {
  constructor(private readonly clock: ManualClock, private readonly target: ReplayTarget) {}
  run(events: MarketEvent[], options: { fromTs?: number; toTs?: number } = {}): ReplayResult {
    const sorted = [...events].sort((a, b) => a.eventTs - b.eventTs || a.receiveTs - b.receiveTs)
    let processed = 0, rejected = 0, firstTs = 0, lastTs = 0
    for (const event of sorted) {
      if (options.fromTs !== undefined && event.eventTs < options.fromTs) continue
      if (options.toTs !== undefined && event.eventTs > options.toTs) continue
      if (!validateMarketEvent(event).ok) { rejected += 1; continue }
      this.clock.set(event.receiveTs)
      this.target.ingest(event); this.target.flush?.(event.eventTs)
      processed += 1; firstTs ||= event.eventTs; lastTs = event.eventTs
    }
    return { processed, rejected, firstTs, lastTs }
  }
}

export class MarketRecorder {
  private events: MarketEvent[] = []
  constructor(private readonly capacity = 50_000) {}
  record(event: MarketEvent): void { this.events.push(structuredClone(event)); if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity) }
  toJsonLines(): string { return this.events.map(event => JSON.stringify(event)).join('\n') }
  clear(): void { this.events = [] }
  size(): number { return this.events.length }
  snapshot(): MarketEvent[] { return this.events.map(event => structuredClone(event)) }
}
