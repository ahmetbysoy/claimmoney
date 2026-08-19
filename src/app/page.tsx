'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity, BarChart3, Shield, Play, Square, FolderOpen,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Zap, Target, Clock, DollarSign, Percent, LineChart,
  Radio, Eye, BrainCircuit, Stethoscope, RefreshCcw,
} from 'lucide-react';

// ============================================================
// Types & Demo State
// ============================================================

interface FeatureBar {
  label: string;
  value: number;  // -2 to +2
  valid: boolean;
  warmup: number;
}

interface SignalEntry {
  id: string;
  side: 'BUY' | 'SELL';
  ts: number;
  price: number;
  score: number;
  confidence: number;
  filters: { id: string; pass: boolean; reason: string; mode: string }[];
}

interface PositionEntry {
  id: string;
  side: 'BUY' | 'SELL';
  entry: number;
  current: number;
  sl: number;
  tp1: number;
  tp2: number;
  qty: number;
  pnl: number;
  rMult: number;
  status: string;
}

interface DetectorEntry {
  name: string;
  side: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  ts: number;
}

function generateDemoFeatures(): FeatureBar[] {
  return [
    { label: 'CVD', value: 0.8 + Math.random() * 0.5, valid: true, warmup: 45 },
    { label: 'OBI', value: -0.4 + Math.random() * 0.8, valid: true, warmup: 30 },
    { label: 'VEL', value: 1.2 + Math.random() * 0.6, valid: true, warmup: 60 },
    { label: 'MICRO', value: -0.2 + Math.random() * 0.4, valid: true, warmup: 20 },
    { label: 'VPIN', value: Math.random() * 0.5, valid: true, warmup: 40 },
    { label: 'DET', value: 0.5 + Math.random() * 1.0, valid: Math.random() > 0.3, warmup: 15 },
  ];
}

function generateDemoSignals(): SignalEntry[] {
  const sides: Array<'BUY' | 'SELL'> = ['BUY', 'SELL'];
  return Array.from({ length: 12 }, (_, i) => ({
    id: `sig-${i}`,
    side: sides[i % 2],
    ts: Date.now() - (12 - i) * 30000,
    price: 62500 + Math.sin(i) * 500,
    score: 0.4 + Math.random() * 0.5,
    confidence: 0.3 + Math.random() * 0.5,
    filters: [
      { id: 'flat', pass: true, reason: '', mode: 'hard-veto' },
      { id: 'obi', pass: i % 3 !== 0, reason: i % 3 === 0 ? 'OBI too low' : '', mode: 'hard-veto' },
      { id: 'vpin', pass: true, reason: '', mode: 'hard-veto' },
    ],
  }));
}

function generateDemoPositions(): PositionEntry[] {
  return [
    { id: 'p1', side: 'BUY', entry: 62400, current: 62680, sl: 62100, tp1: 62800, tp2: 63300, qty: 0.05, pnl: 14, rMult: 0.7, status: 'open' },
    { id: 'p2', side: 'SELL', entry: 63100, current: 62850, sl: 63400, tp1: 62700, tp2: 62200, qty: 0.03, pnl: 7.5, rMult: 0.5, status: 'tp1_hit' },
  ];
}

function generateDemoDetectors(): DetectorEntry[] {
  return [
    { name: 'Wall', side: 'bullish', confidence: 0.7, ts: Date.now() - 5000 },
    { name: 'Compression', side: 'neutral', confidence: 0.4, ts: Date.now() - 8000 },
    { name: 'Skew', side: 'bullish', confidence: 0.3, ts: Date.now() - 3000 },
    { name: 'Void', side: 'neutral', confidence: 0, ts: Date.now() - 20000 },
    { name: 'Ladder', side: 'bearish', confidence: 0.2, ts: Date.now() - 12000 },
    { name: 'Spoof', side: 'neutral', confidence: 0, ts: Date.now() - 30000 },
    { name: 'Iceberg', side: 'bullish', confidence: 0.5, ts: Date.now() - 2000 },
    { name: 'FlowExp', side: 'bearish', confidence: 0.6, ts: Date.now() - 1000 },
    { name: 'LiqCluster', side: 'neutral', confidence: 0, ts: Date.now() - 60000 },
  ];
}

