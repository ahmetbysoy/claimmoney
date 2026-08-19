import type { DetectorResult, DetectorContext } from '../detectors/detector';
import { WallDetector } from '../detectors/wallDetector';
import { CompressionDetector } from '../detectors/compressionDetector';
import { SkewDetector } from '../detectors/skewDetector';
import { LiquidityVoidDetector } from '../detectors/liquidityVoidDetector';
import { LadderDetector } from '../detectors/ladderDetector';
import { IcebergDetector } from '../detectors/icebergDetector';
import { FlowExpansionDetector } from '../detectors/flowExpansionDetector';
import { QuoteManipulationDetector } from '../detectors/quoteManipulationDetector';
import { LiquidationClusterDetector } from '../detectors/liquidationClusterDetector';

export class DetectorAggregator {
  private wall = new WallDetector();
  private compression = new CompressionDetector();
  private skew = new SkewDetector();
  private voidDet = new LiquidityVoidDetector();
  private ladder = new LadderDetector();
  private iceberg = new IcebergDetector();
  private flowExp = new FlowExpansionDetector();
  private quoteManip = new QuoteManipulationDetector();
  private liqCluster = new LiquidationClusterDetector();

  /** Individual results for UI diagnostics */
  lastResults: DetectorResult[] = [];

  run(ctx: DetectorContext): DetectorResult {
    const results: DetectorResult[] = [
      this.wall.detect(ctx),
      this.compression.detect(ctx),
      this.skew.detect(ctx),
      this.voidDet.detect(ctx),
      this.ladder.detect(ctx),
      this.iceberg.detect(ctx),
      this.flowExp.detect(ctx),
      this.quoteManip.detect(ctx),
      this.liqCluster.detect(ctx),
    ];
    this.lastResults = results;
    let bullScore = 0;
    let bearScore = 0;
    for (const r of results) {
      if (r.side === 'bullish') bullScore += r.confidence;
      else if (r.side === 'bearish') bearScore += r.confidence;
    }
    const total = bullScore + bearScore;
    if (total === 0) return { detector: 'aggregator', side: 'neutral', confidence: 0, evidence: { bullScore, bearScore } };
    const score = (bullScore - bearScore) / total;
    return {
      detector: 'aggregator',
      side: score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral',
      confidence: Math.abs(score),
      evidence: { bullScore, bearScore, score },
    };
  }

  /** Feed liquidation data to cluster detector */
  onLiquidation(price: number, qty: number, side: 'long' | 'short', ts: number): void {
    this.liqCluster.onLiquidation(price, qty, side, ts);
  }

  reset(): void {
    this.wall.reset();
    this.flowExp.reset();
    this.quoteManip.reset();
    this.liqCluster.reset();
    this.lastResults = [];
  }
}