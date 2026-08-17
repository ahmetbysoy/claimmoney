export const config = { runtime: 'edge' }

export default function handler(req: Request): Response {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json', Allow: 'GET, HEAD' }
  })
  const body = JSON.stringify({
    status: 'ok', service: 'claimmoney', version: '2.0.1',
    environment: typeof process !== 'undefined' ? process.env.VERCEL_ENV ?? 'local' : 'edge',
    commit: typeof process !== 'undefined' ? process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null : null,
    ts: Date.now()
  })
  return new Response(req.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
