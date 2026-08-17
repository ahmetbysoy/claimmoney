import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../api/client-errors'

const validPayload = {
  version: 1, name: 'Error', message: 'smoke', source: 'test', route: '/', release: 'test',
  userAgent: 'vitest', fingerprint: 'abc12345', ts: 123
}

describe('client error API', () => {
  afterEach(() => vi.restoreAllMocks())

  it('accepts and logs a bounded structured event', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await handler(new Request('https://claimmoney.test/api/client-errors', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'sec-fetch-site': 'same-origin' },
      body: JSON.stringify(validPayload)
    }))
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ accepted: true, fingerprint: 'abc12345' })
    expect(log).toHaveBeenCalledOnce()
  })

  it('rejects cross-site and malformed reports', async () => {
    const crossSite = await handler(new Request('https://claimmoney.test/api/client-errors', {
      method: 'POST', headers: { 'sec-fetch-site': 'cross-site' }, body: JSON.stringify(validPayload)
    }))
    expect(crossSite.status).toBe(403)
    const malformed = await handler(new Request('https://claimmoney.test/api/client-errors', { method: 'POST', body: '{}' }))
    expect(malformed.status).toBe(400)
  })
})
