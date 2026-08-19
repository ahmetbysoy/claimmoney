'use client';

import { useState, useMemo } from 'react';
import type { BozokState, WorkerSignal } from '@/hooks/use-bozok-worker';

interface Props {
  state: BozokState;
}

type Filter = 'all' | 'bull' | 'bear' | 'warn' | 'high' | 'verified';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bull', label: 'Bull' },
  { key: 'bear', label: 'Bear' },
  { key: 'warn', label: 'Warn' },
  { key: 'high', label: '>=80%' },
  { key: 'verified', label: 'Verified' },
];

const SIGNAL_COLORS: Record<string, string> = {
  BID_WALL: '#3b82f6',
  ASK_WALL: '#f97316',
  CVD_BULL_DIV: '#00c896',
  CVD_BEAR_DIV: '#ff4757',
  SPOOFING: '#ffa502',
  ABSORPTION: '#8b5cf6',
  COMPRESSION: '#06b6d4',
  CASCADE_CHAIN: '#ff4757',
  CASCADE_EXHAUSTED: '#00c896',
  ICEBERG: '#8b5cf6',
  VOID_BID: '#3b82f6',
  VOID_ASK: '#f97316',
  TAPE_SPIKE: '#ffa502',
  FLOW_SUSTAINED: '#00c896',
  LADDER: '#06b6d4',
  BOOK_SKEW: '#8b5cf6',
  SKEW_DIVERGENCE: '#ffa502',
  DELTA_EXPANSION: '#3b82f6',
  FLOW_EXHAUSTION: '#ff4757',
  LIQ_CLUSTER: '#f97316',
};

function ageStr(ts: number): string {
  const age = Date.now() - ts;
  if (age < 5000) return Math.floor(age / 1000) + 's';
  if (age < 60000) return Math.floor(age / 1000) + 's';
  return Math.floor(age / 60000) + 'm';
}

export default function SignalsPanel({ state }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    let sigs = state.sigs;
    switch (filter) {
      case 'bull': sigs = sigs.filter(s => s.b === 'bullish'); break;
      case 'bear': sigs = sigs.filter(s => s.b === 'bearish'); break;
      case 'warn': sigs = sigs.filter(s => s.c < 50); break;
      case 'high': sigs = sigs.filter(s => s.c >= 80); break;
      case 'verified': sigs = sigs.filter(s => s.ver === 1); break;
    }
    return sigs;
  }, [state.sigs, filter]);

  const counts = useMemo(() => ({
    all: state.sigs.length,
    bull: state.sigs.filter(s => s.b === 'bullish').length,
    bear: state.sigs.filter(s => s.b === 'bearish').length,
    warn: state.sigs.filter(s => s.c < 50).length,
    high: state.sigs.filter(s => s.c >= 80).length,
    verified: state.sigs.filter(s => s.ver === 1).length,
  }), [state.sigs]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter buttons */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto flex-shrink-0">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-[#202d42] text-[#e8edf5] border border-[#3b82f6]'
                : 'bg-[#0f1520] text-[#556a85] border border-[#1c2940]'
            }`}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span className={`text-[8px] px-1 rounded-full ${
                filter === f.key ? 'bg-[#3b82f6] text-white' : 'bg-[#1c2940] text-[#556a85]'
              }`}>
                {counts[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Signal cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#556a85] text-xs">
            No signals matching filter
          </div>
        ) : (
          filtered.map((sig, i) => (
            <SignalCard key={`${sig.t}-${sig.ts}-${i}`} sig={sig} />
          ))
        )}
      </div>
    </div>
  );
}

function SignalCard({ sig }: { sig: WorkerSignal }) {
  const color = SIGNAL_COLORS[sig.t] || '#8b9cb8';
  const isBull = sig.b === 'bullish';
  const dirColor = isBull ? 'text-[#00c896]' : 'text-[#ff4757]';
  const verLabel = ['Pending', 'Verified', 'Missed', 'Expired'][sig.ver] || '—';

  return (
    <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-mono font-medium text-[#e8edf5]">{sig.t}</span>
          <span className={`text-[10px] font-mono font-medium ${dirColor}`}>
            {isBull ? '▲' : '▼'} {sig.b}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#e8edf5]">{sig.c}%</span>
          <span className="text-[8px] text-[#556a85]">{ageStr(sig.ts)}</span>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="h-1 bg-[#151d2e] rounded-full mb-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${sig.c}%`, backgroundColor: color }}
        />
      </div>

      {sig.d && (
        <p className="text-[9px] text-[#8b9cb8] leading-tight mb-1 line-clamp-2">{sig.d}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#151d2e] text-[#556a85]">
          @{sig.p.toFixed(2)}
        </span>
        {sig.cf > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-[#3b82f6]/10 text-[#3b82f6]">
            CF:{sig.cf}
          </span>
        )}
        <span className={`text-[8px] px-1.5 py-0.5 rounded ${
          sig.ver === 1 ? 'bg-[#00c896]/10 text-[#00c896]' : 'bg-[#151d2e] text-[#556a85]'
        }`}>
          {verLabel}
        </span>
      </div>
    </div>
  );
}
