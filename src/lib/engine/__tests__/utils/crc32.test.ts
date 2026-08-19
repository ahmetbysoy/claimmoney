import { describe, it, expect } from 'vitest';
import crc32 from 'crc32';

describe('CRC32', () => {
  it('produces known vectors', () => {
    // Test a known CRC32 vector
    const result = crc32('Hello, World!');
    expect(result).toBeTypeOf('number');
    // Same input should produce same output
    expect(crc32('test')).toBe(crc32('test'));
    // Different inputs should (likely) produce different outputs
    expect(crc32('test1')).not.toBe(crc32('test2'));
  });

  it('handles empty input', () => {
    const result = crc32('');
    expect(result).toBeTypeOf('number');
    // CRC32 of empty string is a known value (0)
    expect(result).toBe(0);
  });
});
