'use client';

import { useRef, useEffect } from 'react';
import type { BozokState } from '@/hooks/use-bozok-worker';

function fmt(n: number, d = 2) {
  if (n === 0 || n == null || isNaN(n)) return '—';
  return n.toFixed(d);
}

interface Props {
  state: BozokState;
}

export default function DepthPanel({ state }: Props) {
  const cvdCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // CVD chart
  useEffect(() => {
    const canvas = cvdCanvasRef.current;
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

      const cvds = state.cvds;
      if (cvds.length < 2) {
        ctx.fillStyle = '#556a85';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Awaiting CVD data...', W / 2, H / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const midY = H / 2;
      let min = Infinity, max = -Infinity;
      for (const v of cvds) { min = Math.min(min, v); max = Math.max(max, v); }
      const range = max - min || 1;
      const pad = range * 0.1;
      min -= pad; max += pad;
      const totalRange = max - min;

      // Zero line
      if (min < 0 && max > 0) {
        const zeroY = midY - (-min / totalRange) * H;
        ctx.strokeStyle = '#1c2940';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, zeroY);
        ctx.lineTo(W, zeroY);
        ctx.stroke();
      }

      // CVD line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < cvds.length; i++) {
        const x = (i / (cvds.length - 1)) * W;
        const y = midY - ((cvds[i] - min) / totalRange) * H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill under
      const lastX = W;
      const lastY = midY - ((cvds[cvds.length - 1] - min) / totalRange) * H;
      ctx.lineTo(lastX, midY);
      ctx.lineTo(0, midY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.fill();

      // Current CVD label
      ctx.fillStyle = '#3b82f6';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('CVD: ' + fmt(state.cvd, 0), 4, 14);

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.cvds, state.cvd]);

  // DOM Ladder
  const maxRows = 15;
  const bids = state.bidP.slice(0, maxRows).map((p, i) => ({
    price: p,
    qty: state.bidQ[i] || 0,
    notional: p * (state.bidQ[i] || 0),
  }));
  const asks = state.askP.slice(0, maxRows).map((p, i) => ({
    price: p,
    qty: state.askQ[i] || 0,
    notional: p * (state.askQ[i] || 0),
  })).reverse();

  const maxNot = Math.max(
    ...bids.map(b => b.notional),
    ...asks.map(a => a.notional),
    1,
  );

  function fmtK(n: number) {
    if (n === 0) return '0';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* CVD chart */}
      <div className="h-1/3 min-h-[100px] px-2 pt-2">
        <canvas ref={cvdCanvasRef} className="w-full h-full" style={{ display: 'block' }} />
      </div>

      {/* Ladder DOM */}
      <div className="flex-1 min-h-0 overflow-hidden px-2 pb-2">
        <div className="h-full flex flex-col justify-center text-[10px] font-mono">
          {/* Header */}
          <div className="flex text-[#556a85] text-[9px] mb-1">
            <div className="w-[30%] text-right">Price</div>
            <div className="w-[25%] text-right">Qty</div>
            <div className="w-[45%] text-right">Notional</div>
          </div>

          {/* Asks */}
          {asks.map((a, i) => (
            <div key={`a${i}`} className="flex items-center h-[18px]">
              <div className="w-[30%] text-right text-[#ff4757] pr-1">{a.price.toFixed(2)}</div>
              <div className="w-[25%] text-right text-[#e8edf5] pr-1">{a.qty.toFixed(4)}</div>
              <div className="w-[45%] relative h-full">
                <div
                  className="absolute right-0 top-0 h-full bg-[#ff4757]/20"
                  style={{ width: `${(a.notional / maxNot) * 100}%` }}
                />
                <div className="absolute right-1 top-0 h-full flex items-center text-[#e8edf5]">
                  {fmtK(a.notional)}
                </div>
              </div>
            </div>
          ))}

          {/* Mid */}
          <div className="flex items-center h-[20px] bg-[#ffa502]/10 border-y border-[#ffa502]/30 my-0.5">
            <div className="w-[30%] text-right text-[#ffa502] font-bold pr-1">{state.mid.toFixed(2)}</div>
            <div className="w-[25%] text-right text-[#ffa502] pr-1">SPREAD</div>
            <div className="w-[45%] text-right text-[#ffa502]">{fmt(state.spBps, 1)} bps</div>
          </div>

          {/* Bids */}
          {bids.map((b, i) => (
            <div key={`b${i}`} className="flex items-center h-[18px]">
              <div className="w-[30%] text-right text-[#00c896] pr-1">{b.price.toFixed(2)}</div>
              <div className="w-[25%] text-right text-[#e8edf5] pr-1">{b.qty.toFixed(4)}</div>
              <div className="w-[45%] relative h-full">
                <div
                  className="absolute right-0 top-0 h-full bg-[#00c896]/20"
                  style={{ width: `${(b.notional / maxNot) * 100}%` }}
                />
                <div className="absolute right-1 top-0 h-full flex items-center text-[#e8edf5]">
                  {fmtK(b.notional)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
