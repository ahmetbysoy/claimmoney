import type { AdapterEvent, ConnectionState, ExchangeAdapter } from '../types'
import { AdapterDiagnostics } from '../adapterDiagnostics'

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : null

const parseLevels = (value: unknown): [number, number][] => {
  if (!Array.isArray(value)) return []
  return value.flatMap(level => {
    if (!Array.isArray(level) || level.length < 2) return []
    const price = Number(level[0]), qty = Number(level[1])
    return Number.isFinite(price) && Number.isFinite(qty) ? [[price, qty] as [number, number]] : []
  })
}

export class BinanceAdapter implements ExchangeAdapter {
  readonly id = 'binance'
  private sockets: WebSocket[] = []
  private state: ConnectionState = 'disconnected'
  private callback: (event: AdapterEvent) => void = () => {}
  private diagnostics = new AdapterDiagnostics('binance', event => this.callback(event))

  onEvent(cb: (event: AdapterEvent) => void): void { this.callback = cb }
  getConnectionState(): ConnectionState { return this.state }

  connect(symbol: string): void {
    this.disconnect(); this.diagnostics.reset(); this.state = 'connecting'
    const normalized = symbol.toLowerCase().replace(/[^a-z0-9]/g, '')
    // Binance partial-depth is a complete top-N snapshot on every message, not a diff stream.
    const book = new WebSocket(`wss://fstream.binance.com/ws/${normalized}@depth20@100ms`)
    const trade = new WebSocket(`wss://fstream.binance.com/ws/${normalized}@aggTrade`)
    const mark = new WebSocket(`wss://fstream.binance.com/ws/${normalized}@markPrice@1s`)
    const liquidation = new WebSocket(`wss://fstream.binance.com/ws/${normalized}@forceOrder`)
    this.sockets = [book, trade, mark, liquidation]
    let opened = 0
    const open = () => {
      opened += 1
      if (opened !== this.sockets.length) return
      this.state = 'connected'
      this.callback({ type: 'status', status: 'connected', source: 'binance', ts: Date.now() })
    }
    book.onopen = open; trade.onopen = open; mark.onopen = open; liquidation.onopen = open
    book.onmessage = message => this.handleBook(message.data, symbol)
    trade.onmessage = message => this.handleTrade(message.data, symbol)
    mark.onmessage = message => this.handleMarkPrice(message.data, symbol)
    liquidation.onmessage = message => this.handleLiquidation(message.data, symbol)
    const error = () => {
      this.state = 'error'
      const ts = Date.now()
      this.diagnostics.report('socket-error', 'Binance WebSocket reported an error', ts)
      this.callback({ type: 'status', status: 'error', source: 'binance', ts })
    }
    book.onerror = error; trade.onerror = error; mark.onerror = error; liquidation.onerror = error
    book.onclose = () => this.closed(); trade.onclose = () => this.closed(); mark.onclose = () => this.closed(); liquidation.onclose = () => this.closed()
  }

  private handleBook(raw: unknown, symbol: string): void {
    try {
      const data = asRecord(JSON.parse(String(raw)))
      if (!data) throw new Error('payload is not an object')
      const bids = parseLevels(data.b), asks = parseLevels(data.a)
      const eventTs = Number(data.E ?? Date.now()), seq = Number(data.u ?? 0)
      if (!bids.length || !asks.length || !Number.isFinite(eventTs) || !Number.isFinite(seq)) throw new Error('invalid partial-depth payload')
      const now = Date.now()
      this.callback({
        kind: 'bookSnapshot', exchange: 'binance', symbol, eventTs,
        receiveTs: now, seq, bids, asks
      })
    } catch (error) {
      this.diagnostics.report('malformed-message', `Dropped Binance book message: ${error instanceof Error ? error.message : 'unknown parse error'}`)
    }
  }

  private handleTrade(raw: unknown, symbol: string): void {
    try {
      const data = asRecord(JSON.parse(String(raw)))
      if (!data) throw new Error('payload is not an object')
      const price = Number(data.p), qty = Number(data.q), eventTs = Number(data.T ?? data.E ?? Date.now())
      if (!(price > 0) || !(qty > 0) || !Number.isFinite(eventTs)) throw new Error('invalid aggregate-trade payload')
      const now = Date.now()
      this.callback({
        kind: 'trade', exchange: 'binance', symbol, eventTs, receiveTs: now,
        trade: { price, priceStr: String(data.p), qty, side: data.m ? 'sell' : 'buy', ts: eventTs, notional: price * qty }
      })
    } catch (error) {
      this.diagnostics.report('malformed-message', `Dropped Binance trade message: ${error instanceof Error ? error.message : 'unknown parse error'}`)
    }
  }

  private handleMarkPrice(raw: unknown, symbol: string): void {
    try {
      const data = asRecord(JSON.parse(String(raw)))
      if (!data) throw new Error('payload is not an object')
      const price = Number(data.p), eventTs = Number(data.E ?? Date.now())
      if (!(price > 0) || !Number.isFinite(eventTs)) throw new Error('invalid mark-price payload')
      this.callback({ kind: 'markPrice', exchange: 'binance', symbol, eventTs, receiveTs: Date.now(),
        price, priceStr: String(data.p) })
    } catch (error) {
      this.diagnostics.report('malformed-message', `Dropped Binance mark-price message: ${error instanceof Error ? error.message : 'unknown parse error'}`)
    }
  }

  private handleLiquidation(raw: unknown, symbol: string): void {
    try {
      const payload = asRecord(JSON.parse(String(raw))), order = asRecord(payload?.o)
      if (!order) throw new Error('missing liquidation order')
      const price = Number(order.ap ?? order.p), qty = Number(order.z ?? order.q)
      const eventTs = Number(order.T ?? payload?.E ?? Date.now())
      if (!(price > 0) || !(qty > 0) || !Number.isFinite(eventTs)) throw new Error('invalid liquidation payload')
      this.callback({
        kind: 'liquidation', exchange: 'binance', symbol, eventTs, receiveTs: Date.now(),
        side: order.S === 'SELL' ? 'long' : 'short', price, qty, notional: price * qty
      })
    } catch (error) {
      this.diagnostics.report('malformed-message', `Dropped Binance liquidation message: ${error instanceof Error ? error.message : 'unknown parse error'}`)
    }
  }

  private closed(): void {
    if (this.state !== 'disconnected') {
      this.state = 'disconnected'
      this.callback({ type: 'status', status: 'disconnected', source: 'binance', ts: Date.now() })
    }
  }
  ping(): void { /* Binance browser WebSockets have no application-level ping frame. */ }
  disconnect(): void {
    this.state = 'disconnected'
    for (const socket of this.sockets) {
      socket.onclose = null
      socket.close()
    }
    this.sockets = []
  }
}
