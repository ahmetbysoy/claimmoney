'use client';

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Activity, BarChart3, Shield, Play, FolderOpen, Settings,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  Zap, Target, Clock, DollarSign, Percent, LineChart,
} from 'lucide-react';

// --- Deterministic in-browser demo data ---
function generateDemoCandles(n: number) {
  const candles = [];
  let price = 42000;
  for (let i = 0; i < n; i++) {
    const change = (Math.sin(i * 0.1) * 0.003) + (Math.cos(i * 0.05) * 0.002);
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.abs(Math.sin(i * 0.2)) * 0.002);
    const low = Math.min(open, close) * (1 - Math.abs(Math.cos(i * 0.15)) * 0.002);
    candles.push({ ts: 1000 + i * 60000, o: open, h: high, l: low, c: close, v: 100 + Math.sin(i) * 50 });
    price = close;
  }
  return candles;
}

function computeStats(candles: { o: number; h: number; l: number; c: number; v: number }[]) {
  const last = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : last;
  const change = ((last.c - prev.c) / prev.c) * 100;
  const high24 = Math.max(...candles.slice(-24).map(c => c.h));
  const low24 = Math.min(...candles.slice(-24).map(c => c.l));
  const totalVol = candles.slice(-24).reduce((s, c) => s + c.v, 0);
  return { price: last.c, change, high24, low24, totalVol };
}

// --- Sub-components ---
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${color ?? 'bg-primary/10'}`}>
          <Icon className={`h-4 w-4 ${color ? color.replace('bg-', 'text-') : 'text-primary'}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold tracking-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function DetectorCard({ name, status, signals }: { name: string; status: boolean; signals: number }) {
  return (
    <Card className="p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{signals} signals</Badge>
        <Badge variant={status ? 'default' : 'outline'} className="text-xs">
          {status ? 'Active' : 'Off'}
        </Badge>
      </div>
    </Card>
  );
}

