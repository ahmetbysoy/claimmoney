import { describe, it, expect } from 'vitest';

describe('Market API', () => {
  it('should export market route handler', async () => {
    const mod = await import('@/app/api/market/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should handle POST request', async () => {
    const mod = await import('@/app/api/market/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ ts: 1000, o: 100, h: 105, l: 98, c: 103, v: 1000 }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
  });
});
