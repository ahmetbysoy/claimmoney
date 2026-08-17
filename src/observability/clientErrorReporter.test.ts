import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildClientErrorPayload, installGlobalErrorHandlers, reportClientError, resetErrorReporterForTests } from './clientErrorReporter'

describe('client error reporting', () => {
  const beacon = vi.fn(() => true)
  beforeEach(() => {
    resetErrorReporterForTests()
    beacon.mockClear()
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
  })

  it('builds a bounded payload without URL query strings', () => {
    const error = new Error('failed at https://example.com/path?token=secret')
    const payload = buildClientErrorPayload(error, 'unit-test', { safe: true }, 123)
    expect(payload.message).toContain('https://example.com/path')
    expect(payload.message).not.toContain('token=secret')
    expect(payload.fingerprint).toMatch(/^[a-f0-9]{8}$/)
    expect(payload.ts).toBe(123)
  })

  it('deduplicates identical errors inside the reporting window', () => {
    reportClientError(new Error('same failure'), 'unit-test')
    reportClientError(new Error('same failure'), 'unit-test')
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  it('captures unhandled browser errors', () => {
    const uninstall = installGlobalErrorHandlers()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('global failure'), message: 'global failure' }))
    uninstall()
    expect(beacon).toHaveBeenCalledTimes(1)
  })
})
