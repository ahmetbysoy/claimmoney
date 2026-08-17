import type { Clock } from '../../application/clock'
import { systemClock } from '../../application/clock'

export type ExchangeId = 'binance' | 'bybit' | 'okx' | 'mexc'
export type ExchangeStatus = 'disconnected' | 'live' | 'stale' | 'error'
export interface ExchangeQuote { bid: number; ask: number; mid: number; ts: number; latencyMs: number; status: ExchangeStatus }
export interface CrossExchangeState { binance: ExchangeQuote; bybit: ExchangeQuote; okx: ExchangeQuote; mexc: ExchangeQuote }
export interface CrossExchangeConfig { intervalMs: number; timeoutMs: number; staleAfterMs: number; enabled: ExchangeId[] }
export interface ArbitrageSpread {
  grossSpread: number; spreadPct: number; buyExchange: ExchangeId | null; sellExchange: ExchangeId | null
  buyAsk: number; sellBid: number; valid: boolean
}

type Listener = (state: CrossExchangeState) => void
const emptyQuote = (): ExchangeQuote => ({ bid: 0, ask: 0, mid: 0, ts: 0, latencyMs: 0, status: 'disconnected' })

export class CrossExchangePoller {
  private state: CrossExchangeState = { binance: emptyQuote(), bybit: emptyQuote(), okx: emptyQuote(), mexc: emptyQuote() }
  private config: CrossExchangeConfig
  private timer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<Listener>()
  private symbol = 'BTCUSDT'
  private controllers = new Set<AbortController>()
  private ticking = false

  constructor(config?: Partial<CrossExchangeConfig>, private readonly clock: Clock = systemClock) {
    this.config = { intervalMs: 3000, timeoutMs: 5000, staleAfterMs: 10_000, enabled: ['bybit', 'okx', 'mexc'], ...config }
  }
  on(event: 'crossExchange:update', fn: Listener): () => void { if (event === 'crossExchange:update') this.listeners.add(fn); return () => this.listeners.delete(fn) }
  private emit(): void { const state = this.getState(); for (const fn of [...this.listeners]) fn(state) }

  start(symbol: string): void {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (this.timer && normalized === this.symbol) return
    this.stop(); this.symbol = normalized || 'BTCUSDT'; void this.tick()
    this.timer = setInterval(() => void this.tick(), this.config.intervalMs)
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    for (const controller of this.controllers) controller.abort()
    this.controllers.clear(); this.ticking = false
  }

  private async tick(): Promise<void> {
    if (this.ticking) return
    this.ticking = true
    try { await Promise.allSettled(this.config.enabled.map(exchange => this.pollExchange(exchange))) }
    finally { this.markStale(); this.emit(); this.ticking = false }
  }

  private async request(url: string): Promise<Response> {
    const controller = new AbortController(); this.controllers.add(controller)
    const timeout = setTimeout(() => controller.abort('timeout'), this.config.timeoutMs)
    try { return await fetch(url, { signal: controller.signal }) }
    finally { clearTimeout(timeout); this.controllers.delete(controller) }
  }

  private parse(exchange: ExchangeId, data: any): { bid: number; ask: number } | null {
    if (data?.bid && data?.ask) return { bid: Number(data.bid), ask: Number(data.ask) }
    if (exchange === 'binance' && data?.bidPrice) return { bid: Number(data.bidPrice), ask: Number(data.askPrice) }
    if (exchange === 'bybit' && data?.result?.list?.[0]) return { bid: Number(data.result.list[0].bid1Price), ask: Number(data.result.list[0].ask1Price) }
    if (exchange === 'okx' && data?.data?.[0]) return { bid: Number(data.data[0].bidPx), ask: Number(data.data[0].askPx) }
    if (exchange === 'mexc' && data?.data) return { bid: Number(data.data.bid1 ?? data.data.buyOne), ask: Number(data.data.ask1 ?? data.data.sellOne) }
    return null
  }

  private async pollExchange(exchange: ExchangeId): Promise<void> {
    const started = this.clock.now()
    const urls = [`/api/cross-exchange?exchange=${exchange}&symbol=${encodeURIComponent(this.symbol)}`, this.buildUrl(exchange)]
    for (const url of urls) {
      try {
        const response = await this.request(url)
        if (!response.ok) continue
        const quote = this.parse(exchange, await response.json())
        if (!quote || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask <= 0 || quote.bid > quote.ask) continue
        const ts = this.clock.now()
        this.state[exchange] = { ...quote, mid: (quote.bid + quote.ask) / 2, ts, latencyMs: Math.max(0, ts - started), status: 'live' }
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') break
      }
    }
    this.state[exchange].status = 'error'
  }

  private buildUrl(exchange: ExchangeId): string {
    const symbol = this.symbol
    if (exchange === 'binance') return `https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=${symbol}`
    if (exchange === 'bybit') return `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`
    if (exchange === 'okx') return `https://www.okx.com/api/v5/market/ticker?instId=${symbol.replace(/USDT$/, '-USDT-SWAP')}`
    return `https://contract.mexc.com/api/v1/contract/ticker?symbol=${symbol.replace(/USDT$/, '_USDT')}`
  }

  private markStale(): void {
    const now = this.clock.now()
    for (const exchange of Object.keys(this.state) as ExchangeId[]) if (this.state[exchange].status === 'live' && now - this.state[exchange].ts > this.config.staleAfterMs) this.state[exchange].status = 'stale'
  }
  getState(): CrossExchangeState { return Object.fromEntries(Object.entries(this.state).map(([key, value]) => [key, { ...value }])) as unknown as CrossExchangeState }

  /** Actionable spread: sell at the highest live bid and buy at the lowest live ask. */
  getMaxSpread(): ArbitrageSpread {
    this.markStale()
    const live = (Object.keys(this.state) as ExchangeId[]).filter(exchange => this.state[exchange].status === 'live')
    if (live.length < 2) return { grossSpread: 0, spreadPct: 0, buyExchange: null, sellExchange: null, buyAsk: 0, sellBid: 0, valid: false }
    const buyExchange = live.reduce((best, exchange) => this.state[exchange].ask < this.state[best].ask ? exchange : best)
    const sellExchange = live.reduce((best, exchange) => this.state[exchange].bid > this.state[best].bid ? exchange : best)
    const buyAsk = this.state[buyExchange].ask, sellBid = this.state[sellExchange].bid
    const grossSpread = sellBid - buyAsk, mid = (sellBid + buyAsk) / 2
    return { grossSpread, spreadPct: mid ? grossSpread / mid * 100 : 0, buyExchange, sellExchange, buyAsk, sellBid, valid: buyExchange !== sellExchange && grossSpread > 0 }
  }
  updateConfig(config: Partial<CrossExchangeConfig>): void { const restart = Boolean(this.timer && config.intervalMs && config.intervalMs !== this.config.intervalMs); this.config = { ...this.config, ...config }; if (restart) this.start(this.symbol) }
  resetData(): void { this.state = { binance: emptyQuote(), bybit: emptyQuote(), okx: emptyQuote(), mexc: emptyQuote() }; this.emit() }
  reset(): void { this.stop(); this.resetData() }
}