// ============================================================
// Sub-Components
// ============================================================

function FeatureBarChart({ features }: { features: FeatureBar[] }) {
  return (
    <div className="space-y-2">
      {features.map((f) => {
        const pct = Math.min(100, Math.max(0, ((f.value + 2) / 4) * 100));
        const isBull = f.value > 0.1;
        const isBear = f.value < -0.1;
        return (
          <div key={f.label} className="flex items-center gap-3">
            <span className="w-12 text-xs font-mono text-muted-foreground text-right">{f.label}</span>
            <div className="flex-1 relative h-6 bg-muted rounded-sm overflow-hidden">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-10" />
              {/* Fill from center */}
              <div
                className={`absolute top-0 h-full transition-all duration-300 ${
                  isBull ? 'bg-emerald-500/70 left-1/2' : isBear ? 'bg-red-500/70 right-1/2' : 'bg-muted-foreground/20 left-[45%] w-[10%]'
                }`}
                style={{ width: `${Math.abs(pct - 50)}%` }}
              />
            </div>
            <span className={`w-14 text-xs font-mono text-right ${!f.valid ? 'text-muted-foreground/50' : isBull ? 'text-emerald-400' : isBear ? 'text-red-400' : 'text-muted-foreground'}`}>
              {f.valid ? f.value.toFixed(2) : '---'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const angle = score * 90; // -90 to +90
  const color = score > 0.2 ? 'text-emerald-400' : score < -0.2 ? 'text-red-400' : 'text-yellow-400';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 60" className="w-full h-full">
          {/* Background arc */}
          <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" strokeLinecap="round" />
          {/* Score arc */}
          <path
            d="M 10 55 A 40 40 0 0 1 90 55"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className={color}
            strokeDasharray={`${Math.abs(angle) * 1.4} 200`}
            strokeDashoffset={angle > 0 ? 0 : 0}
            transform={angle >= 0 ? '' : `scale(-1,1) translate(-100,0)`}
            style={{ opacity: Math.abs(score) * 2 }}
          />
          {/* Needle */}
          <line
            x1="50" y1="55"
            x2="50" y2="20"
            stroke="currentColor"
            strokeWidth="2"
            className={color}
            transform={`rotate(${angle}, 50, 55)`}
          />
          <circle cx="50" cy="55" r="3" fill="currentColor" className={color} />
        </svg>
      </div>
      <span className={`text-2xl font-bold font-mono ${color}`}>{score.toFixed(3)}</span>
      <span className="text-xs text-muted-foreground">Composite Score</span>
    </div>
  );
}

function SignalLed({ side, confidence, ts }: { side: 'BUY' | 'SELL' | null; confidence: number; ts: number }) {
  if (!side) return <div className="flex items-center gap-2 text-muted-foreground"><Radio className="w-4 h-4" /> <span className="text-sm">No signal</span></div>;
  const isBuy = side === 'BUY';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${isBuy ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
      <div className={`w-3 h-3 rounded-full animate-pulse ${isBuy ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <div>
        <span className={`font-bold text-lg ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>{side}</span>
        <span className="text-xs text-muted-foreground ml-2">{new Date(ts).toLocaleTimeString()}</span>
      </div>
      <Badge variant="outline" className="ml-auto text-xs">{(confidence * 100).toFixed(0)}%</Badge>
    </div>
  );
}

// ============================================================
// Tab 1: Radar (Main Screen)
// ============================================================

function RadarScreen() {
  const [features, setFeatures] = useState<FeatureBar[]>(generateDemoFeatures);
  const [score, setScore] = useState(0.65);
  const [lastSignal, setLastSignal] = useState<SignalEntry | null>(null);
  const [price, setPrice] = useState(62650.5);
  const [connected, setConnected] = useState(true);
  const [paperEnabled, setPaperEnabled] = useState(false);

  // Simulate live updates
  useEffect(() => {
    const iv = setInterval(() => {
      setFeatures(generateDemoFeatures());
      setScore(0.3 + Math.random() * 0.7 * (Math.random() > 0.3 ? 1 : -1));
      setPrice(p => p + (Math.random() - 0.48) * 50);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const compositeScore = useMemo(() => {
    let s = 0, w = 0;
    const wts = [0.25, 0.15, 0.15, 0.1, 0.05, 0.3];
    features.forEach((f, i) => { if (f.valid) { s += f.value * wts[i]; w += wts[i]; } });
    return w > 0 ? Math.max(-1, Math.min(1, s / w)) : 0;
  }, [features]);

  const regime = compositeScore > 0.3 ? 'trending_up' : compositeScore < -0.3 ? 'trending_down' : 'ranging';
  const regimeColors: Record<string, string> = { trending_up: 'bg-emerald-500/20 text-emerald-400', trending_down: 'bg-red-500/20 text-red-400', ranging: 'bg-yellow-500/20 text-yellow-400' };
  const validCount = features.filter(f => f.valid).length;
  const dq: 'good' | 'degraded' | 'invalid' = validCount >= 5 ? 'good' : validCount >= 3 ? 'degraded' : 'invalid';
  const dqColors: Record<string, string> = { good: 'bg-emerald-500/20 text-emerald-400', degraded: 'bg-yellow-500/20 text-yellow-400', invalid: 'bg-red-500/20 text-red-400' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Feature Bars */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="w-4 h-4" /> Feature Bars</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={regimeColors[regime]}>{regime.replace('_', ' ').toUpperCase()}</Badge>
              <Badge variant="outline" className={dqColors[dq]}>{dq.toUpperCase()}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FeatureBarChart features={features} />
          <Separator className="my-4" />
          {/* Last Signal */}
          <SignalLed side={lastSignal?.side ?? null} confidence={lastSignal?.confidence ?? 0} ts={lastSignal?.ts ?? Date.now()} />
        </CardContent>
      </Card>

      {/* Right: Score Gauge + Price */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Score</CardTitle></CardHeader>
          <CardContent className="flex justify-center"><ScoreGauge score={compositeScore} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Market</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-mono font-bold">${price.toFixed(1)}</span>
              <Badge variant={connected ? 'default' : 'destructive'} className="gap-1">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {connected ? 'LIVE' : 'OFFLINE'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>BTC-USDT-SWAP</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Paper Trading</span>
              <button
                onClick={() => setPaperEnabled(!paperEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${paperEnabled ? 'bg-emerald-500' : 'bg-muted'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${paperEnabled ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Tab 2: Microstructure
// ============================================================

function MicrostructureScreen() {
  const [detectors] = useState<DetectorEntry[]>(generateDemoDetectors);
  const [signals] = useState<SignalEntry[]>(generateDemoSignals);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Detector Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Eye className="w-4 h-4" /> Detector Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {detectors.map((d) => {
              const isBull = d.side === 'bullish';
              const isBear = d.side === 'bearish';
              return (
                <div key={d.name} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                  <span className={`w-2 h-2 rounded-full ${d.confidence > 0 ? (isBull ? 'bg-emerald-400' : 'bg-red-400') : 'bg-muted-foreground/30'}`} />
                  <span className="w-24 text-sm font-mono text-muted-foreground">{d.name}</span>
                  <div className="flex-1">
                    <Progress value={d.confidence * 100} className="h-2" />
                  </div>
                  <Badge variant="outline" className={`text-xs ${isBull ? 'border-emerald-500/30 text-emerald-400' : isBear ? 'border-red-500/30 text-red-400' : 'text-muted-foreground'}`}>
                    {d.side}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-16 text-right">{(d.confidence * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filter Decisions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Shield className="w-4 h-4" /> Filter Decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <div className="space-y-3">
              {signals.slice(0, 8).map((s) => (
                <div key={s.id} className="p-3 rounded-md border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={s.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{s.side}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">{new Date(s.ts).toLocaleTimeString()}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">score: {s.score.toFixed(3)}</span>
                  </div>
                  <div className="flex gap-2">
                    {s.filters.map((f) => (
                      <Badge key={f.id} variant={f.pass ? 'outline' : 'destructive'} className="text-xs">
                        {f.id} {f.pass ? <CheckCircle2 className="w-3 h-3 ml-1" /> : <AlertTriangle className="w-3 h-3 ml-1" />}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Order Book Heatmap (simplified) */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Order Book Depth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {/* Bids */}
            <div className="flex-1 space-y-1">
              <div className="text-xs font-medium text-emerald-400 mb-2">BIDS</div>
              {Array.from({ length: 10 }, (_, i) => {
                const p = 62650 - (i + 1) * 0.5;
                const qty = (Math.random() * 5 + 0.5) * (i === 3 ? 8 : 1);
                const maxQty = 40;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-16 text-right text-muted-foreground">{p.toFixed(1)}</span>
                    <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-emerald-500/40 rounded-sm" style={{ width: `${(qty / maxQty) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right">{qty.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
            {/* Asks */}
            <div className="flex-1 space-y-1">
              <div className="text-xs font-medium text-red-400 mb-2">ASKS</div>
              {Array.from({ length: 10 }, (_, i) => {
                const p = 62651 + i * 0.5;
                const qty = (Math.random() * 5 + 0.5) * (i === 5 ? 10 : 1);
                const maxQty = 50;
                return (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono">
                    <span className="w-16 text-right">{p.toFixed(1)}</span>
                    <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-red-500/40 rounded-sm ml-auto" style={{ width: `${(qty / maxQty) * 100}%` }} />
                    </div>
                    <span className="w-12 text-right text-muted-foreground">{qty.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 3: Plan & Risk
// ============================================================

function PlanRiskScreen() {
  const positions = useMemo(() => generateDemoPositions(), []);

  const totalPnL = positions.reduce((s, p) => s + p.pnl, 0);
  const openCount = positions.filter(p => p.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Open Positions</div><div className="text-2xl font-bold font-mono">{openCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Total PnL</div><div className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${totalPnL.toFixed(2)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Portfolio Heat</div><div className="text-2xl font-bold font-mono">{(openCount * 2).toFixed(0)}%</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-xs text-muted-foreground">Max Daily Loss</div><div className="text-2xl font-bold font-mono">$500</div></CardContent></Card>
      </div>

      {/* Positions Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="w-4 h-4" /> Open Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left py-2 px-2">Side</th>
                  <th className="text-right py-2 px-2">Entry</th>
                  <th className="text-right py-2 px-2">Current</th>
                  <th className="text-right py-2 px-2">Stop</th>
                  <th className="text-right py-2 px-2">TP1</th>
                  <th className="text-right py-2 px-2">TP2</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">PnL</th>
                  <th className="text-right py-2 px-2">R</th>
                  <th className="text-right py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-2"><Badge className={p.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{p.side}</Badge></td>
                    <td className="text-right font-mono py-2 px-2">{p.entry.toFixed(1)}</td>
                    <td className="text-right font-mono py-2 px-2">{p.current.toFixed(1)}</td>
                    <td className="text-right font-mono py-2 px-2 text-red-400">{p.sl.toFixed(1)}</td>
                    <td className="text-right font-mono py-2 px-2 text-emerald-400">{p.tp1.toFixed(1)}</td>
                    <td className="text-right font-mono py-2 px-2 text-emerald-400">{p.tp2.toFixed(1)}</td>
                    <td className="text-right font-mono py-2 px-2">{p.qty}</td>
                    <td className={`text-right font-mono py-2 px-2 ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${p.pnl.toFixed(2)}</td>
                    <td className="text-right font-mono py-2 px-2">{p.rMult.toFixed(1)}R</td>
                    <td className="text-right py-2 px-2"><Badge variant="outline" className="text-xs">{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Trade Plan Template */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><LineChart className="w-4 h-4" /> Trade Plan Template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 text-sm">
            <div><span className="text-xs text-muted-foreground">Entry</span><div className="font-mono">$62,650</div></div>
            <div><span className="text-xs text-muted-foreground">Stop Loss</span><div className="font-mono text-red-400">$62,100</div></div>
            <div><span className="text-xs text-muted-foreground">TP1 (1R)</span><div className="font-mono text-emerald-400">$63,200</div></div>
            <div><span className="text-xs text-muted-foreground">TP2 (2.5R)</span><div className="font-mono text-emerald-400">$63,775</div></div>
            <div><span className="text-xs text-muted-foreground">Risk/Reward</span><div className="font-mono">2.5</div></div>
            <div><span className="text-xs text-muted-foreground">Position Size</span><div className="font-mono">0.05 BTC</div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 4: Paper Trading
// ============================================================

function PaperTradingScreen() {
  const [enabled, setEnabled] = useState(false);
  const [tradeCount, setTradeCount] = useState(47);

  const metrics = useMemo(() => ({
    winRate: 57.4,
    profitFactor: 1.65,
    sharpe: 2.1,
    maxDD: 4.2,
    avgR: 0.8,
    expectancy: 12.5,
    totalPnL: 587.5,
    startEquity: 10000,
    currentEquity: 10587.5,
  }), []);

  const history = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    id: `h${i}`,
    side: i % 2 === 0 ? 'BUY' as const : 'SELL' as const,
    entry: 62500 + Math.random() * 500,
    exit: 62500 + (Math.random() - 0.4) * 800,
    pnl: (Math.random() - 0.35) * 50,
    r: (Math.random() - 0.3) * 3,
    ts: Date.now() - (10 - i) * 600000,
  })), []);

  return (
    <div className="space-y-4">
      {/* Toggle + Equity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Play className="w-4 h-4" /> Paper Trading</CardTitle>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  enabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                }`}
              >
                {enabled ? <><Square className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Start</>}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-xs text-muted-foreground">Equity</div><div className="text-xl font-bold font-mono ${metrics.currentEquity >= metrics.startEquity ? 'text-emerald-400' : 'text-red-400'}">${metrics.currentEquity.toFixed(0)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total PnL</div><div className={`text-xl font-bold font-mono ${metrics.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${metrics.totalPnL > 0 ? '+' : ''}{metrics.totalPnL.toFixed(2)}</div></div>
              <div><div className="text-xs text-muted-foreground">Trades</div><div className="text-xl font-bold font-mono">{tradeCount}</div></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Performance</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Win Rate', value: `${metrics.winRate}%`, color: metrics.winRate > 50 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Profit Factor', value: metrics.profitFactor.toFixed(2), color: metrics.profitFactor > 1 ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Sharpe Ratio', value: metrics.sharpe.toFixed(1), color: metrics.sharpe > 1.5 ? 'text-emerald-400' : 'text-yellow-400' },
              { label: 'Max Drawdown', value: `${metrics.maxDD}%`, color: 'text-red-400' },
              { label: 'Avg R-Multiple', value: `${metrics.avgR}R`, color: metrics.avgR > 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <span className={`text-sm font-mono font-medium ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Trade History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-72">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 px-2">Side</th>
                <th className="text-right py-2 px-2">Entry</th>
                <th className="text-right py-2 px-2">Exit</th>
                <th className="text-right py-2 px-2">PnL</th>
                <th className="text-right py-2 px-2">R</th>
                <th className="text-right py-2 px-2">Time</th>
              </tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 px-2"><Badge className={h.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>{h.side}</Badge></td>
                    <td className="text-right font-mono py-2 px-2">{h.entry.toFixed(1)}</td>
                    <td className="text-right font-mono py-2 px-2">{h.exit.toFixed(1)}</td>
                    <td className={`text-right font-mono py-2 px-2 ${h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${h.pnl > 0 ? '+' : ''}{h.pnl.toFixed(2)}</td>
                    <td className="text-right font-mono py-2 px-2">{h.r.toFixed(1)}R</td>
                    <td className="text-right text-muted-foreground py-2 px-2">{new Date(h.ts).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Tab 5: Diagnostics
// ============================================================

function DiagnosticsScreen() {
  const featureStatus = [
    { name: 'CVD', valid: true, warmup: 45, ageMs: 120 },
    { name: 'OBI', valid: true, warmup: 30, ageMs: 80 },
    { name: 'Velocity', valid: true, warmup: 60, ageMs: 150 },
    { name: 'Microprice', valid: true, warmup: 20, ageMs: 200 },
    { name: 'VPIN', valid: true, warmup: 40, ageMs: 5000 },
    { name: 'Detector Score', valid: false, warmup: 8, ageMs: 12000 },
    { name: 'Volatility', valid: true, warmup: 55, ageMs: 100 },
  ];

  const wsStatus = { connected: true, latency: 12, reconnectCount: 0, lastMsgAt: Date.now() - 200, uptime: '02:34:12' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Feature Validity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><BrainCircuit className="w-4 h-4" /> Feature Warmup & Validity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {featureStatus.map(f => (
              <div key={f.name} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30">
                <div className={`w-2.5 h-2.5 rounded-full ${f.valid ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                <span className="w-28 text-sm font-mono">{f.name}</span>
                <div className="flex-1">
                  <Progress value={Math.min(100, (f.warmup / 60) * 100)} className="h-2" />
                </div>
                <span className="text-xs text-muted-foreground w-14 text-right">{f.warmup}/60</span>
                <span className={`text-xs w-16 text-right ${f.ageMs > 5000 ? 'text-yellow-400' : 'text-muted-foreground'}`}>{f.ageMs}ms</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WS Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><Stethoscope className="w-4 h-4" /> Connection Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-md border">
              <span className="text-xs text-muted-foreground">Status</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${wsStatus.connected ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="font-mono text-sm">{wsStatus.connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
            </div>
            <div className="p-3 rounded-md border">
              <span className="text-xs text-muted-foreground">Latency</span>
              <div className="font-mono text-sm mt-1">{wsStatus.latency}ms</div>
            </div>
            <div className="p-3 rounded-md border">
              <span className="text-xs text-muted-foreground">Reconnects</span>
              <div className="font-mono text-sm mt-1">{wsStatus.reconnectCount}</div>
            </div>
            <div className="p-3 rounded-md border">
              <span className="text-xs text-muted-foreground">Uptime</span>
              <div className="font-mono text-sm mt-1">{wsStatus.uptime}</div>
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Data Staleness</span>
            <Badge variant={wsStatus.lastMsgAt > Date.now() - 10000 ? 'default' : 'destructive'}>FRESH</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Heartbeat</span>
            <Badge variant="outline"><Zap className="w-3 h-3 mr-1" /> OK</Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Watchdog</span>
            <Badge variant="outline"><CheckCircle2 className="w-3 h-3 mr-1" /> OK</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Strategy Version */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2"><RefreshCcw className="w-4 h-4" /> Strategy Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div><span className="text-xs text-muted-foreground">Strategy Version</span><div className="font-mono mt-1">v3.0.0-tierflow</div></div>
            <div><span className="text-xs text-muted-foreground">Frame Cadence</span><div className="font-mono mt-1">100ms (10Hz)</div></div>
            <div><span className="text-xs text-muted-foreground">Detector Count</span><div className="font-mono mt-1">9 active</div></div>
            <div><span className="text-xs text-muted-foreground">FSM State</span><div className="font-mono mt-1">IDLE</div></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function Home() {
  const [tab, setTab] = useState('radar');

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-tight">ClaimMoney <span className="text-muted-foreground font-normal">v3</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Tierflow Micro-Structure Engine</span>
            <Badge variant="outline" className="text-xs gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              BTC-USDT-SWAP
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 w-full sm:w-auto">
            <TabsTrigger value="radar" className="gap-1.5"><Radio className="w-3.5 h-3.5" /> Radar</TabsTrigger>
            <TabsTrigger value="micro" className="gap-1.5"><Eye className="w-3.5 h-3.5" /> Micro</TabsTrigger>
            <TabsTrigger value="risk" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Risk</TabsTrigger>
            <TabsTrigger value="paper" className="gap-1.5"><Play className="w-3.5 h-3.5" /> Paper</TabsTrigger>
            <TabsTrigger value="diag" className="gap-1.5"><Stethoscope className="w-3.5 h-3.5" /> Diag</TabsTrigger>
          </TabsList>

          <TabsContent value="radar"><RadarScreen /></TabsContent>
          <TabsContent value="micro"><MicrostructureScreen /></TabsContent>
          <TabsContent value="risk"><PlanRiskScreen /></TabsContent>
          <TabsContent value="paper"><PaperTradingScreen /></TabsContent>
          <TabsContent value="diag"><DiagnosticsScreen /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
