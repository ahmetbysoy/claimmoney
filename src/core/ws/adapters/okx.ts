import type { AdapterEvent, ConnectionState, ExchangeAdapter } from '../types'
import { AdapterDiagnostics } from '../adapterDiagnostics'

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    table[index] = value | 0
  }
  return table
})()

export function crc32Signed(input: string): number {
  let crc = -1
  const bytes = new TextEncoder().encode(input)
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  return (crc ^ -1) | 0
}

export function okxChecksum(bids: [string, string][], asks: [string, string][]): number {
  const parts: string[] = []
  for (let index = 0; index < Math.max(bids.length, asks.length) && index < 25; index += 1) {
    if (bids[index]) parts.push(bids[index][0], bids[index][1])
    if (asks[index]) parts.push(asks[index][0], asks[index][1])
  }
  return crc32Signed(parts.join(':'))
}

export function shouldVerifyOkxChecksum(checksum: number): boolean {
  return Number.isFinite(checksum) && checksum !== 0
}

type RawLevel = [string, string]
type BookLevel = [number, number]
const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : null

const parseRawLevels = (value: unknown): RawLevel[] => {
  if (!Array.isArray(value)) return []
  return value.flatMap(level => {
    if (!Array.isArray(level) || level.length < 2) return []
    const price = String(level[0]), qty = String(level[1])
    return Number.isFinite(Number(price)) && Number.isFinite(Number(qty)) ? [[price, qty] as RawLevel] : []
  })
}
const toBookLevels = (levels: RawLevel[]): BookLevel[] => levels.map(([price, qty]) => [Number(price), Number(qty)])

/** OKX books adapter. Snapshots and incremental updates retain their native semantics. */
export class OkxAdapter implements ExchangeAdapter {
  readonly id = 'okx'
  private socket: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private callback: (event: AdapterEvent) => void = () => {}
  private symbol = ''
  private bids = new Map<string, string>()
  private asks = new Map<string, string>()
  private diagnostics = new AdapterDiagnostics('okx', event => this.callback(event))

  onEvent(cb: (event: AdapterEvent) => void): void { this.callback = cb }
  getConnectionState(): ConnectionState { return this.state }

  connect(symbol: string): void {
    this.disconnect(); this.diagnostics.reset(); this.state = 'connecting'; this.symbol = this.toInstrument(symbol)
    const socket = new WebSocket('wss://ws.okx.com:8443/ws/v5/public')
    this.socket = socket
    socket.onopen = () => {
      socket.send(JSON.stringify({ op: 'subscribe', args: [
        { channel: 'books', instId: this.symbol },
        { channel: 'trades', instId: this.symbol },
        { channel: 'mark-price', instId: this.symbol }
      ] }))
      this.state = 'connected'
      this.callback({ type: 'status', status: 'connected', source: 'okx', ts: Date.now() })
    }
    socket.onmessage = message => this.handle(message.data, symbol)
    socket.onerror = () => {
      this.state = 'error'
      const ts = Date.now()
      this.diagnostics.report('socket-error', 'OKX WebSocket reported an error', ts)
      this.callback({ type: 'status', status: 'error', source: 'okx', ts })
    }
    socket.onclose = () => {
      if (this.state === 'disconnected') return
      this.state = 'disconnected'
      this.callback({ type: 'status', status: 'disconnected', source: 'okx', ts: Date.now() })
    }
  }

  private handle(raw: unknown, requestedSymbol: string): void {
    try {
      const payload = asRecord(JSON.parse(String(raw)))
      if (!payload) throw new Error('payload is not an object')
      if (payload.event === 'error') {
        const message = String(payload.msg ?? 'subscription rejected')
        this.diagnostics.report('subscription-error', `OKX subscription error: ${message}`)
        return
      }
      if (payload.event === 'subscribe' || payload.event === 'pong') return
      const arg = asRecord(payload.arg), channel = String(arg?.channel ?? '')
      const rows = Array.isArray(payload.data) ? payload.data : []
      if (!channel || !rows.length) throw new Error('missing channel or data')
      for (const rowValue of rows) {
        const row = asRecord(rowValue)
        if (!row) throw new Error('data row is not an object')
        if (channel === 'books') this.handleBook(payload.action, row, requestedSymbol)
        else if (channel === 'trades') this.handleTrade(row, requestedSymbol)
        else if (channel === 'mark-price') this.handleMarkPrice(row, requestedSymbol)
      }
    } catch (error) {
      this.diagnostics.report('malformed-message', `Dropped OKX message: ${error instanceof Error ? error.message : 'unknown parse error'}`)
    }
  }

