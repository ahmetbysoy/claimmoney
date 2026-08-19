'use client';

import { useRef, useEffect, useMemo } from 'react';
import type { BozokState, WorkerFlow } from '@/hooks/use-bozok-worker';

function fmtK(n: number) {
  if (n === 0 || n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

interface Props {
  state: BozokState;
}

export default function FlowPanel({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const lastFlow = useMemo(() => {
    if (state.flows.length === 0) return null;
    return state.flows[state.flows.length - 1];
  }, [state.flows]);

  // Delta bar chart canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const W = rect.width;
      const H = rect.height;

      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, W, H);

      const flows = state.flows;
      if (flows.length < 2) {
        ctx.fillStyle = '#556a85';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting flow data...', W / 2, H / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const maxBars = Math.min(30, flows.length);
      const bars = flows.slice(-maxBars);
      const midY = H / 2;
      const barW = Math.max(2, (W / maxBars) * 0.7);
      const gap = (W - barW * maxBars) / (maxBars + 1);

      let maxAbs = 0;
      for (const f of bars) maxAbs = Math.max(maxAbs, Math.abs(f.d));
      if (maxAbs === 0) maxAbs = 1;

      // Zero line
      ctx.strokeStyle = '#1c2940';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(W, midY);
      ctx.stroke();

      for (let i = 0; i < bars.length; i++) {
        const f = bars[i];
        const x = gap + i * (barW + gap);
        const h = (f.d / maxAbs) * (midY - 10);

        if (f.d >= 0) {
          ctx.fillStyle = `rgba(0,200,150,${0.4 + 0.6 * Math.abs(f.d / maxAbs)})`;
          ctx.fillRect(x, midY - h, barW, h);
        } else {
          ctx.fillStyle = `rgba(255,71,87,${0.4 + 0.6 * Math.abs(f.d / maxAbs)})`;
          ctx.fillRect(x, midY, barW, -h);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.flows]);

  const delta = lastFlow ? lastFlow.d : 0;
  const buyN = lastFlow ? lastFlow.b : 0;
  const sellN = lastFlow ? lastFlow.sl : 0;
  const totalNotional = buyN + sellN;
  const absorptionDir = state.absorption?.side || null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Delta chart */}
      <div className="flex-1 min-h-0 px-2 pt-2">
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
      </div>

      {/* Flow metrics */}
      <div className="grid grid-cols-3 gap-1 p-2">
        <FlowMetric label="Delta" value={fmtK(delta)} color={delta >= 0 ? 'text-[#00c896]' : 'text-[#ff4757]'} />
        <FlowMetric label="Buy Not" value={fmtK(buyN)} color="text-[#00c896]" />
        <FlowMetric label="Sell Not" value={fmtK(sellN)} color="text-[#ff4757]" />
        <FlowMetric label="Tape Rate" value={state.tradeRate1s.toFixed(0) + '/s'} />
        <FlowMetric label="Whale T1" value={state.whaleT1.toString()} color="text-[#3b82f6]" />
        <FlowMetric label="Whale T3" value={state.whaleT3.toString()} color="text-[#8b5cf6]" />
      </div>

      {/* Absorption indicator */}
      <div className="px-3 pb-2">
        <div className={`text-[10px] font-medium px-2 py-1 rounded ${
          absorptionDir
            ? absorptionDir === 'bid'
              ? 'bg-[#00c896]/10 text-[#00c896] border border-[#00c896]/30'
              : 'bg-[#ff4757]/10 text-[#ff4757] border border-[#ff4757]/30'
            : 'bg-[#0f1520] text-[#556a85]'
        }`}>
          Absorption: {absorptionDir ? `${absorptionDir.toUpperCase()} @ ${state.absorption?.level?.toFixed(2)}` : 'None'}
        </div>
      </div>

      {/* Liquidation counts */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-2">
        <div className="bg-[#0f1520] rounded px-2 py-1">
          <span className="text-[9px] text-[#556a85]">Liq Long (60s) </span>
          <span className="text-xs font-mono text-[#ff4757] font-medium">{state.liqLong}</span>
        </div>
        <div className="bg-[#0f1520] rounded px-2 py-1">
          <span className="text-[9px] text-[#556a85]">Liq Short (60s) </span>
          <span className="text-xs font-mono text-[#00c896] font-medium">{state.liqShort}</span>
        </div>
      </div>
    </div>
  );
}

function FlowMetric({ label, value, color = 'text-[#e8edf5]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f1520] rounded px-2 py-1">
      <div className="text-[9px] text-[#556a85]">{label}</div>
      <div className={`text-xs font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}
