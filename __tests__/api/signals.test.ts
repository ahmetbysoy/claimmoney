import { describe, it, expect } from 'vitest';

describe('Signals API', () => {
  it('should export signals route handler', async () => {
    const mod = await import('@/app/api/signals/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should return empty signals list', async () => {
    const mod = await import('@/app/api/signals/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.signals).toBeDefined();
  });
});
