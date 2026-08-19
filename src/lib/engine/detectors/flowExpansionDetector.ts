import type { DetectorResult, DetectorContext } from './detector';

export class FlowExpansionDetector {
  name = 'flow_expansion';
  private prevDelta = 0;
  private activityThreshold = 100000;

  detect(ctx: DetectorContext): DetectorResult {
    const delta = ctx.lastFlowDelta;
    const volume = ctx.lastFlowVolume;
    const result: DetectorResult = { detector: this.name, side: 'neutral', confidence: 0, evidence: { delta, volume } };
    if (volume < this.activityThreshold) { this.prevDelta = delta; return result; }
    if (this.prevDelta !== 0 && Math.abs(delta) >= Math.abs(this.prevDelta) * 2) {
      result.side = delta > 0 ? 'bullish' : 'bearish';
      result.confidence = Math.min(Math.abs(delta) / this.activityThreshold, 1) * 0.8;
    }
    this.prevDelta = delta;
    return result;
  }
  reset(): void { this.prevDelta = 0; }
}