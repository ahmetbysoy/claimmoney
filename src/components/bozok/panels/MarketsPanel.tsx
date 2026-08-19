'use client';

import type { BozokState } from '@/hooks/use-bozok-worker';

interface ExchangeStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency: number;
  volume24h: string;
}

// Static exchange data (would come from an API in production)
const EXCHANGES: ExchangeStatus[] = [
  { name: 'OKX', status: 'online', latency: 12, volume24h: '$2.4B' },
  { name: 'Binance', status: 'online', latency: 18, volume24h: '$3.1B' },
  { name: 'Bybit', status: 'online', latency: 22, volume24h: '$1.8B' },
  { name: 'Deribit', status: 'online', latency: 45, volume24h: '$420M' },
  { name: 'Bitget', status: 'degraded', latency: 85, volume24h: '$890M' },
  { name: 'Huobi', status: 'online', latency: 35, volume24h: '$620M' },
];

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  online: { dot: 'bg-[#00c896]', text: 'text-[#00c896]', bg: 'bg-[#00c896]/5' },
  degraded: { dot: 'bg-[#ffa502]', text: 'text-[#ffa502]', bg: 'bg-[#ffa502]/5' },
  offline: { dot: 'bg-[#ff4757]', text: 'text-[#ff4757]', bg: 'bg-[#ff4757]/5' },
};

interface Props {
  state: BozokState;
}

export default function MarketsPanel({ state }: Props) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      {/* Market overview */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
        <div className="text-[10px] text-[#556a85] mb-2 uppercase tracking-wider">Market Overview</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[9px] text-[#556a85]">Mid Price</div>
            <div className="text-lg font-mono font-bold text-[#e8edf5]">
              ${state.mid.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[#556a85]">Spread</div>
            <div className="text-lg font-mono font-bold text-[#ffa502]">
              {state.spBps.toFixed(1)} bps
            </div>
          </div>
          <div>
            <div className="text-[9px] text-[#556a85]">Regime</div>
            <div className="text-sm font-medium text-[#e8edf5]">{state.regime}</div>
          </div>
          <div>
            <div className="text-[9px] text-[#556a85]">Cascade</div>
            <div className={`text-sm font-mono font-medium ${
              state.cascadeChainLen >= 3 ? 'text-[#ff4757]' : 'text-[#e8edf5]'
            }`}>
              {state.cascadeChainLen}x {state.cascadeChainDir === 0 ? '▲' : '▼'}
            </div>
          </div>
        </div>
      </div>

      {/* Exchange status cards */}
      <div className="text-[10px] text-[#556a85] uppercase tracking-wider px-1">Exchange Status</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {EXCHANGES.map(ex => {
          const st = STATUS_STYLES[ex.status];
          return (
            <div key={ex.name} className={`${st.bg} rounded-lg border border-[#1c2940] p-3`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                  <span className="text-xs font-medium text-[#e8edf5]">{ex.name}</span>
                </div>
                <span className={`text-[9px] ${st.text} uppercase`}>{ex.status}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-[#556a85]">Latency: <span className="text-[#e8edf5] font-mono">{ex.latency}ms</span></span>
                <span className="text-[#556a85]">24h: <span className="text-[#e8edf5] font-mono">{ex.volume24h}</span></span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Liq pool levels */}
      {(state.liqPoolLong.length > 0 || state.liqPoolShort.length > 0) && (
        <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
          <div className="text-[10px] text-[#556a85] mb-2 uppercase tracking-wider">Liquidity Pool Levels</div>
          <div className="space-y-1">
            <div className="text-[9px] text-[#ff4757] mb-1">Long Liq Traps</div>
            {[10, 20, 50, 100].map((lev, i) => (
              <div key={`l${lev}`} className="flex justify-between text-[10px] font-mono">
                <span className="text-[#556a85]">{lev}x</span>
                <span className="text-[#ff4757]">
                  {state.liqPoolLong[i] ? state.liqPoolLong[i].toFixed(2) : '—'}
                </span>
              </div>
            ))}
            <div className="text-[9px] text-[#00c896] mt-2 mb-1">Short Liq Traps</div>
            {[10, 20, 50, 100].map((lev, i) => (
              <div key={`s${lev}`} className="flex justify-between text-[10px] font-mono">
                <span className="text-[#556a85]">{lev}x</span>
                <span className="text-[#00c896]">
                  {state.liqPoolShort[i] ? state.liqPoolShort[i].toFixed(2) : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
