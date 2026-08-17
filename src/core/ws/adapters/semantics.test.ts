import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BinanceAdapter } from './binance'
import { OkxAdapter } from './okx'
import type { AdapterEvent } from '../types'
import type { MarketEvent } from '../../../types'

class MockSocket {
  static OPEN = 1
  static instances: MockSocket[] = []
  readyState = 1
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  send = vi.fn()
  close = vi.fn()
  constructor(readonly url: string) { MockSocket.instances.push(this) }
  open(): void { this.onopen?.({} as Event) }
  message(payload: unknown): void {
    this.onmessage?.({ data: typeof payload === 'string' ? payload : JSON.stringify(payload) } as MessageEvent)
  }
}

const originalWebSocket = globalThis.WebSocket
beforeEach(() => {
  MockSocket.instances = []
  ;(globalThis as { WebSocket: typeof WebSocket }).WebSocket = MockSocket as unknown as typeof WebSocket
})
afterEach(() => {
  ;(globalThis as { WebSocket: typeof WebSocket }).WebSocket = originalWebSocket
  vi.restoreAllMocks()
})

describe('exchange adapter event semantics', () => {
  it('keeps OKX snapshot, delta, trade and mark-price channels distinct', () => {
    const events: AdapterEvent[] = []
    const adapter = new OkxAdapter()
    adapter.onEvent(event => events.push(event))
    adapter.connect('BTCUSDT')
    const socket = MockSocket.instances[0]
    socket.open()
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('mark-price'))
    expect(socket.send).not.toHaveBeenCalledWith(expect.stringContaining('tickers'))

    socket.message({ arg: { channel: 'books' }, action: 'snapshot', data: [{
      bids: [['100', '2', '0', '1']], asks: [['101', '3', '0', '1']], ts: '1000', seqId: '10', checksum: 0
    }] })
    socket.message({ arg: { channel: 'books' }, action: 'update', data: [{
      bids: [['100', '4', '0', '1']], asks: [], ts: '1100', prevSeqId: '10', seqId: '12', checksum: 0
    }] })
    socket.message({ arg: { channel: 'trades' }, data: [{ px: '100.5', sz: '2', side: 'buy', ts: '1200' }] })
    socket.message({ arg: { channel: 'mark-price' }, data: [{ markPx: '100.25', ts: '1300' }] })

    const marketEvents = events.filter((event): event is MarketEvent => !('type' in event))
    expect(marketEvents.map(event => event.kind)).toEqual(['bookSnapshot', 'bookDelta', 'trade', 'markPrice'])
    expect(marketEvents[1]).toMatchObject({ kind: 'bookDelta', previousSeq: 10, firstSeq: 11, lastSeq: 12, bids: [[100, 4]] })
    expect(marketEvents[3]).toMatchObject({ kind: 'markPrice', price: 100.25 })
  })

  it('emits bounded diagnostics instead of silently swallowing malformed OKX messages', () => {
    const events: AdapterEvent[] = []
    const adapter = new OkxAdapter()
    adapter.onEvent(event => events.push(event))
    adapter.connect('BTCUSDT')
    const socket = MockSocket.instances[0]
    socket.message('{bad json')
    socket.message('{still bad')
    const diagnostics = events.filter((event): event is Extract<AdapterEvent, { type: 'diagnostic' }> => 'type' in event && event.type === 'diagnostic')
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ source: 'okx', code: 'malformed-message', droppedMessages: 1 })
  })

  it('reports a non-zero checksum mismatch and closes for a fresh snapshot', () => {
    const events: AdapterEvent[] = []
    const adapter = new OkxAdapter()
    adapter.onEvent(event => events.push(event))
    adapter.connect('BTCUSDT')
    const socket = MockSocket.instances[0]
    socket.message({ arg: { channel: 'books' }, action: 'snapshot', data: [{
      bids: [['100', '2']], asks: [['101', '3']], ts: '1000', seqId: '10', checksum: 123
    }] })
    expect(events.some(event => 'type' in event && event.type === 'diagnostic' && event.code === 'checksum-mismatch')).toBe(true)
    expect(events.some(event => 'type' in event && event.type === 'status' && event.status === 'error')).toBe(true)
    expect(socket.close).toHaveBeenCalled()
  })

  it('types Binance partial depth as a normalized top-N snapshot', () => {
    const events: AdapterEvent[] = []
    const adapter = new BinanceAdapter()
    adapter.onEvent(event => events.push(event))
    adapter.connect('BTCUSDT')
    const [bookSocket, , markSocket, liquidationSocket] = MockSocket.instances
    bookSocket.message({ E: 1000, u: 10, b: [['100', '2']], a: [['101', '3']] })
    markSocket.message({ E: 1050, p: '100.25' })
    liquidationSocket.message({ E: 1100, o: { S: 'SELL', ap: '99', z: '4', T: '1100' } })
    const marketEvents = events.filter((event): event is MarketEvent => !('type' in event))
    expect(marketEvents[0]).toMatchObject({ kind: 'bookSnapshot', seq: 10, bids: [[100, 2]], asks: [[101, 3]] })
    expect(marketEvents[1]).toMatchObject({ kind: 'markPrice', price: 100.25 })
    expect(marketEvents[2]).toMatchObject({ kind: 'liquidation', side: 'long', price: 99, qty: 4, notional: 396 })
  })
})
