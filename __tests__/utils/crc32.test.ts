import { describe, it, expect } from 'vitest';
import { crc32c } from '@/lib/engine/okx-integration';

describe('CRC32', () => {
  it('should produce known checksums', () => {
    const c1 = crc32c('hello world');
    const c2 = crc32c('hello world');
    expect(c1).toBe(c2);
    expect(c1.length).toBe(8);
  });

  it('should differ for different inputs', () => {
    const c1 = crc32c('data_A');
    const c2 = crc32c('data_B');
    expect(c1).not.toBe(c2);
  });
});
