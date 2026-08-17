export const config = { runtime: 'edge' }

const MAX_BODY_BYTES = 16_384
const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: responseHeaders })
const text = (value: unknown, max: number) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, max)

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (req.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'cross_site_rejected' }, 403)
  const declaredLength = Number(req.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  try {
    const raw = await req.text()
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)
    const payload = JSON.parse(raw)
    if (payload?.version !== 1 || !payload?.message || !payload?.fingerprint) return json({ error: 'invalid_payload' }, 400)
    const context = payload.context && typeof payload.context === 'object'
      ? Object.fromEntries(Object.entries(payload.context).slice(0, 20).map(([key, value]) => [text(key, 80), text(value, 300)]))
      : undefined
    const event = {
      event: 'claimmoney.client_error', version: 1,
      fingerprint: text(payload.fingerprint, 64), name: text(payload.name, 120), message: text(payload.message, 1_000),
      source: text(payload.source, 120), route: text(payload.route, 300), release: text(payload.release, 120),
      userAgent: text(payload.userAgent, 500), stack: text(payload.stack, 4_000), ts: Number(payload.ts) || Date.now(), context
    }
    console.error(JSON.stringify(event))
    return json({ accepted: true, fingerprint: event.fingerprint }, 202)
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
}
