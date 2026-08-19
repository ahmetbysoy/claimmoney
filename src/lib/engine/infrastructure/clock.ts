// ClaimMoney v3 — Injectable Time Provider
// Allows swapping between real-time and deterministic (manual) clocks.

export interface Clock {
  /** Returns the current timestamp in ms. */
  now(): number;
  /** Resolves after the given number of milliseconds. */
  sleep(ms: number): Promise<void>;
}

/** Real-time clock backed by Date.now and setTimeout. */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** Deterministic clock for backtesting / replay. No actual waiting. */
export class ManualClock implements Clock {
  private _time: number;

  constructor(startMs = 0) {
    this._time = startMs;
  }

  now(): number {
    return this._time;
  }

  /** Advance the clock by `ms` milliseconds. */
  advance(ms: number): void {
    this._time += ms;
  }

  /** Set the clock to an absolute timestamp. */
  setTime(ms: number): void {
    this._time = ms;
  }

  /** No-op: a manual clock never blocks. */
  async sleep(_ms: number): Promise<void> {
    // Intentionally no-op for deterministic execution.
  }
}
