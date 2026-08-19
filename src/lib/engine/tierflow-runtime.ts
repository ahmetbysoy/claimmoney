import type { MarketEvent } from './domain/events';
import { EventBus } from './infrastructure/eventBus';
import { SystemClock } from './infrastructure/clock';
import { FeatureFrameBuilder } from './features/featureFrameBuilder';
import { OrderBook } from './book/orderBook';
import { DetectorAggregator } from './strategy/detectorAggregator';
import { computeCompositeScore } from './strategy/scoreModel';
import { runFilters } from './strategy/filters';
import { DecisionFSM } from './strategy/decisionMachine';
import { ForwardTracker } from './performance/forwardTracker';
import { PaperBroker } from './execution/paperBroker';
import { createTradePlan } from './risk/tradePlanner';
import { sizePosition } from './risk/positionSizer';
import { checkPortfolioRisk, createDefaultPortfolioState } from './risk/portfolioRisk';
import { FeeAccounting } from './fee-accounting';
import type { ApprovedSignal } from './domain/signals';
import type { FeatureFrame } from './domain/frames';
import type { DetectorResult } from './detectors/detector';

export interface RuntimeConfig {
  symbol: string;
  equity: number;
  makerFee?: number;
  takerFee?: number;
  maxPositions?: number;
  maxDailyLoss?: number;
  paperTrading?: boolean;
}

export interface RuntimeState {
  connected: boolean;
  symbol: string;
  lastPrice: number;
  lastFrame: FeatureFrame | null;
  lastDetectorResults: DetectorResult[];
  lastScore: number;
  lastSignal: ApprovedSignal | null;
  regime: string;
}

export class TierflowRuntime {
  private config: RuntimeConfig;
  private eventBus = new EventBus<{
    frame: FeatureFrame;
    signal: ApprovedSignal;
    detectorSignal: DetectorSignal;
    state: RuntimeState;
  }>();

  private clock = new SystemClock();
  private frameBuilder = new FeatureFrameBuilder();
  private orderBook = new OrderBook(50);
  private detectorAgg = new DetectorAggregator();
  private forwardTracker = new ForwardTracker();
  private paperBroker: PaperBroker;
  private feeAccounting = new FeeAccounting();
  private decisionFSM = new DecisionFSM();

