import { describe, it, expect } from 'vitest';

describe('Risk API', () => {
  it('should export risk route handler', async () => {
    const mod = await import('@/app/api/risk/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should calculate position size via POST', async () => {
    const mod = await import('@/app/api/risk/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ entryPrice: 100, stopLoss: 98, equity: 10000, riskPct: 0.01 }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.positionSize).toBeGreaterThan(0);
  });
});
