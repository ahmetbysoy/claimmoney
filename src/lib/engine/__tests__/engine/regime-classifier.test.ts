import { describe, it, expect } from 'vitest';
import { RegimeClassifier } from '@/lib/engine/regime-classifier';
import type { Candle } from '@/lib/engine/types';

function makeCandle(ts: number, c: number, h: number, l: number, o: number, v: number): Candle {
  return { ts, o, h, l, c, v };
}

// Trending up: steadily increasing closes
const trendingUpCandles: Candle[] = [];
for (let i = 0; i < 30; i++) {
  const price = 100 + i * 1;
  trendingUpCandles.push(makeCandle(1000 + i * 1000, 100 + i, 102 + i, 98 + i, 99 + i, 1000));
}

// Ranging: oscillating around 100
const rangingCandles: Candle[] = [];
for (let i = 0; i < 30; i++) {
  const price = 100 + Math.sin(i * 0.5) * 2;
  rangingCandles.push(makeCandle(1000 + i * 1000, price + 1, price + 3, price - 3, price, 1000));
}

describe('RegimeClassifier', () => {
  it('classifies trending up data', () => {
    const classifier = new RegimeClassifier();
    const regime = classifier.classify(trendingUpCandles);
    expect(regime).toBe('trending_up');
  });

  it('classifies ranging data', () => {
    const classifier = new RegimeClassifier();
    const regime = classifier.classify(rangingCandles);
    expect(regime).toBe('ranging');
  });

  it('returns probability distribution over regimes', () => {
    const classifier = new RegimeClassifier();
    const probs = classifier.getRegimeProbability(trendingUpCandles);
    expect(probs).toHaveProperty('trending_up');
    expect(probs).toHaveProperty('trending_down');
    expect(probs).toHaveProperty('ranging');
    expect(probs).toHaveProperty('volatile');
    // Probabilities should sum to 1
    const sum = probs.trending_up + probs.trending_down + probs.ranging + probs.volatile;
    expect(Math.abs(sum - 1)).toBeLessThan(0.001);
  });
});
