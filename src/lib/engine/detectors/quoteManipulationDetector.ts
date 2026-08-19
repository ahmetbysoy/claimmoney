import type { DetectorResult, DetectorContext } from './detector';

export class QuoteManipulationDetector {
  name = 'quote_manipulation';
  detect(_ctx: DetectorContext): DetectorResult {
    return { detector: this.name, side: 'neutral', confidence: 0, evidence: {} };
  }
}