  private handleBook(actionValue: unknown, data: Record<string, unknown>, requestedSymbol: string): void {
    const action = String(actionValue ?? 'snapshot')
    if (action !== 'snapshot' && action !== 'update') throw new Error(`unsupported books action: ${action}`)
    const rawBids = parseRawLevels(data.bids), rawAsks = parseRawLevels(data.asks)
    const eventTs = Number(data.ts ?? Date.now()), seq = Number(data.seqId ?? 0)
    if (!Number.isFinite(eventTs) || !Number.isFinite(seq)) throw new Error('invalid books timestamp or sequence')

    if (action === 'snapshot') {
      this.bids.clear(); this.asks.clear()
      this.applyLevels(this.bids, rawBids); this.applyLevels(this.asks, rawAsks)
    } else {
      this.applyLevels(this.bids, rawBids); this.applyLevels(this.asks, rawAsks)
    }
    this.pruneMap(this.bids, 'desc'); this.pruneMap(this.asks, 'asc')

    const sortedRawBids = [...this.bids.entries()].sort((a, b) => Number(b[0]) - Number(a[0])).slice(0, 400)
    const sortedRawAsks = [...this.asks.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).slice(0, 400)
    const checksum = Number(data.checksum ?? 0)
    if (shouldVerifyOkxChecksum(checksum) && okxChecksum(sortedRawBids.slice(0, 25), sortedRawAsks.slice(0, 25)) !== (checksum | 0)) {
      this.bids.clear(); this.asks.clear()
      this.diagnostics.report('checksum-mismatch', 'OKX order-book checksum mismatch; reconnecting for a fresh snapshot', eventTs)
      this.callback({ type: 'status', status: 'error', source: 'okx', message: 'checksum mismatch; resync required', ts: eventTs })
      this.socket?.close()
      return
    }

    const receiveTs = Date.now()
    if (action === 'snapshot') {
      this.callback({
        kind: 'bookSnapshot', exchange: 'okx', symbol: requestedSymbol, eventTs, receiveTs, seq,
        bids: toBookLevels(sortedRawBids), asks: toBookLevels(sortedRawAsks), checksum
      })
      return
    }

    const previousSeq = Number(data.prevSeqId)
    if (!Number.isFinite(previousSeq)) throw new Error('incremental books update is missing prevSeqId')
    this.callback({
      kind: 'bookDelta', exchange: 'okx', symbol: requestedSymbol, eventTs, receiveTs,
      firstSeq: previousSeq + 1, lastSeq: seq, previousSeq,
      bids: toBookLevels(rawBids), asks: toBookLevels(rawAsks)
    })
  }

  private handleTrade(data: Record<string, unknown>, requestedSymbol: string): void {
    const price = Number(data.px), qty = Number(data.sz), eventTs = Number(data.ts ?? Date.now())
    if (!(price > 0) || !(qty > 0) || !Number.isFinite(eventTs)) throw new Error('invalid trade payload')
    this.callback({
      kind: 'trade', exchange: 'okx', symbol: requestedSymbol, eventTs, receiveTs: Date.now(),
      trade: { price, priceStr: String(data.px), qty, side: data.side === 'buy' ? 'buy' : 'sell', ts: eventTs, notional: price * qty }
    })
  }

  private handleMarkPrice(data: Record<string, unknown>, requestedSymbol: string): void {
    const price = Number(data.markPx), eventTs = Number(data.ts ?? Date.now())
    if (!(price > 0) || !Number.isFinite(eventTs)) throw new Error('invalid mark-price payload')
    this.callback({ kind: 'markPrice', exchange: 'okx', symbol: requestedSymbol, eventTs, receiveTs: Date.now(), price })
  }

  private applyLevels(target: Map<string, string>, levels: RawLevel[]): void {
    for (const [price, qty] of levels) Number(qty) === 0 ? target.delete(price) : target.set(price, qty)
  }
  private pruneMap(target: Map<string, string>, direction: 'asc' | 'desc'): void {
    if (target.size <= 1_000) return
    const retained = [...target.entries()].sort((a, b) => direction === 'desc' ? Number(b[0]) - Number(a[0]) : Number(a[0]) - Number(b[0])).slice(0, 1_000)
    target.clear()
    for (const [price, qty] of retained) target.set(price, qty)
  }
  private toInstrument(symbol: string): string {
    const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')
    return `${clean.replace(/USDT$/, '')}-USDT-SWAP`
  }
  ping(): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send('ping')
  }
  disconnect(): void {
    this.state = 'disconnected'; this.bids.clear(); this.asks.clear()
    if (this.socket) { this.socket.onclose = null; this.socket.close(); this.socket = null }
  }
}
