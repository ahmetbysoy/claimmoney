import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

class SmokeWebSocket {
  static OPEN = 1
  readyState = SmokeWebSocket.OPEN
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  constructor(_url: string) { queueMicrotask(() => this.onopen?.(new Event('open'))) }
  send() {}
  close() { this.readyState = 3 }
}

describe('App smoke test', () => {
  const originalWebSocket = globalThis.WebSocket
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    globalThis.WebSocket = SmokeWebSocket as unknown as typeof WebSocket
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('mounts the runtime shell without a browser-side exception', async () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    const root = createRoot(element)
    await act(async () => {
      root.render(<App />)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(element.textContent).toContain('ClaimMoney')
    await act(async () => root.unmount())
    element.remove()
  })
})
