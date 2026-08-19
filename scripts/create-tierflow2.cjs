const fs = require('fs');
const base = '/home/z/my-project/src/lib/engine';
const F = {};
function w(p, c) { const d = p.substring(0, p.lastIndexOf('/')); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(d, c, 'utf-8'); console.log('OK ' + p); }

F['domain/events.ts'] = 'import type { Side } from \'./types\';\n\nexport type ExchangeId = \'okx\' | \'binance\' | \'bybit\' | \'mexc\';\nexport type SymbolId = string;\n\nexport interface Level {\n  price: number;\n  qty: number;\n}\n\nexport type MarketEvent =\n  | { kind: \'trade\'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; tradeId: string; price: number; qty: number; aggressor: Side }\n  | { kind: \'bookSnapshot\'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; seq: number; bids: Level[]; asks: Level[]; checksum?: number }\n  | { kind: \'bookDelta\'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; firstSeq: number; lastSeq: number; bids: Level[]; asks: Level[]; checksum?: number }\n  | { kind: \'markPrice\'; exchange: ExchangeId; symbol: SymbolId; eventTs: number; receiveTs: number; price: number };\n';
