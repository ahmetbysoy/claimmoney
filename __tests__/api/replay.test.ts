import { describe, it, expect } from 'vitest';

describe('Replay API', () => {
  it('should export replay route handler', async () => {
    const mod = await import('@/app/api/replay/route');
    expect(mod).toHaveProperty('POST');
    expect(mod).toHaveProperty('GET');
  });

  it('should start replay via POST', async () => {
    const mod = await import('@/app/api/replay/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ candles: [] }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('byteChecksum');
  });
});
