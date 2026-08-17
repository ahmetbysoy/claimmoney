import { BinanceAdapter } from './adapters/binance'
import { OkxAdapter } from './adapters/okx'
import type { WsAdapter, WsEvent } from './types'
import type { Source } from '../../types'

export interface WsHealth {
  state: 'connected' | 'connecting' | 'disconnected'
  source: Source
  symbol: string
  reconnectAttempts: number
  lastMessageAt: number
  stale: boolean
}
export type AdapterFactory = (source: Source) => WsAdapter

export class WsManager {
  private adapter: WsAdapter | null = null
  private source: Source = 'okx'
  private symbol = 'BTCUSDT'
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = true
  private hiddenPaused = false
  private disposed = false
  private generation = 0
  private reconnectScheduled = false
  private lastMessageAt = 0
  private visibilityHandler: (() => void) | null = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly onEvent: (event: WsEvent) => void,
    private readonly factory: AdapterFactory = source => source === 'okx' ? new OkxAdapter() : new BinanceAdapter(),
    private readonly healthConfig = { heartbeatAfterMs: 10_000, reconnectAfterMs: 20_000, checkEveryMs: 2_500 }
  ) {
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (this.disposed) return
        if (document.hidden) {
          this.hiddenPaused = true
          this.clearReconnect()
          this.adapter?.disconnect()
        } else if (this.hiddenPaused && this.shouldReconnect) {
          this.hiddenPaused = false
          this.createAdapterAndConnect()
        }
      }
      document.addEventListener('visibilitychange', this.visibilityHandler)
    }
  }

  connect(source: Source, symbol: string): void {
    this.disposed = false; this.source = source; this.symbol = symbol; this.shouldReconnect = true
    this.reconnectAttempts = 0; this.clearReconnect(); this.createAdapterAndConnect(); this.startWatchdog()
  }
  switchSource(source: Source): void { this.connect(source, this.symbol) }
  switchSymbol(symbol: string): void { this.connect(this.source, symbol) }
  resync(reason = 'Order-book resynchronization requested'): void {
    if (this.disposed || this.hiddenPaused) return
    this.generation += 1; this.clearReconnect()
    this.adapter?.disconnect(); this.adapter = null
    this.onEvent({ type: 'status', status: 'connecting', source: this.source, message: reason, ts: Date.now() })
    this.createAdapterAndConnect()
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null; this.reconnectScheduled = false
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer)
    this.watchdogTimer = setInterval(() => {
      if (this.disposed || this.hiddenPaused) return
      const state = this.getState()
      if (state === 'disconnected') return
      const idleMs = Date.now() - this.lastMessageAt
      if (idleMs >= this.healthConfig.reconnectAfterMs) {
        this.generation += 1
        this.adapter?.disconnect(); this.adapter = null
        this.onEvent({ type: 'status', status: 'disconnected', source: this.source,
          message: `WebSocket watchdog: ${idleMs}ms without data`, ts: Date.now() })
        this.scheduleReconnect()
      } else if (state === 'connected' && idleMs >= this.healthConfig.heartbeatAfterMs) {
        this.adapter?.ping?.()
      }
    }, this.healthConfig.checkEveryMs)
  }

  disconnect(): void {
    this.shouldReconnect = false; this.disposed = true; this.generation += 1; this.clearReconnect()
    if (this.watchdogTimer) clearInterval(this.watchdogTimer); this.watchdogTimer = null
    this.adapter?.disconnect(); this.adapter = null
    if (this.visibilityHandler && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityHandler)
    this.visibilityHandler = null
  }
  dispose(): void { this.disconnect() }

  private createAdapterAndConnect(): void {
    if (this.disposed || this.hiddenPaused) return
    const generation = ++this.generation
    this.clearReconnect()
    this.lastMessageAt = Date.now()
    this.adapter?.disconnect()
    const adapter = this.factory(this.source)
    this.adapter = adapter
    adapter.onEvent(event => {
      if (generation !== this.generation || this.disposed) return
      if (!('type' in event) || event.type === 'status' && event.status === 'connected') this.lastMessageAt = Date.now()
      if ('type' in event && event.type === 'status') {
        if (event.status === 'connected') { this.reconnectAttempts = 0; this.reconnectScheduled = false }
        if ((event.status === 'disconnected' || event.status === 'error') && this.shouldReconnect && !this.hiddenPaused) this.scheduleReconnect()
      }
      this.onEvent(event)
    })
    adapter.connect(this.symbol)
  }

  private scheduleReconnect(): void {
    if (this.reconnectScheduled || this.disposed) return
    this.reconnectScheduled = true; this.reconnectAttempts += 1
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30_000) + Math.random() * 500
    this.reconnectTimer = setTimeout(() => {
      this.reconnectScheduled = false; this.reconnectTimer = null
      if (this.shouldReconnect && !this.hiddenPaused && !this.disposed) this.createAdapterAndConnect()
    }, delay)
  }

  getState(): 'connected' | 'connecting' | 'disconnected' {
    const state = this.adapter?.getConnectionState()
    return state === 'connected' || state === 'connecting' ? state : 'disconnected'
  }
  getHealth(staleAfterMs = 5000): WsHealth {
    return { state: this.getState(), source: this.source, symbol: this.symbol, reconnectAttempts: this.reconnectAttempts,
      lastMessageAt: this.lastMessageAt, stale: this.getState() === 'connected' && Date.now() - this.lastMessageAt > staleAfterMs }
  }
}
