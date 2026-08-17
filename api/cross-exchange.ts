export const config = { runtime: 'edge' }

type Exchange = 'binance' | 'bybit' | 'okx' | 'mexc'
const SYMBOL_RE = /^[A-Z0-9]{5,24}$/
const EXCHANGE_URLS: Record<Exchange, (symbol: string) => string> = {
  binance: symbol => `https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=${symbol}`,
  bybit: symbol => `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
  okx: symbol => `https://www.okx.com/api/v5/market/ticker?instId=${symbol.replace(/USDT$/, '-USDT-SWAP')}`,
  mexc: symbol => `https://contract.mexc.com/api/v1/contract/ticker?symbol=${symbol.replace(/USDT$/, '_USDT')}`
}
const headers = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=3',
  'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff'
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })

function parse(exchange: Exchange, data: any): { bid: number; ask: number } | null {
  if (exchange === 'binance' && data?.bidPrice) return { bid: Number(data.bidPrice), ask: Number(data.askPrice) }
  if (exchange === 'bybit' && data?.result?.list?.[0]) return { bid: Number(data.result.list[0].bid1Price), ask: Number(data.result.list[0].ask1Price) }
  if (exchange === 'okx' && data?.data?.[0]) return { bid: Number(data.data[0].bidPx), ask: Number(data.data[0].askPx) }
  if (exchange === 'mexc' && data?.data) return { bid: Number(data.data.bid1 ?? data.data.buyOne), ask: Number(data.data.ask1 ?? data.data.sellOne) }
  return null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
  const url = new URL(req.url)
  const exchange = (url.searchParams.get('exchange') ?? '') as Exchange
  const symbol = (url.searchParams.get('symbol') ?? 'BTCUSDT').toUpperCase()
  if (!(exchange in EXCHANGE_URLS)) return json({ error: 'unsupported_exchange' }, 400)
  if (!SYMBOL_RE.test(symbol)) return json({ error: 'invalid_symbol' }, 400)
  try {
    const response = await fetch(EXCHANGE_URLS[exchange](symbol), {
      headers: { 'User-Agent': 'claimmoney-edge/2.0', Accept: 'application/json' }, signal: AbortSignal.timeout(4000)
    })
    if (!response.ok) return json({ error: 'upstream_http', status: response.status }, 502)
    const quote = parse(exchange, await response.json())
    if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0 || quote.bid > quote.ask) return json({ error: 'invalid_upstream_quote' }, 502)
    return json({ exchange, symbol, ...quote, mid: (quote.bid + quote.ask) / 2, ts: Date.now() })
  } catch (error) {
    return json({ error: 'upstream_unavailable', message: error instanceof Error ? error.message : 'unknown' }, 502)
  }
}
