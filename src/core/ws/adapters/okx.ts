import type { WsAdapter, WsEvent } from '../types'
import type { NormalizedTrade, NormalizedDepth } from '../../../types'

export function crc32Signed(value: string): number {
  let crc = 0xffffffff
  for (let i = 0; i < value.length; i += 1) {
    crc ^= value.charCodeAt(i)
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) | 0
}

export const shouldVerifyOkxChecksum = (value: number): boolean => Number.isFinite(value) && value !== 0

export function okxChecksum(bids: [string, string][], asks: [string, string][]): number {
  const parts: string[] = []
  const levels = Math.max(Math.min(25, bids.length), Math.min(25, asks.length))
  for (let i = 0; i < levels; i += 1) {
    if (i < bids.length && i < 25) parts.push(bids[i][0], bids[i][1])
    if (i < asks.length && i < 25) parts.push(asks[i][0], asks[i][1])
  }
  return crc32Signed(parts.join(':'))
}

/**
 * OKX WS Adapter - TR erişim garantisi için varsayılan
 * wss://ws.okx.com:8443/ws/v5/public
 * Kanallar: trades, books (depth 20), tickers (mark)
 */
export class OkxAdapter implements WsAdapter {
  id = 'okx'
  private ws: WebSocket | null = null
  private cb: ((ev: WsEvent) => void) | null = null
  private symbol = 'BTC-USDT'
  private state: 'connected' | 'connecting' | 'disconnected' = 'disconnected'
  // Local book for incremental updates (action: snapshot/update)
  private localBids: Map<string, string> = new Map()
  private localAsks: Map<string, string> = new Map()
  private lastChecksum: number | null = null

  onEvent(cb: (ev: WsEvent) => void): void {
    this.cb = cb
  }

  getConnectionState() {
    return this.state
  }

  connect(symbol: string): void {
    // Futures only: BTCUSDT -> BTC-USDT-SWAP, BTC-USDT -> BTC-USDT-SWAP
    const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const base = clean.endsWith('USDT') ? clean.slice(0, -4) : clean
    this.symbol = `${base}-USDT-SWAP`
    this.disconnect()
    this.localBids.clear()
    this.localAsks.clear()
    this.lastChecksum = null
    this.state = 'connecting'
    this.cb?.({ type: 'status', status: 'connecting', message: 'OKX connecting...' })

    const url = 'wss://ws.okx.com:8443/ws/v5/public'
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.state = 'connected'
      this.cb?.({ type: 'status', status: 'connected' })
      // Subscribe
      const instId = this.symbol // e.g., BTC-USDT
      const sub = {
        op: 'subscribe',
        args: [
          { channel: 'trades', instId },
          { channel: 'books', instId },
          { channel: 'tickers', instId }
        ]
      }
      this.ws?.send(JSON.stringify(sub))
    }