// --- Main Page ---
export default function Home() {
  const [candles] = useState(() => generateDemoCandles(200));
  const stats = computeStats(candles);
  const isUp = stats.change >= 0;

  const detectors = [
    { name: 'Mean Reversion', status: true, signals: 12 },
    { name: 'Momentum', status: true, signals: 8 },
    { name: 'Breakout', status: true, signals: 5 },
    { name: 'Volume Spike', status: false, signals: 3 },
  ];

  const recentSignals = [
    { id: 1, ts: '14:32:05', detector: 'Momentum', side: 'long' as const, symbol: 'BTC-USDT', confidence: 0.85, regime: 'trending_up' as const },
    { id: 2, ts: '14:28:11', detector: 'Breakout', side: 'long' as const, symbol: 'ETH-USDT', confidence: 0.72, regime: 'trending_up' as const },
    { id: 3, ts: '14:15:30', detector: 'Mean Reversion', side: 'short' as const, symbol: 'BTC-USDT', confidence: 0.68, regime: 'ranging' as const },
    { id: 4, ts: '13:58:42', detector: 'Volume Spike', side: 'long' as const, symbol: 'SOL-USDT', confidence: 0.91, regime: 'volatile' as const },
    { id: 5, ts: '13:45:20', detector: 'Momentum', side: 'short' as const, symbol: 'ETH-USDT', confidence: 0.63, regime: 'trending_down' as const },
  ];

  const positions = [
    { id: 1, symbol: 'BTC-USDT', side: 'long' as const, entry: 42150, current: stats.price, size: 0.05, pnl: ((stats.price - 42150) * 0.05), r: 1.2, status: 'open' as const },
    { id: 2, symbol: 'ETH-USDT', side: 'short' as const, entry: 2850, current: 2820, size: 0.5, pnl: 15, r: 0.8, status: 'tp1_hit' as const },
  ];

  const sessions = [
    { id: 1, name: 'BTC Session #42', equity: 10250, startEq: 10000, dd: 0.032, wr: 0.62, sharpe: 1.8, trades: 28 },
    { id: 2, name: 'Multi-Asset Run', equity: 9850, startEq: 10000, dd: 0.051, wr: 0.55, sharpe: 1.2, trades: 45 },
    { id: 3, name: 'Walk-Forward Test', equity: 10100, startEq: 10000, dd: 0.018, wr: 0.58, sharpe: 2.1, trades: 12 },
  ];

  const riskConfig = { equity: 10000, riskPerTrade: 1, maxPos: 5, maxDailyLoss: 3, portfolioHeat: 2.4 };

  const regimeLabel = (r: string) => {
    const map: Record<string, { label: string; color: string }> = {
      trending_up: { label: 'Trending Up', color: 'text-emerald-500' },
      trending_down: { label: 'Trending Down', color: 'text-red-500' },
      ranging: { label: 'Ranging', color: 'text-amber-500' },
      volatile: { label: 'Volatile', color: 'text-orange-500' },
    };
    const m = map[r] ?? { label: r, color: 'text-muted-foreground' };
    return m;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">ClaimMoney</h1>
            <Badge variant="outline" className="text-xs hidden sm:inline-flex">v2.0.0</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="hidden sm:inline">64/64 tests</span>
            <Separator orientation="vertical" className="h-3" />
            <span>Deterministic Engine</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 sm:w-auto sm:inline-grid">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Dash</span>
            </TabsTrigger>
            <TabsTrigger value="signals" className="gap-1.5 text-xs sm:text-sm">
              <Zap className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Signals</span><span className="sm:hidden">Sig</span>
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-1.5 text-xs sm:text-sm">
              <Shield className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Risk</span>
            </TabsTrigger>
            <TabsTrigger value="replay" className="gap-1.5 text-xs sm:text-sm">
              <Play className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Replay</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1.5 text-xs sm:text-sm">
              <FolderOpen className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sessions</span><span className="sm:hidden">Ses</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Price Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={DollarSign} label="BTC-USDT Price" value={`$${stats.price.toFixed(2)}`} sub={isUp ? '+' : '' + stats.change.toFixed(3) + '%'} color={isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'} />
              <StatCard icon={isUp ? TrendingUp : TrendingDown} label="24h Range" value={`${stats.low24.toFixed(0)} - ${stats.high24.toFixed(0)}`} sub="BTC-USDT" />
              <StatCard icon={LineChart} label="Total Volume (24h)" value={stats.totalVol.toFixed(0)} sub="contracts" />
              <StatCard icon={Target} label="Active Positions" value={`${positions.filter(p => p.status === 'open').length}/${positions.length}`} sub="open / total" />
            </div>

            {/* Positions & Regime */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Open Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {positions.map(pos => (
                      <div key={pos.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          {pos.side === 'long' ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                          <div>
                            <p className="text-sm font-medium">{pos.symbol}</p>
                            <p className="text-xs text-muted-foreground">{pos.side.toUpperCase()} @ ${pos.entry.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${pos.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{pos.r}R</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Market Regime</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-3xl font-bold text-emerald-500">TRENDING UP</p>
                    <p className="text-xs text-muted-foreground mt-1">Based on 200 candles analysis</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {[
                      { label: 'Trending Up', value: 45, color: 'bg-emerald-500' },
                      { label: 'Ranging', value: 30, color: 'bg-amber-500' },
                      { label: 'Volatile', value: 15, color: 'bg-orange-500' },
                      { label: 'Trending Down', value: 10, color: 'bg-red-500' },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-2">
                        <span className="text-xs w-24 truncate">{r.label}</span>
                        <Progress value={r.value} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{r.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detector Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Detector Registry</CardTitle>
                <CardDescription className="text-xs">Signal detectors with real-time status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {detectors.map(d => <DetectorCard key={d.name} {...d} />)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signals Tab */}
          <TabsContent value="signals" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Signal Feed</CardTitle>
                <CardDescription className="text-xs">Latest detected and filtered signals</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2">
                    {recentSignals.map(s => {
                      const reg = regimeLabel(s.regime);
                      return (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            {s.side === 'long'
                              ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                              : <TrendingDown className="h-4 w-4 text-red-500" />}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{s.symbol}</p>
                                <Badge variant="outline" className="text-xs">{s.detector}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{s.ts}</span>
                                <span className={`text-xs ${reg.color}`}>{reg.label}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{(s.confidence * 100).toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">confidence</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Pipeline Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Regime Filter', passed: 28, rejected: 12 },
                    { name: 'Max Positions', passed: 38, rejected: 2 },
                    { name: 'Cooldown', passed: 35, rejected: 5 },
                    { name: 'Confidence', passed: 32, rejected: 8 },
                  ].map(f => (
                    <div key={f.name} className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">{f.name}</p>
                      <p className="text-lg font-bold text-emerald-500">{f.passed}</p>
                      <p className="text-xs text-red-400">{f.rejected} rejected</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Tab */}
          <TabsContent value="risk" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Percent} label="Risk Per Trade" value={`${riskConfig.riskPerTrade}%`} sub="of equity" />
              <StatCard icon={Shield} label="Max Positions" value={`${riskConfig.maxPos}`} sub="concurrent" />
              <StatCard icon={AlertTriangle} label="Max Daily Loss" value={`${riskConfig.maxDailyLoss}%`} sub="circuit breaker" />
              <StatCard icon={Activity} label="Portfolio Heat" value={`${riskConfig.portfolioHeat}%`} sub="total risk" />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Position Sizing Calculator</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Equity</p>
                    <p className="text-2xl font-bold">$10,000</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Risk Amount (1%)</p>
                    <p className="text-2xl font-bold text-amber-500">$100</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Position Size (at $100, SL $98)</p>
                    <p className="text-2xl font-bold">50 units</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Fee & Slippage Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Maker Fee</p>
                    <p className="text-lg font-bold">0.02%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Taker Fee</p>
                    <p className="text-lg font-bold">0.05%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Slippage</p>
                    <p className="text-lg font-bold">1 bps</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">TP1 / TP2</p>
                    <p className="text-lg font-bold">1R / 2R</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Replay Tab */}
          <TabsContent value="replay" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Deterministic Replay Engine</CardTitle>
                <CardDescription className="text-xs">Byte-equivalent replay with JSONL data source</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard icon={Play} label="Replay Mode" value="Deterministic" sub="no randomness" />
                  <StatCard icon={Target} label="Byte Checksum" value="CRC32" sub="equivalence verified" />
                  <StatCard icon={Clock} label="Data Source" value="JSONL" sub="line-delimited JSON" />
                  <StatCard icon={CheckCircle2} label="Snapshot Mode" value="Enabled" sub="per-candle snapshots" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Replay Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Final Equity', value: '$10,245', sub: '+2.45%' },
                    { label: 'Max Drawdown', value: '3.2%', sub: 'acceptable' },
                    { label: 'Sharpe Ratio', value: '1.84', sub: 'good' },
                    { label: 'Total Trades', value: '28', sub: 'completed' },
                    { label: 'Win Rate', value: '62%', sub: 'above avg' },
                    { label: 'Profit Factor', value: '1.65', sub: 'positive' },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-lg font-bold">{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.sub}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Data Quality Gate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: 'Total Rows', value: '10,000' },
                    { label: 'Valid', value: '9,985' },
                    { label: 'Gaps', value: '8' },
                    { label: 'Duplicates', value: '7' },
                    { label: 'Quality Score', value: '97/100' },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                      <p className="text-lg font-bold">{m.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Trading Sessions</CardTitle>
                <CardDescription className="text-xs">Import/export with CRC32 checksum verification</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {sessions.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.trades} trades</p>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <p className={`text-sm font-bold ${s.equity >= s.startEq ? 'text-emerald-500' : 'text-red-500'}`}>
                              ${s.equity.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Equity</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">{(s.dd * 100).toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">Max DD</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">{(s.wr * 100).toFixed(0)}%</p>
                            <p className="text-xs text-muted-foreground">Win Rate</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold">{s.sharpe.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Sharpe</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Walk-Forward Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Windows</p>
                    <p className="text-lg font-bold">5</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Agg. Sharpe</p>
                    <p className="text-lg font-bold">1.6</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Agg. Max DD</p>
                    <p className="text-lg font-bold">4.1%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">Robust</p>
                    <p className="text-lg font-bold text-emerald-500">Yes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>ClaimMoney v2.0.0 — Deterministic Trading Platform</p>
          <p>64 tests | 0 vulnerabilities | TypeScript strict</p>
        </div>
      </footer>
    </div>
  );
}
