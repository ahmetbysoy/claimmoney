'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import type { BozokState } from '@/hooks/use-bozok-worker';

type LayerKey = 'liquidity' | 'wall' | 'spoof' | 'iceberg' | 'vpvr' | 'liqpool' | 'velocity';

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'liquidity', label: 'Liquidity' },
  { key: 'wall', label: 'Wall' },
  { key: 'spoof', label: 'Spoof' },
  { key: 'iceberg', label: 'Iceberg' },
  { key: 'vpvr', label: 'VPVR' },
  { key: 'liqpool', label: 'LiqPool' },
  { key: 'velocity', label: 'Velocity' },
];

function fmt(n: number, d = 2) {
  if (n === 0 || n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

function fmtK(n: number) {
  if (n === 0 || n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}

interface Props {
  state: BozokState;
}

export default function BookPanel({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [activeLayers, setActiveLayers] = useState<Set<LayerKey>>(new Set(['liquidity']));

  const toggleLayer = (k: LayerKey) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // Canvas drawing
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

      if (state.bN === 0 || state.aN === 0) {
        ctx.fillStyle = '#556a85';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting book data...', W / 2, H / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const midY = H / 2;
      const maxLevels = Math.min(25, Math.floor(midY / 5));
      const barH = Math.max(2, midY / maxLevels);

      let maxQ = 0;
      for (let i = 0; i < Math.min(state.bN, maxLevels); i++) maxQ = Math.max(maxQ, state.bidQ[i]);
      for (let i = 0; i < Math.min(state.aN, maxLevels); i++) maxQ = Math.max(maxQ, state.askQ[i]);
      if (maxQ === 0) maxQ = 1;

      // Draw asks (top half)
      for (let i = 0; i < Math.min(state.aN, maxLevels); i++) {
        const q = state.askQ[i];
        const intensity = q / maxQ;
        ctx.fillStyle = `rgba(255,71,87,${0.2 + 0.8 * intensity})`;
        const barW = intensity * W * 0.8;
        const y = midY - (i + 1) * barH;
        ctx.fillRect(0, y, barW, barH - 0.5);

        if (i % 2 === 0 || i < 2) {
          ctx.fillStyle = '#8b9cb8';
          ctx.font = '9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(state.askP[i].toFixed(1), barW + 4, y + barH - 1);
          ctx.fillStyle = '#ff4757';
          ctx.textAlign = 'right';
          ctx.fillText(q.toFixed(4), W - 2, y + barH - 1);
        }
      }

      // Draw bids (bottom half)
      for (let i = 0; i < Math.min(state.bN, maxLevels); i++) {
        const q = state.bidQ[i];
        const intensity = q / maxQ;
        ctx.fillStyle = `rgba(0,200,150,${0.2 + 0.8 * intensity})`;
        const barW = intensity * W * 0.8;
        const y = midY + i * barH;
        ctx.fillRect(0, y, barW, barH - 0.5);

        if (i % 2 === 0 || i < 2) {
          ctx.fillStyle = '#8b9cb8';
          ctx.font = '9px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(state.bidP[i].toFixed(1), barW + 4, y + barH - 1);
          ctx.fillStyle = '#00c896';
          ctx.textAlign = 'right';
          ctx.fillText(q.toFixed(4), W - 2, y + barH - 1);
        }
      }

      // Mid price line
      ctx.strokeStyle = '#ffa502';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(W, midY);
      ctx.stroke();

      ctx.fillStyle = '#ffa502';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state.mid.toFixed(2), W / 2, midY - 4);

      // Wall markers
      if (activeLayers.has('wall')) {
        ctx.font = '8px monospace';
        for (let i = 0; i < state.wBC; i++) {
          ctx.fillStyle = 'rgba(59,130,246,0.7)';
          ctx.textAlign = 'left';
          ctx.fillText(`■W ${state.wBE[i].toFixed(0)}%`, 2, midY + i * 12 + 12);
        }
        for (let i = 0; i < state.wAC; i++) {
          ctx.fillStyle = 'rgba(249,115,22,0.7)';
          ctx.textAlign = 'left';
          ctx.fillText(`■W ${state.wAE[i].toFixed(0)}%`, 2, midY - (i + 1) * 12);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, activeLayers]);

  // Metrics
  const bidDepth = useMemo(() => {
    let d = 0;
    for (let i = 0; i < Math.min(10, state.bN); i++) d += state.bidP[i] * state.bidQ[i];
    return d;
  }, [state.bidP, state.bidQ, state.bN]);

  const askDepth = useMemo(() => {
    let d = 0;
    for (let i = 0; i < Math.min(10, state.aN); i++) d += state.askP[i] * state.askQ[i];
    return d;
  }, [state.askP, state.askQ, state.aN]);

  const skewVal = (bidDepth + askDepth) > 0 ? ((bidDepth - askDepth) / (bidDepth + askDepth)) * 100 : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-1 px-3 py-2 flex-wrap">
        {LAYERS.map(l => (
          <button
            key={l.key}
            onClick={() => toggleLayer(l.key)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              activeLayers.has(l.key)
                ? 'bg-[#202d42] text-[#e8edf5] border border-[#3b82f6]'
                : 'bg-[#0f1520] text-[#556a85] border border-[#1c2940]'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 px-2">
        <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-2">
        <MetricBox label="Bid Depth" value={fmtK(bidDepth)} color="text-[#00c896]" />
        <MetricBox label="Ask Depth" value={fmtK(askDepth)} color="text-[#ff4757]" />
        <MetricBox label="Spread" value={fmt(state.spBps, 1) + 'bps'} />
        <MetricBox label="Microprice" value={fmt(state.mp)} />
        <MetricBox label="OBI" value={fmt(state.obi * 100, 1) + '%'} color={state.obi >= 0 ? 'text-[#00c896]' : 'text-[#ff4757]'} />
        <MetricBox label="Skew" value={fmt(skewVal, 1) + '%'} color={skewVal >= 0 ? 'text-[#00c896]' : 'text-[#ff4757]'} />
        <MetricBox label="OBI-5" value={fmt(state.obi5 * 100, 1) + '%'} />
        <MetricBox label="OBI-20" value={fmt(state.obi20 * 100, 1) + '%'} />
        <MetricBox label="Book Vel" value={fmtK(state.bookVelScore)} />
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = 'text-[#e8edf5]' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0f1520] rounded px-2 py-1">
      <div className="text-[9px] text-[#556a85]">{label}</div>
      <div className={`text-xs font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}