  private lastMid = 0;
  private lastPrice = 0;
  private lastFrame: FeatureFrame | null = null;
  private lastScore = 0;
  private lastSignal: ApprovedSignal | null = null;
  private portfolioState = createDefaultPortfolioState(10000);

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.paperBroker = new PaperBroker(
      config.equity,
      config.makerFee ?? 0.0002,
      config.takerFee ?? 0.0005
    );
    this.portfolioState.totalEquity = config.equity;
    this.portfolioState.maxPositions = config.maxPositions ?? 3;
    this.portfolioState.maxDailyLoss = config.maxDailyLoss ?? 500;
  }

  /** Main entry point — feed a market event into the pipeline */
  onEvent(event: MarketEvent): void {
    switch (event.kind) {
      case 'trade':
        this.handleTrade(event);
        break;
      case 'bookSnapshot':
        this.handleBookSnapshot(event);
        break;
      case 'bookDelta':
        this.handleBookDelta(event);
        break;
      case 'markPrice':
        this.handleMarkPrice(event);
        break;
    }
  }

  private handleTrade(event: Extract<MarketEvent, { kind: 'trade' }>): void {
    const { price, qty, aggressor, eventTs, tradeId } = event;
    this.lastPrice = price;

    // Feed features
    this.frameBuilder.cvd.onTrade(tradeId, aggressor, qty, eventTs);
    this.frameBuilder.velocity.onPrice(price, eventTs);
    this.frameBuilder.vpin.onTrade(price, qty, aggressor, eventTs);
    this.frameBuilder.flow.onTrade(price, aggressor, qty, eventTs);
    this.frameBuilder.volatility.onPrice(price, eventTs);

    // Feed iceberg detector trades
    // (accessing private — in production, expose via method or restructure)

    // Update forward tracker
    this.forwardTracker.updatePrice(price, eventTs);

    // Update paper positions
    if (this.config.paperTrading) {
      for (const order of this.paperBroker.getOpenOrders()) {
        this.paperBroker.updateOrder(order.id, price, eventTs);
      }
    }
  }

  private handleBookSnapshot(event: Extract<MarketEvent, { kind: 'bookSnapshot' }>): void {
    this.orderBook.applySnapshot(event.bids, event.asks, event.seq ?? 0, event.eventTs);
    this.onBookUpdate(event.eventTs);
  }

  private handleBookDelta(event: Extract<MarketEvent, { kind: 'bookDelta' }>): void {
    this.orderBook.applyDelta(event.bids, event.asks, event.firstSeq, event.lastSeq, event.eventTs);
    this.onBookUpdate(event.eventTs);
  }

  private handleMarkPrice(event: Extract<MarketEvent, { kind: 'markPrice' }>): void {
    this.lastPrice = event.price;
  }

  private onBookUpdate(eventTs: number): void {
    const book = this.orderBook.getState();
    if (!book) return;
    const { bestBid, bestAsk } = book;
    if (bestBid <= 0 || bestAsk <= 0) return;
    const mid = (bestBid + bestAsk) / 2;
    const spread = bestAsk - bestBid;
    this.lastMid = mid;

    // Build feature frame
    const lastFlow = this.frameBuilder.flow.getLastCandle();
    const detScoreVal = {
      value: 0, valid: false, warmup: 0, ageMs: 0,
    };

    // Run detectors
    const detCtx = {
      bids: book.bids, asks: book.asks, mid, spread, bestBid, bestAsk,
      lastFlowDelta: lastFlow?.delta ?? 0,
      lastFlowVolume: lastFlow?.volume ?? 0,
      flowPressure: lastFlow?.pressure ?? 0,
      vpin: this.frameBuilder.vpin.getValue(eventTs).value,
      eventTs,
    };
    const detResult = this.detectorAgg.run(detCtx);
    detScoreVal.value = detResult.side === 'bullish' ? detResult.confidence
      : detResult.side === 'bearish' ? -detResult.confidence : 0;
    detScoreVal.valid = detResult.confidence > 0.1;

    const frame = this.frameBuilder.buildFrame({
      symbol: this.config.symbol,
      eventTs,
      bids: book.bids,
      asks: book.asks,
      mid,
      bestBid,
      bestAsk,
      detectorScore: detScoreVal,
    });
    this.lastFrame = frame;

    // Score model
    const score = computeCompositeScore(frame);
    this.lastScore = score;

    // Filters (BEFORE FSM — P0 fix: filter before engine)
    const filterResult = runFilters(frame);
    const hardVeto = !filterResult.passed;

    // Decision FSM — skip if hard veto
    let decision: { fired: boolean; side: 'BUY' | 'SELL' | null };
    if (hardVeto) {
      decision = { fired: false, side: null };
    } else {
      decision = this.decisionFSM.tick(score, eventTs);
    }

    if (decision.fired) {
      const side = decision.side === 'bullish' ? 'BUY' : 'SELL';
      const signal: ApprovedSignal = {
        id: 'sig_' + eventTs.toString(36),
        symbol: this.config.symbol,
        side,
        eventTs,
        price: mid,
        score,
        calibratedProbability: null,
        frameId: frame.id,
        strategyVersion: 'v3.1',
        filters: filterResult.decisions,
      };
      this.lastSignal = signal;

      // Forward tracker
      this.forwardTracker.addSignal(signal);

      // Paper trading
      if (this.config.paperTrading) {
        this.executePaperTrade(signal, spread, detResult);
      }

      this.eventBus.emit('signal', signal);
    }

    this.eventBus.emit('frame', frame);
  }

  private executePaperTrade(signal: ApprovedSignal, spread: number, detResult: DetectorResult): void {
    // Find wall level for SL
    const wallPrice = this.findRelevantWall(signal.side, detResult);
    const slippageBps = 1;
    const plan = createTradePlan(signal.side, signal.price, spread, wallPrice, slippageBps, 1.5, 2.5, 2.0);
    if (!plan) return;

    const sizing = sizePosition(
      this.portfolioState.totalEquity,
      0.02, // riskFraction
      plan.entryPrice,
      plan.stopLoss,
      0.45, // winRate
      1.5,  // avgWinLossRatio
      0.1,  // maxPositionFraction
    );

    const riskCheck = checkPortfolioRisk(this.portfolioState, signal.side, sizing.riskAmount);
    if (!riskCheck.allowed) return;

    this.paperBroker.submitOrder(plan, sizing, signal.eventTs);
  }

  private findRelevantWall(side: 'BUY' | 'SELL', detResult: DetectorResult): number | null {
    // Use detector evidence to find wall level
    const results = this.detectorAgg.lastResults;
    for (const r of results) {
      if (r.detector === 'wall' || r.detector === 'compression') {
        const wallPrice = r.evidence.wallPrice as number | undefined;
        if (wallPrice && side === 'BUY' && r.side === 'bearish') return wallPrice;
        if (wallPrice && side === 'SELL' && r.side === 'bullish') return wallPrice;
      }
    }
    return null;
  }

  /** Subscribe to runtime events */
  on<K extends keyof ReturnType<typeof this.eventBus['listeners']>>(
    event: K,
    handler: (data: any) => void
  ): () => void {
    return this.eventBus.subscribe(event as string, handler);
  }

  getState(): RuntimeState {
    return {
      connected: true,
      symbol: this.config.symbol,
      lastPrice: this.lastPrice,
      lastFrame: this.lastFrame,
      lastDetectorResults: this.detectorAgg.lastResults,
      lastScore: this.lastScore,
      lastSignal: this.lastSignal,
      regime: 'unknown',
    };
  }

  getPaperBroker(): PaperBroker { return this.paperBroker; }
  getForwardTracker(): ForwardTracker { return this.forwardTracker; }
  getOrderBookState() { return this.orderBook.getState(); }
  getFrameBuilder() { return this.frameBuilder; }

  reset(): void {
    this.frameBuilder.reset();
    this.orderBook.reset();
    this.detectorAgg.reset();
    this.forwardTracker.reset();
    this.paperBroker.reset();
    this.decisionFSM.reset();
    this.lastFrame = null;
    this.lastSignal = null;
    this.lastScore = 0;
    this.lastPrice = 0;
    this.lastMid = 0;
  }
}
