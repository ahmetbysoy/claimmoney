import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { resetErrorReporterForTests } from '../observability/clientErrorReporter'

function Broken(): ReactElement { throw new Error('render failed') }

describe('ErrorBoundary', () => {
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    resetErrorReporterForTests()
    Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a safe recovery screen when React rendering fails', async () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    const root = createRoot(element)
    await act(async () => root.render(<ErrorBoundary><Broken /></ErrorBoundary>))
    expect(element.querySelector('[data-testid="app-error-boundary"]')).not.toBeNull()
    expect(element.textContent).toContain('güvenli moda geçti')
    await act(async () => root.unmount())
    element.remove()
  })
})
