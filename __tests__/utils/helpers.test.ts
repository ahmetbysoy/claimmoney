import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, formatNumber, clamp, resetIdCounter } from '@/lib/engine/helpers';

describe('Helpers', () => {
  beforeEach(() => { resetIdCounter(); });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^cm_/);
  });

  it('should format numbers correctly', () => {
    expect(formatNumber(3.14159)).toBe('3.14');
    expect(formatNumber(3.14159, 4)).toBe('3.1416');
  });

  it('should clamp values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
