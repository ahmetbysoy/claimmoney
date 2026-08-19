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

// Demo performance data (would come from DB in production)
const DEMO_PERF = {
  trades: 142,
  winRate: 58.3,
  netR: 12.4,
  pf: 1.87,
  sharpe: 2.14,
  maxDD: 4.2,
  avgWin: 1.3,
  avgLoss: -0.7,
  expectancy: 0.42,
};

// Simulated equity curve
const EQUITY_CURVE = (() => {
  const pts: number[] = [10000];
  for (let i = 1; i <= 60; i++) {
    const change = (Math.random() - 0.42) * 80;
    pts.push(Math.max(pts[i - 1] + change, 8000));
  }
  return pts;
})();

// Confidence calibration bins
const CAL_BINS = [
  { range: '0-20%', pred: 18, actual: 22 },
  { range: '20-40%', pred: 35, actual: 30 },
  { range: '40-60%', pred: 52, actual: 55 },
  { range: '60-80%', pred: 72, actual: 68 },
  { range: '80-100%', pred: 90, actual: 85 },
];

export default function PerfPanel({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // Equity chart
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

      const data = EQUITY_CURVE;
      let min = Infinity, max = -Infinity;
      for (const v of data) { min = Math.min(min, v); max = Math.max(max, v); }
      const pad = (max - min) * 0.1;
      min -= pad; max += pad;
      const range = max - min || 1;

      // Grid lines
      ctx.strokeStyle = '#1c2940';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = (i / 4) * H;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        const val = max - (i / 4) * range;
        ctx.fillStyle = '#556a85';
        ctx.font = '9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('$' + val.toFixed(0), W - 4, y - 2);
      }

      // Starting capital line
      const startY = ((10000 - min) / range) * H;
      ctx.strokeStyle = '#556a8540';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(0, H - startY); ctx.lineTo(W, H - startY); ctx.stroke();
      ctx.setLineDash([]);

      // Equity line
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * W;
        const y = H - ((data[i] - min) / range) * H;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(59,130,246,0.06)';
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-3">
      {/* Top stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3 text-center">
          <div className="text-[9px] text-[#556a85] mb-1">Trades</div>
          <div className="text-lg font-mono font-bold text-[#e8edf5]">{DEMO_PERF.trades}</div>
        </div>
        <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3 text-center">
          <div className="text-[9px] text-[#556a85] mb-1">Win %</div>
          <div className={`text-lg font-mono font-bold ${DEMO_PERF.winRate >= 50 ? 'text-[#00c896]' : 'text-[#ff4757]'}`}>
            {fmt(DEMO_PERF.winRate, 1)}%
          </div>
        </div>
        <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3 text-center">
          <div className="text-[9px] text-[#556a85] mb-1">Net R</div>
          <div className={`text-lg font-mono font-bold ${DEMO_PERF.netR >= 0 ? 'text-[#00c896]' : 'text-[#ff4757]'}`}>
            {fmt(DEMO_PERF.netR, 1)}R
          </div>
        </div>
      </div>

      {/* Equity chart */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-2">
        <div className="text-[10px] text-[#556a85] mb-1 uppercase tracking-wider px-1">Equity Curve</div>
        <div className="h-[160px]">
          <canvas ref={canvasRef} className="w-full h-full" style={{ display: 'block' }} />
        </div>
      </div>

      {/* Stats table */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
        <div className="text-[10px] text-[#556a85] mb-2 uppercase tracking-wider">Statistics</div>
        <div className="grid grid-cols-2 gap-y-1 text-[10px] font-mono">
          <div className="text-[#556a85]">Profit Factor</div>
          <div className="text-right text-[#e8edf5]">{fmt(DEMO_PERF.pf)}</div>
          <div className="text-[#556a85]">Sharpe Ratio</div>
          <div className="text-right text-[#3b82f6]">{fmt(DEMO_PERF.sharpe)}</div>
          <div className="text-[#556a85]">Max Drawdown</div>
          <div className="text-right text-[#ff4757]">{fmt(DEMO_PERF.maxDD, 1)}%</div>
          <div className="text-[#556a85]">Avg Win</div>
          <div className="text-right text-[#00c896]">{fmt(DEMO_PERF.avgWin, 1)}R</div>
          <div className="text-[#556a85]">Avg Loss</div>
          <div className="text-right text-[#ff4757]">{fmt(DEMO_PERF.avgLoss, 1)}R</div>
          <div className="text-[#556a85]">Expectancy</div>
          <div className="text-right text-[#e8edf5]">{fmt(DEMO_PERF.expectancy, 2)}R</div>
        </div>
      </div>

      {/* Confidence calibration */}
      <div className="bg-[#0f1520] rounded-lg border border-[#1c2940] p-3">
        <div className="text-[10px] text-[#556a85] mb-2 uppercase tracking-wider">Confidence Calibration</div>
        <div className="space-y-1">
          <div className="flex text-[9px] text-[#556a85]">
            <div className="w-[60px]">Bin</div>
            <div className="flex-1 text-right">Pred</div>
            <div className="flex-1 text-right">Actual</div>
          </div>
          {CAL_BINS.map(bin => {
            const diff = Math.abs(bin.actual - bin.pred);
            const barColor = diff < 5 ? '#00c896' : diff < 10 ? '#ffa502' : '#ff4757';
            return (
              <div key={bin.range} className="flex items-center text-[10px] font-mono">
                <div className="w-[60px] text-[#556a85]">{bin.range}</div>
                <div className="flex-1">
                  <div className="h-2 bg-[#151d2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bin.pred}%`, backgroundColor: '#3b82f640' }} />
                  </div>
                </div>
                <div className="w-[30px] text-right text-[#e8edf5]">{bin.pred}%</div>
                <div className="flex-1">
                  <div className="h-2 bg-[#151d2e] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${bin.actual}%`, backgroundColor: barColor }} />
                  </div>
                </div>
                <div className="w-[30px] text-right" style={{ color: barColor }}>{bin.actual}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