    this.ws.onmessage = (event) => {
      if (event.data === 'pong') { this.cb?.({ type: 'heartbeat' }); return }
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.event === 'subscribe' || msg.event === 'error') return
        if (!msg.data || !Array.isArray(msg.data)) return
        // Determine channel
        const channel: string = msg.arg?.channel
        if (channel === 'trades') {
          for (const t of msg.data) {
            // OKX trade: { px, sz, side: buy/sell, ts }
            const priceStr: string = t.px
            const trade: NormalizedTrade = {
              price: Number(priceStr),
              priceStr,
              qty: parseFloat(t.sz),
              side: t.side === 'buy' ? 'buy' : 'sell',
              ts: Number(t.ts),
              tradeId: String(t.tradeId ?? ''),
              notional: Number(priceStr) * parseFloat(t.sz),
              exchange: 'okx',
              symbol: this.symbol,
              receiveTs: Date.now()
            }
            this.cb?.({ type: 'trade', data: trade })
          }
        } else if (channel === 'books') {
          // OKX books: incremental update (action: 'snapshot' or 'update') + checksum
          // Snapshot = tam 400 seviye, Update = sadece değişen seviyeler -> merge et
          const action: string | undefined = (msg as any).action // 'snapshot' | 'update'
          const checksum: number | undefined = msg.data?.[0]?.checksum

          for (const b of msg.data) {
            const incomingBids: string[][] = b.bids || []
            const incomingAsks: string[][] = b.asks || []

            if (action === 'snapshot') {
              // Snapshot: tam değiştir
              this.localBids.clear()
              this.localAsks.clear()
              for (const [px, sz] of incomingBids) {
                const qty = parseFloat(sz)
                if (qty > 0) this.localBids.set(px, sz)
              }
              for (const [px, sz] of incomingAsks) {
                const qty = parseFloat(sz)
                if (qty > 0) this.localAsks.set(px, sz)
              }
            } else {
              // Update: merge et (piramit'teki applyDiff mantığı gibi)
              for (const [px, sz] of incomingBids) {
                const qty = parseFloat(sz)
                if (qty === 0) this.localBids.delete(px)
                else this.localBids.set(px, sz)
              }
              for (const [px, sz] of incomingAsks) {
                const qty = parseFloat(sz)
                if (qty === 0) this.localAsks.delete(px)
                else this.localAsks.set(px, sz)
              }
            }

            const checksumBids = Array.from(this.localBids.entries())
              .sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 25) as [string, string][]
            const checksumAsks = Array.from(this.localAsks.entries())
              .sort((a, b) => Number(a[0]) - Number(b[0])).slice(0, 25) as [string, string][]
            const remoteChecksum = Number(b.checksum ?? checksum)
            // OKX currently emits checksum=0 on books when CRC validation is disabled for the channel.
            // Verify every non-zero checksum; zero is an explicit "not supplied" sentinel.
            if (shouldVerifyOkxChecksum(remoteChecksum)) {
              const computedChecksum = okxChecksum(checksumBids, checksumAsks)
              if (computedChecksum !== remoteChecksum) {
                this.localBids.clear(); this.localAsks.clear(); this.lastChecksum = null
                this.state = 'disconnected'
                this.cb?.({ type: 'status', status: 'disconnected', message: `OKX checksum mismatch (${computedChecksum} != ${remoteChecksum}); resyncing` })
                this.ws?.close(4000, 'checksum mismatch')
                return
              }
              this.lastChecksum = remoteChecksum
            }

            // Local book'u sıralı NormalizedDepth'e çevir
            const sortedBids = Array.from(this.localBids.entries())
              .map(([p, q]) => [parseFloat(p), parseFloat(q)] as [number, number])
              .sort((a, b) => b[0] - a[0])
              .slice(0, 50)
            const sortedAsks = Array.from(this.localAsks.entries())
              .map(([p, q]) => [parseFloat(p), parseFloat(q)] as [number, number])
              .sort((a, b) => a[0] - b[0])
              .slice(0, 50)

            const depth: NormalizedDepth = {
              bids: sortedBids,
              asks: sortedAsks,
              ts: Number(b.ts),
              kind: 'snapshot',
              lastSeq: Number(b.seqId ?? 0),
              checksum,
              exchange: 'okx',
              symbol: this.symbol,
              receiveTs: Date.now()
            }
            this.cb?.({ type: 'depth', data: depth })
          }
        } else if (channel === 'tickers') {
          for (const tk of msg.data) {
            const priceStr: string = tk.last
            const mark = { price: Number(priceStr), priceStr, ts: Number(tk.ts), exchange: 'okx' as const, symbol: this.symbol, receiveTs: Date.now() }
            this.cb?.({ type: 'mark', data: mark })
            // Also treat as price update via mark
          }
        }
      } catch {}
    }

    this.ws.onerror = () => {
      this.state = 'disconnected'
      this.cb?.({ type: 'status', status: 'disconnected', message: 'OKX error' })
    }

    this.ws.onclose = () => {
      this.state = 'disconnected'
      this.cb?.({ type: 'status', status: 'disconnected' })
    }
  }

  ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping')
  }

  disconnect(): void {
    this.state = 'disconnected'
    this.localBids.clear()
    this.localAsks.clear()
    this.lastChecksum = null
    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }
  }
}
