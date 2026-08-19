// ClaimMoney v3 — Binance U/u Sequence Controller
// Binance uses U (first seq) and u (last seq) in depth updates.
// Valid delta: U <= lastSeq + 1 AND u >= lastSeq + 1
// If invalid → request snapshot resync.

export type SequenceStatus = 'ok' | 'gap' | 'duplicate' | 'stale';

export interface SequenceCheckResult {
  status: SequenceStatus;
  reason?: string;
}

export class SequenceController {
  private lastSeq = 0;
  private initialized = false;

  /** Process a snapshot — resets sequence tracking */
  onSnapshot(seq: number): void {
    this.lastSeq = seq;
    this.initialized = true;
  }

  /** Process a delta — validates U/u sequence numbers */
  checkDelta(firstSeq: number, lastSeq: number): SequenceCheckResult {
    if (!this.initialized) {
      return { status: 'stale', reason: 'No snapshot received yet' };
    }

    // Duplicate: entire delta is already seen
    if (lastSeq <= this.lastSeq) {
      return { status: 'duplicate', reason: `lastSeq ${lastSeq} <= lastKnown ${this.lastSeq}` };
    }

    // Gap: there's a hole in the sequence
    if (firstSeq > this.lastSeq + 1) {
      return { status: 'gap', reason: `Gap: expected ${this.lastSeq + 1}, got ${firstSeq}` };
    }

    // OK — advance lastSeq
    this.lastSeq = lastSeq;
    return { status: 'ok' };
  }

  /** Get the last known sequence number */
  getLastSeq(): number {
    return this.lastSeq;
  }

  /** Whether we've received at least one snapshot */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Reset state (e.g., on symbol change) */
  reset(): void {
    this.lastSeq = 0;
    this.initialized = false;
  }
}