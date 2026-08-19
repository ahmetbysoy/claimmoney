import type { Candle, QualityReport } from './types';

export class DataQualityGate {
  validate(candles: Candle[]): QualityReport {
    if (candles.length === 0) {
      return { totalRows: 0, validRows: 0, invalidRows: 0, gaps: 0, duplicates: 0, outliers: 0, score: 100 };
    }

    let invalidRows = 0;
    let gaps = 0;
    let duplicates = 0;
    let outliers = 0;

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      // Invalid row check
      if (c.o <= 0 || c.h <= 0 || c.l <= 0 || c.c <= 0 || c.v < 0 || c.h < c.l) {
        invalidRows++;
        continue;
      }
      if (c.h < Math.max(c.o, c.c) || c.l > Math.min(c.o, c.c)) {
        invalidRows++;
      }
      // Gap check (timestamp)
      if (i > 0) {
        const ts = candles[i - 1].ts;
        const expectedInterval = ts > 0 ? candles.filter((x) => x.ts === ts).length > 1 ? 0 : 60000 : 60000;
        if (c.ts > 0 && c.ts - ts > expectedInterval * 2) gaps++;
      }
      // Duplicate check
      if (i > 0 && c.ts === candles[i - 1].ts) duplicates++;
      // Outlier check: price move > 20% in single candle
      if (i > 0 && candles[i - 1].c > 0) {
        const pctMove = Math.abs(c.c - candles[i - 1].c) / candles[i - 1].c;
        if (pctMove > 0.2) outliers++;
      }
    }

    const total = candles.length;
    const valid = total - invalidRows;
    const penalty = (invalidRows * 3 + gaps * 2 + duplicates * 1 + outliers * 2);
    const score = Math.max(0, 100 - penalty);

    return { totalRows: total, validRows: valid, invalidRows, gaps, duplicates, outliers, score };
  }

  sortAndDeduplicate(candles: Candle[]): Candle[] {
    const seen = new Set<number>();
    const result: Candle[] = [];
    for (const c of [...candles].sort((a, b) => a.ts - b.ts)) {
      if (!seen.has(c.ts)) {
        seen.add(c.ts);
        result.push(c);
      }
    }
    return result;
  }

  resync(candles: Candle[], intervalMs: number): Candle[] {
    if (candles.length === 0) return [];
    const sorted = this.sortAndDeduplicate(candles);
    const result: Candle[] = [];
    let expectedTs = sorted[0].ts;

    for (const candle of sorted) {
      while (candle.ts > expectedTs && intervalMs > 0) {
        // Fill gap with last known close
        const last = result.length > 0 ? result[result.length - 1] : candle;
        result.push({ ...last, ts: expectedTs, v: 0 });
        expectedTs += intervalMs;
      }
      result.push(candle);
      expectedTs = candle.ts + intervalMs;
    }
    return result;
  }
}
