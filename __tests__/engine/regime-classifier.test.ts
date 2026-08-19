import { describe, it, expect } from 'vitest';
import { RegimeClassifier } from '@/lib/engine/regime-classifier';
import type { Candle } from '@/lib/engine/types';

function trendCandles(direction: 'up' | 'down', n = 60): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 + (direction === 'up' ? i * 0.5 : -i * 0.5);
    return { ts: 1000 + i * 60000, o: base, h: base + 1, l: base - 1, c: base + (direction === 'up' ? 0.3 : -0.3), v: 1000 };
  });
}

function rangeCandles(n = 60): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 + Math.sin(i * 0.3) * 0.5;
    return { ts: 1000 + i * 60000, o: base, h: base + 0.2, l: base - 0.2, c: base, v: 1000 };
  });
}

describe('RegimeClassifier', () => {
  it('should classify uptrend', () => {
    const classifier = new RegimeClassifier();
    expect(classifier.classify(trendCandles('up'))).toBe('trending_up');
  });

  it('should classify ranging market', () => {
    const classifier = new RegimeClassifier();
    expect(classifier.classify(rangeCandles())).toBe('ranging');
  });

  it('should return regime probabilities', () => {
    const classifier = new RegimeClassifier();
    const probs = classifier.getRegimeProbability(trendCandles('up'));
    expect(probs).toHaveProperty('trending_up');
    expect(probs).toHaveProperty('trending_down');
    expect(probs).toHaveProperty('ranging');
    expect(probs).toHaveProperty('volatile');
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.01);
  });
});
