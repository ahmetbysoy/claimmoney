import { describe, it, expect } from 'vitest';
import { generateId, resetIdCounter, formatNumber, clamp, average, standardDeviation } from '@/lib/engine/helpers';

describe('Helpers', () => {
  it('generates deterministic IDs', () => {
    resetIdCounter();
    const id1 = generateId('test');
    const id2 = generateId('test');
    expect(id1).not.toBe(id2);
    expect(id1).toContain('test');
    // Reset and regenerate - should be the same
    resetIdCounter();
    const id3 = generateId('test');
    expect(id3).toBe(id1);
  });

  it('formats numbers correctly', () => {
    expect(formatNumber(123.456, 2)).toBe('123.46');
    expect(formatNumber(100, 0)).toBe('100');
    expect(formatNumber(99.999, 1)).toBe('100.0');
  });

  it('clamps values between min and max', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(0, -5, 5)).toBe(0);
  });
});
