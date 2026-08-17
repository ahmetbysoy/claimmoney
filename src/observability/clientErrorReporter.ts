export interface ClientErrorPayload {
  version: 1
  name: string
  message: string
  stack?: string
  source: string
  route: string
  release: string
  userAgent: string
  fingerprint: string
  ts: number
  context?: Record<string, string | number | boolean | null>
}

const ENDPOINT = '/api/client-errors'
const recent = new Map<string, number>()
const MAX_MESSAGE = 1_000
const MAX_STACK = 4_000
const DEDUPE_MS = 60_000

const truncate = (value: string, max: number) => value.length > max ? `${value.slice(0, max)}…` : value
const stripUrlQueries = (value: string) => value.replace(/https?:\/\/[^\s)]+/g, url => url.split('?')[0])

function fingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function normalize(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) return {
    name: truncate(error.name || 'Error', 120),
    message: truncate(stripUrlQueries(error.message || 'Unknown client error'), MAX_MESSAGE),
    stack: error.stack ? truncate(stripUrlQueries(error.stack), MAX_STACK) : undefined
  }
  return { name: 'NonErrorThrow', message: truncate(stripUrlQueries(String(error)), MAX_MESSAGE) }
}

export function buildClientErrorPayload(
  error: unknown,
  source: string,
  context?: Record<string, string | number | boolean | null>,
  now = Date.now()
): ClientErrorPayload {
  const normalized = normalize(error)
  const route = typeof location === 'undefined' ? '/' : location.pathname
  const release = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || import.meta.env.VITE_APP_RELEASE || 'claimmoney-v2.0.1'
  return {
    version: 1,
    ...normalized,
    source: truncate(source, 120),
    route: truncate(route, 300),
    release: truncate(release, 120),
    userAgent: typeof navigator === 'undefined' ? 'unknown' : truncate(navigator.userAgent, 500),
    fingerprint: fingerprint(`${normalized.name}|${normalized.message}|${source}|${route}`),
    ts: now,
    context
  }
}

export function reportClientError(
  error: unknown,
  source = 'client',
  context?: Record<string, string | number | boolean | null>
): void {
  if (typeof window === 'undefined') return
  const payload = buildClientErrorPayload(error, source, context)
  const lastSent = recent.get(payload.fingerprint) ?? 0
  if (payload.ts - lastSent < DEDUPE_MS) return
  recent.set(payload.fingerprint, payload.ts)
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
  } catch { /* Fetch is the fallback. */ }
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit'
  }).catch(() => undefined)
}

export function installGlobalErrorHandlers(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onError = (event: ErrorEvent) => reportClientError(event.error ?? new Error(event.message), 'window.error', {
    line: event.lineno, column: event.colno
  })
  const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason, 'window.unhandledrejection')
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}

export function resetErrorReporterForTests(): void { recent.clear() }
