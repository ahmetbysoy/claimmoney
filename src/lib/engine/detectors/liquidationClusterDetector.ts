import type { DetectorResult, DetectorContext } from './detector';

export class LiquidationClusterDetector {
  name = 'liquidation_cluster';
  detect(_ctx: DetectorContext): DetectorResult {
    return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
  }
}