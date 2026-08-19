import type { Signal, FilteredSignal, Position } from './types';

type FilterFn = (signal: Signal, state: Record<string, unknown>) => boolean;

interface FilterEntry {
  name: string;
  fn: FilterFn;
  passed: number;
  rejected: number;
}

export class SignalPipeline {
  private filters: Map<string, FilterEntry> = new Map();

  // Built-in filters
  constructor() {
    this.addFilter('regime_filter', (signal, state) => {
      const allowedRegimes = (state.allowedRegimes as string[]) ?? ['trending_up', 'trending_down'];
      return allowedRegimes.includes(signal.regime);
    });
    this.addFilter('max_positions_filter', (signal, state) => {
      const openCount = (state.openPositions as Position[] ?? []).length;
      const maxPos = (state.maxPositions as number) ?? 5;
      return openCount < maxPos;
    });
    this.addFilter('cooldown_filter', (signal, state) => {
      const lastSignalTs = (state.lastSignalTs as number) ?? 0;
      const cooldownMs = (state.cooldownMs as number) ?? 60000;
      return signal.ts - lastSignalTs >= cooldownMs;
    });
    this.addFilter('confidence_filter', (signal, state) => {
      const minConf = (state.minConfidence as number) ?? 0.5;
      return signal.confidence >= minConf;
    });
  }

  addFilter(name: string, fn: FilterFn): void {
    this.filters.set(name, { name, fn, passed: 0, rejected: 0 });
  }

  removeFilter(name: string): void {
    this.filters.delete(name);
  }

  process(
    signals: Signal[],
    state: Record<string, unknown>
  ): FilteredSignal[] {
    return signals.map((signal) => {
      for (const [, filter] of this.filters) {
        if (!filter.fn(signal, state)) {
          filter.rejected++;
          return { ...signal, passed: false, filterReason: filter.name };
        }
        filter.passed++;
      }
      return { ...signal, passed: true };
    });
  }

  getFilterStats(): { name: string; passed: number; rejected: number }[] {
    return Array.from(this.filters.values()).map((f) => ({
      name: f.name,
      passed: f.passed,
      rejected: f.rejected,
    }));
  }
}