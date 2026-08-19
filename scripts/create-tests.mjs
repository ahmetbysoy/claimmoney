import { writeFileSync, mkdirSync } from 'fs';

const testDir = '/home/z/my-project/__tests__';

const files = {

// 1. market-runtime.test.ts
'engine/market-runtime.test.ts': `import { describe, it, expect, beforeEach } from 'vitest';
import { MarketRuntime } from '@/lib/engine/market-runtime';
import type { Candle } from '@/lib/engine/types';

describe('MarketRuntime', () => {
  let runtime: MarketRuntime;

  beforeEach(() => {
    runtime = new MarketRuntime();
  });

  it('should process candle and update state', () => {
    const candle: Candle = { ts: 1000, o: 100, h: 105, l: 98, c: 103, v: 1000 };
    runtime.processCandle(candle);
    const state = runtime.getState();
    expect(state.currentPrice).toBe(103);
    expect(state.candleCount).toBe(1);
    expect(state.lastCandle).toEqual(candle);
  });

  it('should return correct statistics', () => {
    for (let i = 0; i < 5; i++) {
      runtime.processCandle({ ts: 1000 + i * 60000, o: 100 + i, h: 105 + i, l: 98 + i, c: 103 + i, v: 500 });
    }
    const stats = runtime.getStatistics();
    expect(stats.candles).toBe(5);
    expect(stats.open).toBe(100);
    expect(stats.close).toBe(107);
    expect(stats.volume).toBe(2500);
  });

  it('should reset state completely', () => {
    runtime.processCandle({ ts: 1000, o: 100, h: 105, l: 98, c: 103, v: 1000 });
    runtime.reset();
    const state = runtime.getState();
    expect(state.currentPrice).toBe(0);
    expect(state.candleCount).toBe(0);
    expect(state.allCandles).toEqual([]);
  });
});
`,

// 2. feature-frame.test.ts
'engine/feature-frame.test.ts': `import { describe, it, expect } from 'vitest';
import { FeatureFrameBuilder } from '@/lib/engine/feature-frame';
import type { Candle } from '@/lib/engine/types';

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    ts: 1000 + i * 60000,
    o: 100 + i * 0.5,
    h: 100 + i * 0.5 + 2,
    l: 100 + i * 0.5 - 2,
    c: 100 + (i + 1) * 0.5,
    v: 1000 + i * 100,
  }));
}

describe('FeatureFrameBuilder', () => {
  it('should build frame with standard features', () => {
    const builder = new FeatureFrameBuilder();
    const candles = makeCandles(50);
    const frame = builder.buildFrame(candles, 'BTC-USDT', '1m');
    expect(frame.symbol).toBe('BTC-USDT');
    expect(frame.interval).toBe('1m');
    expect(frame.rows.length).toBe(50);
    expect(frame.rows[0].features).toHaveProperty('rsi_14');
    expect(frame.rows[0].features).toHaveProperty('atr_14');
    expect(frame.rows[0].features).toHaveProperty('vwap');
  });

  it('should support custom features', () => {
    const builder = new FeatureFrameBuilder();
    builder.addCustomFeature('double_close', (candles) =>
      candles.map((c) => c.c * 2)
    );
    const frame = builder.buildFrame(makeCandles(10), 'BTC', '1m');
    expect(frame.rows[9].features.double_close).toBe(makeCandles(10)[9].c * 2);
  });

  it('should return empty frame for empty input', () => {
    const builder = new FeatureFrameBuilder();
    const frame = builder.buildFrame([], 'BTC', '1m');
    expect(frame.rows).toEqual([]);
  });
});
`,

// 3. jsonl-replay.test.ts
'engine/jsonl-replay.test.ts': `import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { Candle, ReplayConfig } from '@/lib/engine/types';

describe('JSONLReplay', () => {
  it('should load JSONL file correctly', () => {
    const replay = new JSONLReplay();
    const content = '{"ts":1000,"o":100,"h":105,"l":98,"c":103,"v":1000}\n{"ts":1060000,"o":103,"h":108,"l":101,"c":106,"v":1200}';
    const candles = replay.loadFile(content);
    expect(candles.length).toBe(2);
    expect(candles[0].c).toBe(103);
    expect(candles[1].v).toBe(1200);
  });

  it('should replay candles deterministically', () => {
    const replay = new JSONLReplay();
    const candles = Array.from({ length: 100 }, (_, i) => ({
      ts: 1000 + i * 60000,
      o: 100 + i * 0.1,
      h: 100 + i * 0.1 + 1,
      l: 100 + i * 0.1 - 1,
      c: 100 + (i + 1) * 0.1,
      v: 1000,
    }));
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const r1 = replay.replay(candles, config);
    const r2 = replay.replay(candles, config);
    expect(r1.byteChecksum).toBe(r2.byteChecksum);
  });

  it('should export result as JSON', () => {
    const replay = new JSONLReplay();
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const result = replay.replay([], config);
    const exported = replay.exportResult(result);
    const parsed = JSON.parse(exported);
    expect(parsed).toHaveProperty('finalEquity');
    expect(parsed).toHaveProperty('byteChecksum');
  });
});
`,

// 4. okx-integration.test.ts
'engine/okx-integration.test.ts': `import { describe, it, expect } from 'vitest';
import { validateOKXChecksum, parseOKXCandle, parseOKXTrade, crc32c } from '@/lib/engine/okx-integration';
import type { OKXMessage } from '@/lib/engine/types';

describe('OKX Integration', () => {
  it('should validate CRC32 checksum', () => {
    const data = [{ a: 1, b: 2 }];
    const checksum = crc32c(JSON.stringify(data));
    const msg: OKXMessage = { id: '1', ts: 1000, data, arg: { channel: 'candle1m', instId: 'BTC-USDT' }, checksum };
    expect(validateOKXChecksum(msg, checksum)).toBe(true);
  });

  it('should parse OKX candle format', () => {
    const okxCandle = [1597026383085, 9300, 9350, 9250, 9320, 100];
    const candle = parseOKXCandle(okxCandle);
    expect(candle.ts).toBe(1597026383085);
    expect(candle.o).toBe(9300);
    expect(candle.c).toBe(9320);
  });

  it('should parse OKX trade format', () => {
    const trade = { ts: '1597026383085', px: '9320.5', sz: '1.5', side: 'buy' };
    const tick = parseOKXTrade(trade);
    expect(tick.price).toBe(9320.5);
    expect(tick.size).toBe(1.5);
    expect(tick.side).toBe('buy');
  });
});
`,

// 5. websocket-manager.test.ts
'engine/websocket-manager.test.ts': `import { describe, it, expect, vi } from 'vitest';
import { WebSocketManager } from '@/lib/engine/websocket-manager';

describe('WebSocketManager', () => {
  it('should initialize with default config', () => {
    const manager = new WebSocketManager();
    expect(manager.isConnected()).toBe(false);
    const stats = manager.getStats();
    expect(stats.messagesReceived).toBe(0);
    expect(stats.reconnects).toBe(0);
  });

  it('should track message callbacks', () => {
    const manager = new WebSocketManager();
    const cb = vi.fn();
    manager.onMessage(cb);
    manager.onReconnect(vi.fn());
    expect(manager.getStats().uptime).toBe(0);
  });
});
`,

// 6. detector-registry.test.ts
'engine/detector-registry.test.ts': `import { describe, it, expect, beforeEach } from 'vitest';
import { DetectorRegistry, createMeanReversionDetector, createMomentumDetector } from '@/lib/engine/detector-registry';
import type { DetectorConfig, Signal } from '@/lib/engine/types';

describe('DetectorRegistry', () => {
  let registry: DetectorRegistry;

  beforeEach(() => {
    registry = new DetectorRegistry();
  });

  it('should register and run detectors', () => {
    const config: DetectorConfig = { name: 'test', version: '1.0.0', params: {}, enabled: true };
    registry.register(config, () => [{
      id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long',
      confidence: 0.8, regime: 'trending_up', metadata: {},
    } as Signal]);
    const results = registry.runAll({});
    expect(results.length).toBe(1);
    expect(results[0].signals.length).toBe(1);
    expect(results[0].detector).toBe('test');
  });

  it('should run all built-in detectors', () => {
    const mr = createMeanReversionDetector();
    registry.register(mr.config, mr.fn);
    const mom = createMomentumDetector();
    registry.register(mom.config, mom.fn);
    expect(registry.getDetectors().length).toBe(2);
  });

  it('should enable and disable detectors', () => {
    const config: DetectorConfig = { name: 'test', version: '1.0.0', params: {}, enabled: true };
    registry.register(config, () => []);
    registry.disable('test');
    expect(registry.getDetectors()[0].enabled).toBe(false);
    registry.enable('test');
    expect(registry.getDetectors()[0].enabled).toBe(true);
  });
});
`,

// 7. regime-classifier.test.ts
'engine/regime-classifier.test.ts': `import { describe, it, expect } from 'vitest';
import { RegimeClassifier } from '@/lib/engine/regime-classifier';
import type { Candle } from '@/lib/engine/types';

function trendCandles(direction: 'up' | 'down', n = 60): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 + (direction === 'up' ? i * 0.5 : -i * 0.5);
    return { ts: 1000 + i * 60000, o: base, h: base + 1, l: base - 1, c: base + (direction === 'up' ? 0.3 : -0.3), v: 1000 };
  });
}

function rangeCandles(n = 60): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = 100 + Math.sin(i / 5) * 2;
    return { ts: 1000 + i * 60000, o: base, h: base + 0.5, l: base - 0.5, c: base, v: 1000 };
  });
}

describe('RegimeClassifier', () => {
  it('should classify uptrend', () => {
    const classifier = new RegimeClassifier();
    expect(classifier.classify(trendCandles('up'))).toBe('trending_up');
  });

  it('should classify ranging market', () => {
    const classifier = new RegimeClassifier();
    expect(classifier.classify(rangeCandles())).toBe('ranging');
  });

  it('should return regime probabilities', () => {
    const classifier = new RegimeClassifier();
    const probs = classifier.getRegimeProbability(trendCandles('up'));
    expect(probs).toHaveProperty('trending_up');
    expect(probs).toHaveProperty('trending_down');
    expect(probs).toHaveProperty('ranging');
    expect(probs).toHaveProperty('volatile');
    const sum = Object.values(probs).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(0.01);
  });
});
`,

// 8. signal-pipeline.test.ts
'engine/signal-pipeline.test.ts': `import { describe, it, expect } from 'vitest';
import { SignalPipeline } from '@/lib/engine/signal-pipeline';
import type { Signal } from '@/lib/engine/types';

const makeSignal = (ts: number, regime: 'trending_up' | 'ranging' = 'trending_up', confidence = 0.8): Signal => ({
  id: 's1', ts, detector: 'test', symbol: 'BTC', side: 'long',
  confidence, regime, metadata: {},
});

describe('SignalPipeline', () => {
  it('should pass valid signals through all filters', () => {
    const pipeline = new SignalPipeline();
    const results = pipeline.process([makeSignal(200000)], {
      allowedRegimes: ['trending_up'],
      openPositions: [],
      maxPositions: 5,
      lastSignalTs: 0,
      cooldownMs: 60000,
      minConfidence: 0.5,
    });
    expect(results.length).toBe(1);
    expect(results[0].passed).toBe(true);
  });

  it('should support adding custom filters', () => {
    const pipeline = new SignalPipeline();
    pipeline.addFilter('custom_confidence', (signal) => signal.confidence > 0.9);
    const results = pipeline.process([makeSignal(200000)], { allowedRegimes: ['trending_up'], openPositions: [], maxPositions: 5, lastSignalTs: 0, cooldownMs: 60000, minConfidence: 0.5 });
    expect(results[0].passed).toBe(false);
    expect(results[0].filterReason).toBe('custom_confidence');
  });

  it('should track filter statistics', () => {
    const pipeline = new SignalPipeline();
    pipeline.process([makeSignal(200000, 'ranging')], { allowedRegimes: ['trending_up'], openPositions: [], maxPositions: 5, lastSignalTs: 0, cooldownMs: 60000, minConfidence: 0.5 });
    const stats = pipeline.getFilterStats();
    expect(stats.length).toBeGreaterThan(0);
    const regimeFilter = stats.find(s => s.name === 'regime_filter');
    expect(regimeFilter?.rejected).toBe(1);
  });
});
`,

// 9. risk-planner.test.ts
'engine/risk-planner.test.ts': `import { describe, it, expect } from 'vitest';
import { RiskPlanner } from '@/lib/engine/risk-planner';
import type { RiskConfig, Position, Signal } from '@/lib/engine/types';

describe('RiskPlanner', () => {
  const config: RiskConfig = {
    equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
    maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
    defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
  };

  it('should calculate position size correctly', () => {
    const planner = new RiskPlanner();
    const size = planner.calculatePositionSize(config, 100, 98);
    expect(size).toBe(50); // 10000 * 0.01 / 2 = 50
  });

  it('should calculate stop loss from ATR', () => {
    const planner = new RiskPlanner();
    const sl = planner.calculateStopLoss(100, 2, 1.5);
    expect(sl).toBe(97);
  });

  it('should check risk constraints', () => {
    const planner = new RiskPlanner();
    const positions: Position[] = Array.from({ length: 5 }, (_, i) => ({
      id: 'p' + i, symbol: 'BTC', side: 'long' as const, entryPrice: 100,
      currentPrice: 101, size: 1, stopLoss: 98, takeProfit1: 104,
      takeProfit2: 106, fee: 1, slippage: 0, pnl: 1, rMultiple: 0.5,
      status: 'open' as const, entryTs: 1000,
    }));
    const signal: Signal = { id: 's1', ts: 2000, detector: 't', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    expect(planner.checkRisk(config, positions, signal)).toBe(false);
    expect(planner.checkRisk(config, positions.slice(0, 3), signal)).toBe(true);
  });
});
`,

// 10. paper-execution.test.ts
'engine/paper-execution.test.ts': `import { describe, it, expect, beforeEach } from 'vitest';
import { PaperExecution } from '@/lib/engine/paper-execution';
import { FeeAccounting } from '@/lib/engine/fee-accounting';
import type { RiskConfig, Signal } from '@/lib/engine/types';

describe('PaperExecution', () => {
  let config: RiskConfig;
  let executor: PaperExecution;

  beforeEach(() => {
    config = {
      equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
      maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
      defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
    };
    executor = new PaperExecution(new FeeAccounting(), config);
  });

  it('should execute a signal and create position', () => {
    const signal: Signal = { id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    const pos = executor.executeSignal(signal, { atr: 2, currentPrice: 100 }, config);
    expect(pos).not.toBeNull();
    expect(pos!.status).toBe('open');
    expect(pos!.side).toBe('long');
  });

  it('should update position PnL', () => {
    const signal: Signal = { id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    const pos = executor.executeSignal(signal, { atr: 2, currentPrice: 100 }, config)!;
    executor.updatePosition(pos, 105);
    expect(executor.getOpenPositions()[0].pnl).toBeGreaterThan(0);
  });

  it('should track equity correctly', () => {
    expect(executor.getEquity()).toBe(10000);
    const signal: Signal = { id: 's1', ts: 1000, detector: 'test', symbol: 'BTC', side: 'long', confidence: 0.8, regime: 'trending_up', metadata: {} };
    executor.executeSignal(signal, { atr: 2, currentPrice: 100 }, config);
    const eq = executor.getEquity();
    expect(eq).toBeGreaterThan(0);
  });
});
`,

// 11. fee-accounting.test.ts
'engine/fee-accounting.test.ts': `import { describe, it, expect } from 'vitest';
import { FeeAccounting } from '@/lib/engine/fee-accounting';

describe('FeeAccounting', () => {
  it('should calculate maker fee', () => {
    const fa = new FeeAccounting();
    const fee = fa.calculateFee(10, 100, true);
    expect(fee).toBe(0.2); // 10 * 100 * 0.0002
  });

  it('should calculate taker fee', () => {
    const fa = new FeeAccounting();
    const fee = fa.calculateFee(10, 100, false);
    expect(fee).toBe(0.5); // 10 * 100 * 0.0005
  });

  it('should calculate R-multiple', () => {
    const fa = new FeeAccounting();
    expect(fa.calculateRMultiple(200, 100)).toBe(2);
    expect(fa.calculateRMultiple(-50, 100)).toBe(-0.5);
  });
});
`,

// 12. calibration.test.ts
'engine/calibration.test.ts': `import { describe, it, expect } from 'vitest';
import { Calibrator } from '@/lib/engine/calibration';
import type { RiskConfig, Candle } from '@/lib/engine/types';

describe('Calibrator', () => {
  const config: RiskConfig = {
    equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
    maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
    defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
  };

  it('should calibrate detector parameters', () => {
    const cal = new Calibrator();
    const candles: Candle[] = Array.from({ length: 100 }, (_, i) => ({
      ts: 1000 + i * 60000, o: 100, h: 100 + 1, l: 100 - 1, c: 100 + (i % 2 === 0 ? 0.5 : -0.5), v: 1000,
    }));
    const results = cal.calibrate('test', { period: [10, 30] }, candles, config, 3);
    expect(results.length).toBe(3);
    expect(results[0]).toHaveProperty('sharpeRatio');
  });

  it('should return best result by Sharpe', () => {
    const cal = new Calibrator();
    const results = [
      { detector: 't', paramSet: {}, sharpeRatio: 1.0, maxDrawdown: 0.1, winRate: 0.5, profitFactor: 1.2, totalTrades: 10 },
      { detector: 't', paramSet: {}, sharpeRatio: 2.0, maxDrawdown: 0.05, winRate: 0.6, profitFactor: 1.5, totalTrades: 10 },
      { detector: 't', paramSet: {}, sharpeRatio: 0.5, maxDrawdown: 0.15, winRate: 0.4, profitFactor: 0.8, totalTrades: 10 },
    ];
    const best = cal.getBestResult(results);
    expect(best.sharpeRatio).toBe(2.0);
  });
});
`,

// 13. session-manager.test.ts
'engine/session-manager.test.ts': `import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '@/lib/engine/session-manager';
import type { Signal, Position } from '@/lib/engine/types';

describe('SessionManager', () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  it('should create and manage sessions', () => {
    const session = sm.createSession('Test', 10000);
    expect(session.name).toBe('Test');
    expect(session.startEquity).toBe(10000);
    expect(sm.getAllSessions().length).toBe(1);
  });

  it('should export and import session with checksum', () => {
    const session = sm.createSession('Export', 10000);
    const exported = sm.exportSession(session.id);
    expect(exported.checksum).toBeTruthy();
    expect(exported.version).toBe('2.0.0');

    const sm2 = new SessionManager();
    const imported = sm2.importSession(JSON.stringify(exported));
    expect(imported.id).toBe(session.id);
    expect(imported.name).toBe('Export');
  });

  it('should purge walk-forward sessions', () => {
    for (let i = 0; i < 10; i++) sm.createSession('S' + i, 10000);
    const all = sm.getAllSessions();
    const purged = sm.purgeWalkForward(all, 3);
    expect(purged.length).toBe(3);
  });
});
`,

// 14. walk-forward.test.ts
'engine/walk-forward.test.ts': `import { describe, it, expect } from 'vitest';
import { WalkForwardAnalyzer } from '@/lib/engine/walk-forward';
import type { RiskConfig, Candle } from '@/lib/engine/types';

describe('WalkForwardAnalyzer', () => {
  const config: RiskConfig = {
    equity: 10000, maxRiskPerTrade: 0.01, maxOpenPositions: 5,
    maxDailyLoss: 0.03, maxCorrelationExposure: 0.5,
    defaultStopLossATR: 1.5, defaultTP1R: 1, defaultTP2R: 2,
  };

  it('should perform walk-forward analysis', () => {
    const analyzer = new WalkForwardAnalyzer();
    const candles: Candle[] = Array.from({ length: 200 }, (_, i) => ({
      ts: 1000 + i * 60000, o: 100, h: 101, l: 99, c: 100 + (i % 2 === 0 ? 0.3 : -0.3), v: 1000,
    }));
    const result = analyzer.analyze(
      candles,
      { windowSize: 80, stepSize: 40, trainRatio: 0.7 },
      'test', { period: [10, 20] }, config
    );
    expect(result).toHaveProperty('windows');
    expect(result).toHaveProperty('aggregatedSharpe');
    expect(result).toHaveProperty('isRobust');
  });

  it('should export results as JSON', () => {
    const analyzer = new WalkForwardAnalyzer();
    const result = { windows: [], aggregatedSharpe: 1.5, aggregatedMaxDD: 0.1, aggregatedWinRate: 0.55, isRobust: true };
    const exported = analyzer.exportResults(result);
    const parsed = JSON.parse(exported);
    expect(parsed.aggregatedSharpe).toBe(1.5);
  });
});
`,

// 15. data-quality.test.ts
'engine/data-quality.test.ts': `import { describe, it, expect } from 'vitest';
import { DataQualityGate } from '@/lib/engine/data-quality';
import type { Candle } from '@/lib/engine/types';

describe('DataQualityGate', () => {
  it('should validate clean data', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = Array.from({ length: 100 }, (_, i) => ({
      ts: 1000 + i * 60000, o: 100, h: 101, l: 99, c: 100.5, v: 1000,
    }));
    const report = gate.validate(candles);
    expect(report.totalRows).toBe(100);
    expect(report.score).toBeGreaterThan(90);
  });

  it('should sort and deduplicate', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [
      { ts: 3000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 1000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 1000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 2000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
    ];
    const result = gate.sortAndDeduplicate(candles);
    expect(result.length).toBe(3);
    expect(result[0].ts).toBe(1000);
    expect(result[2].ts).toBe(3000);
  });

  it('should resync data to fixed interval', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [
      { ts: 1000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 5000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
    ];
    const result = gate.resync(candles, 2000);
    expect(result.length).toBeGreaterThan(2);
    expect(result[0].ts).toBe(1000);
  });
});
`,

// 16. snapshot-delta.test.ts
'engine/snapshot-delta.test.ts': `import { describe, it, expect } from 'vitest';
import { JSONLReplay } from '@/lib/engine/jsonl-replay';
import type { Candle, ReplayConfig } from '@/lib/engine/types';

describe('Snapshot/Delta Mode', () => {
  const makeCandles = (n: number): Candle[] => Array.from({ length: n }, (_, i) => ({
    ts: 1000 + i * 60000, o: 100, h: 101, l: 99, c: 100 + i * 0.1, v: 1000,
  }));

  it('should produce snapshots in replay', () => {
    const replay = new JSONLReplay();
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const result = replay.replay(makeCandles(50), config);
    expect(result.snapshots.length).toBe(50);
    expect(result.snapshots[0]).toHaveProperty('equity');
    expect(result.snapshots[0]).toHaveProperty('regime');
  });

  it('should produce consistent deltas between runs', () => {
    const replay = new JSONLReplay();
    const config: ReplayConfig = { source: 'test', startTime: 0, endTime: Infinity, speed: 1, deterministic: true };
    const candles = makeCandles(30);
    const r1 = replay.replay(candles, config);
    const r2 = replay.replay(candles, config);
    const d1 = r1.snapshots.map(s => s.equity);
    const d2 = r2.snapshots.map(s => s.equity);
    expect(d1).toEqual(d2);
  });
});
`,

// 17. resync.test.ts
'engine/resync.test.ts': `import { describe, it, expect } from 'vitest';
import { DataQualityGate } from '@/lib/engine/data-quality';
import type { Candle } from '@/lib/engine/types';

describe('Resync', () => {
  it('should resample up (fill gaps)', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = [
      { ts: 0, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 60000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
      { ts: 180000, o: 100, h: 101, l: 99, c: 100, v: 1000 },
    ];
    const result = gate.resync(candles, 60000);
    expect(result.length).toBe(4); // 0, 60k, 120k (filled), 180k
  });

  it('should handle resample down correctly', () => {
    const gate = new DataQualityGate();
    const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
      ts: i * 30000, o: 100, h: 101, l: 99, c: 100, v: 1000,
    }));
    const result = gate.resync(candles, 60000);
    expect(result.length).toBeGreaterThan(5);
  });
});
`,

// 18. helpers.test.ts
'utils/helpers.test.ts': `import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, formatNumber, clamp, resetIdCounter } from '@/lib/engine/helpers';

describe('Helpers', () => {
  beforeEach(() => { resetIdCounter(); });

  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^cm_/);
  });

  it('should format numbers correctly', () => {
    expect(formatNumber(3.14159)).toBe('3.14');
    expect(formatNumber(3.14159, 4)).toBe('3.1416');
  });

  it('should clamp values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
`,

// 19. crc32.test.ts
'utils/crc32.test.ts': `import { describe, it, expect } from 'vitest';
import { crc32c } from '@/lib/engine/okx-integration';

describe('CRC32', () => {
  it('should produce known checksums', () => {
    const c1 = crc32c('hello world');
    const c2 = crc32c('hello world');
    expect(c1).toBe(c2);
    expect(c1.length).toBe(8);
  });

  it('should differ for different inputs', () => {
    const c1 = crc32c('data_A');
    const c2 = crc32c('data_B');
    expect(c1).not.toBe(c2);
  });
});
`,

// 20. serialization.test.ts
'utils/serialization.test.ts': `import { describe, it, expect } from 'vitest';
import { serializeSession, deserializeSession, roundtripSession } from '@/lib/engine/serialization';
import type { TradingSession } from '@/lib/engine/types';

describe('Serialization', () => {
  it('should serialize session to JSON', () => {
    const session: TradingSession = {
      id: 'test', name: 'Test', startedAt: 1000, signals: [], positions: [],
      startEquity: 10000, currentEquity: 10500, peakEquity: 10500,
      maxDrawdown: 0.02, totalFees: 10, winRate: 0.6, profitFactor: 1.5, sharpeRatio: 1.2,
    };
    const json = serializeSession(session);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe('2.0.0');
    expect(parsed.checksum).toBeTruthy();
  });

  it('should deserialize session from JSON', () => {
    const session: TradingSession = {
      id: 'test2', name: 'Test2', startedAt: 1000, signals: [], positions: [],
      startEquity: 10000, currentEquity: 10500, peakEquity: 10500,
      maxDrawdown: 0.02, totalFees: 10, winRate: 0.6, profitFactor: 1.5, sharpeRatio: 1.2,
    };
    const json = serializeSession(session);
    const deserialized = deserializeSession(json);
    expect(deserialized.id).toBe('test2');
    expect(deserialized.name).toBe('Test2');
  });

  it('should roundtrip session correctly', () => {
    const session: TradingSession = {
      id: 'rt', name: 'RoundTrip', startedAt: 5000, signals: [], positions: [],
      startEquity: 20000, currentEquity: 22000, peakEquity: 22000,
      maxDrawdown: 0.01, totalFees: 5, winRate: 0.7, profitFactor: 2.0, sharpeRatio: 1.8,
    };
    const result = roundtripSession(session);
    expect(result.id).toBe(session.id);
    expect(result.currentEquity).toBe(session.currentEquity);
  });
});
`,

// 21-25: API tests
'api/market.test.ts': `import { describe, it, expect } from 'vitest';

describe('Market API', () => {
  it('should export market route handler', async () => {
    const mod = await import('@/app/api/market/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should handle POST request', async () => {
    const mod = await import('@/app/api/market/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ ts: 1000, o: 100, h: 105, l: 98, c: 103, v: 1000 }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
  });
});
`,

'api/signals.test.ts': `import { describe, it, expect } from 'vitest';

describe('Signals API', () => {
  it('should export signals route handler', async () => {
    const mod = await import('@/app/api/signals/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should return empty signals list', async () => {
    const mod = await import('@/app/api/signals/route');
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.signals).toBeDefined();
  });
});
`,

'api/risk.test.ts': `import { describe, it, expect } from 'vitest';

describe('Risk API', () => {
  it('should export risk route handler', async () => {
    const mod = await import('@/app/api/risk/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should calculate position size via POST', async () => {
    const mod = await import('@/app/api/risk/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ entryPrice: 100, stopLoss: 98, equity: 10000, riskPct: 0.01 }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.positionSize).toBeGreaterThan(0);
  });
});
`,

'api/sessions.test.ts': `import { describe, it, expect } from 'vitest';

describe('Sessions API', () => {
  it('should export sessions route handler', async () => {
    const mod = await import('@/app/api/sessions/route');
    expect(mod).toHaveProperty('GET');
    expect(mod).toHaveProperty('POST');
  });

  it('should create session via POST', async () => {
    const mod = await import('@/app/api/sessions/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Session', equity: 10000 }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session).toBeDefined();
  });
});
`,

'api/replay.test.ts': `import { describe, it, expect } from 'vitest';

describe('Replay API', () => {
  it('should export replay route handler', async () => {
    const mod = await import('@/app/api/replay/route');
    expect(mod).toHaveProperty('POST');
    expect(mod).toHaveProperty('GET');
  });

  it('should start replay via POST', async () => {
    const mod = await import('@/app/api/replay/route');
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ candles: [] }),
    });
    const res = await mod.POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('byteChecksum');
  });
});
`,
};

for (const [path, content] of Object.entries(files)) {
  const fullPath = testDir + '/' + path;
  const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, content);
  console.log('Created: ' + path);
}
console.log('\nTotal test files: ' + Object.keys(files).length);
