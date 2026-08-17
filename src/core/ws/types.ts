import type { MarketEvent, Source } from '../../types'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export type AdapterDiagnosticCode =
  | 'malformed-message'
  | 'checksum-mismatch'
  | 'sequence-gap'
  | 'socket-error'
  | 'subscription-error'

export type AdapterEvent = MarketEvent | {
  type: 'status'
  status: ConnectionState
  source: Source
  message?: string
  ts: number
} | {
  type: 'diagnostic'
  source: Source
  code: AdapterDiagnosticCode
  message: string
  ts: number
  droppedMessages: number
}

export interface ExchangeAdapter {
  readonly id: string
  connect(symbol: string): void
  disconnect(): void
  onEvent(cb: (event: AdapterEvent) => void): void
  getConnectionState(): ConnectionState
  ping?(): void
}

// Compatibility aliases for existing manager consumers.
export type WsAdapter = ExchangeAdapter
export type WsEvent = AdapterEvent
