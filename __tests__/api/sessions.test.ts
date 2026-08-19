import { describe, it, expect } from 'vitest';

describe('Sessions API', () => {
  it('should export sessions route handler', async () => {
    const mod = await import('@/app/api/sessions/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should create session via POST', async () => {
    const mod = await import('@/app/api/sessions/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Session', equity: 10000 }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session).toBeDefined();
  });
});
