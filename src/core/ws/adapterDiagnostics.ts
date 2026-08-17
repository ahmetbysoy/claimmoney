import type { Source } from '../../types'
import type { AdapterDiagnosticCode, AdapterEvent } from './types'

/** Rate-limits repeated adapter failures while retaining a cumulative drop count. */
export class AdapterDiagnostics {
  private droppedMessages = 0
  private lastEmittedAt = new Map<AdapterDiagnosticCode, number>()

  constructor(
    private readonly source: Source,
    private readonly emit: (event: AdapterEvent) => void,
    private readonly minIntervalMs = 5_000
  ) {}

  report(code: AdapterDiagnosticCode, message: string, ts = Date.now()): void {
    this.droppedMessages += 1
    const previous = this.lastEmittedAt.get(code) ?? -Infinity
    if (ts - previous < this.minIntervalMs) return
    this.lastEmittedAt.set(code, ts)
    this.emit({ type: 'diagnostic', source: this.source, code, message, ts, droppedMessages: this.droppedMessages })
  }

  reset(): void {
    this.droppedMessages = 0
    this.lastEmittedAt.clear()
  }
}
