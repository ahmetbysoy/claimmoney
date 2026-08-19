'use client';

import type { BozokState } from '@/hooks/use-bozok-worker';

function fmt(n: number, d = 2) {
  if (n === 0 || n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

function fmtPct(n: number) {
  if (n === 0 || n == null || isNaN(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}

const REGIME_COLORS: Record<string, string> = {
  DEAD: '#556a85',
  TRENDING: '#00c896',
  CHOPPY: '#ffa502',
  COILING: '#3b82f6',
  CHAOS: '#ff4757',
};

const REGIME_EMOJI: Record<string, string> = {
  DEAD: '⚪',
  TRENDING: '🟢',
  CHOPPY: '🟠',
  COILING: '🔵',
  CHAOS: '🔴',
};

interface Props {
  state: BozokState;
  onArmPlan: () => void;
  onCancelPlan: () => void;
}

export default function LevelsPanel({ state, onArmPlan, onCancelPlan }: Props) {
  const regColor = REGIME_COLORS[state.regime] || '#556a85';
  const regEmoji = REGIME_EMOJI[state.regime] || '⚪';
  const hasPlan = state.planState !== 'NEUTRAL';
  const isCandidate = state.planState === 'CANDIDATE';
  const isArmed = state.planState === 'ARMED';
  const dirColor = state.planDir === 'LONG' ? '#00c896' : state.planDir === 'SHORT' ? '#ff4757' : '#8b9cb8';

  // Confluence breakdown from recent signals
  const cfTypes = state.sigs.slice(0, 6).map(s => {
    const base = s.t.replace(/_BULL_|_BEAR_/, ' ');
    return base;
  });

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      {/* Regime Card */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{regEmoji}</span>
            <span className="text-sm font-medium" style={{ color: regColor }}>{state.regime}</span>
            <span className="text-[10px] text-[#556a85] font-mono">Score: {state.regimeScore}</span>
          </div>
        </div>
        {state.narrative && (
          <p className="text-[10px] text-[#8b9cb8] leading-relaxed">{state.narrative}</p>
        )}
      </div>

      {/* Confluence Breakdown */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
        <div className="text-[10px] text-[#556a85] mb-2 uppercase tracking-wider">Confluence Breakdown</div>
        <div className="flex flex-wrap gap-1">
          {cfTypes.length > 0 ? cfTypes.map((t, i) => (
            <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-[#202d42] text-[#e8edf5] border border-[#1c2940]">
              {t}
            </span>
          )) : (
            <span className="text-[10px] text-[#556a85]">No active signals</span>
          )}
        </div>
        <div className="mt-2 text-[10px] text-[#556a85]">
          Active Signals: <span className="text-[#e8edf5] font-mono">{state.sigs.length}</span>
          {' | '}VPIN: <span className={`font-mono ${state.vpin > 0.7 ? 'text-[#ff4757]' : 'text-[#e8edf5]'}`}>{fmt(state.vpin)}</span>
        </div>
      </div>

      {/* Plan Card */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-[#556a85] uppercase tracking-wider">Trading Plan</div>
          <span className={`text-[9px] px-2 py-0.5 rounded font-medium ${
            isArmed ? 'bg-[#00c896]/10 text-[#00c896] border border-[#00c896]/30' :
            isCandidate ? 'bg-[#ffa502]/10 text-[#ffa502] border border-[#ffa502]/30' :
            'bg-[#151d2e] text-[#556a85]'
          }`}>
            {state.planState}
          </span>
        </div>

        {hasPlan ? (
          <>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-mono font-bold" style={{ color: dirColor }}>
                {state.planDir === 'LONG' ? '▲' : state.planDir === 'SHORT' ? '▼' : '—'} {state.planDir}
              </span>
              <span className="text-[10px] text-[#556a85]">Conf: <span className="text-[#e8edf5] font-mono">{state.planConf}%</span></span>
              <span className="text-[10px] text-[#556a85]">RR: <span className="text-[#e8edf5] font-mono">{fmt(state.planRR)}</span></span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
              <div className="text-[#556a85]">Entry: <span className="text-[#e8edf5]">{fmt(state.planEntry)}</span></div>
              <div className="text-[#556a85]">SL: <span className="text-[#ff4757]">{fmt(state.planSL)}</span></div>
              <div className="text-[#556a85]">TP: <span className="text-[#00c896]">{fmt(state.planTP)}</span></div>
              <div className="text-[#556a85]">Confluence: <span className="text-[#3b82f6]">{state.planConfluence}/6</span></div>
            </div>

            {state.planTTL > 0 && (
              <div className="mt-1 text-[9px] text-[#556a85]">TTL: {state.planTTL}s</div>
            )}

            <div className="flex gap-2 mt-3">
              {isCandidate && (
                <button
                  onClick={onArmPlan}
                  className="flex-1 py-2 rounded bg-[#00c896]/10 text-[#00c896] text-xs font-medium border border-[#00c896]/30 active:bg-[#00c896]/20 transition-colors"
                >
                  ▶ ARM PLAN
                </button>
              )}
              <button
                onClick={onCancelPlan}
                className="flex-1 py-2 rounded bg-[#ff4757]/10 text-[#ff4757] text-xs font-medium border border-[#ff4757]/30 active:bg-[#ff4757]/20 transition-colors"
              >
                ✕ CANCEL
              </button>
            </div>
          </>
        ) : (
          <div className="text-[10px] text-[#556a85] py-2 text-center">
            No active plan — awaiting confluence
          </div>
        )}
      </div>

      {/* Micro Optimizer */}
      {state.micro && (
        <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
          <div className="text-[10px] text-[#556a85] mb-2 uppercase tracking-wider">Micro Optimizer</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
            <div className="text-[#556a85]">Risk: <span className="text-[#e8edf5]">{state.micro.riskPct}%</span></div>
            <div className="text-[#556a85]">Lev: <span className="text-[#e8edf5]">{state.micro.lev}x</span></div>
            <div className="text-[#556a85]">Notional: <span className="text-[#e8edf5]">${(state.micro.notional / 1000).toFixed(1)}K</span></div>
            <div className="text-[#556a85]">Margin: <span className="text-[#e8edf5]">${state.micro.margin.toFixed(0)}</span></div>
            <div className="text-[#556a85]">BE: <span className="text-[#e8edf5]">{fmt(state.micro.be)}</span></div>
            <div className="text-[#556a85]">Liq: <span className="text-[#ff4757]">{fmt(state.micro.liq)}</span></div>
            <div className="text-[#556a85]">Kelly: <span className="text-[#3b82f6]">{state.micro.kelly}%</span></div>
            <div className="text-[#556a85]">Order: <span className="text-[#ffa502]">{state.micro.ordT}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
