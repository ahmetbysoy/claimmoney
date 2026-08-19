import type { FeatureFrame } from '../domain/frames';
import type { FeatureValue } from '../domain/frames';
import { CVDFeature } from './cvdFeature';
import { OBIFeature } from './obiFeature';
import { VelocityFeature } from './velocityFeature';
import { MicropriceFeature } from './micropriceFeature';
import { VPINFeature } from './vpinFeature';
import { VolatilityFeature } from './volatilityFeature';
import { generateId } from '../helpers';

type FeatureExtractor = () => FeatureValue;

export class FeatureFrameBuilder {
  cvd = new CVDFeature();
  obi = new OBIFeature();
  velocity = new VelocityFeature();
  microprice = new MicropriceFeature();
  vpin = new VPINFeature();
  volatility = new VolatilityFeature();

  buildFrame(params: {
    symbol: string;
    eventTs: number;
    bids: { price: number; qty: number }[];
    asks: { price: number; qty: number }[];
    mid: number;
    bestBid: number;
    bestAsk: number;
    detectorScore: FeatureValue;
  }): FeatureFrame {
    const { symbol, eventTs, bids, asks, mid, bestBid, bestAsk, detectorScore } = params;
    const frame: FeatureFrame = { id: generateId('ff'), symbol, eventTs, dataQuality: 'invalid',
      cvdZ: this.cvd.getValue(eventTs), obi: this.obi.compute(bids, asks, mid, eventTs),
      velocityZ: this.velocity.getValue(eventTs), microDev: this.microprice.compute(mid, bestBid, bestAsk, eventTs),
      vpin: this.vpin.getValue(eventTs), detectorScore, volatility: this.volatility.getValue(eventTs),
    };
    const features: FeatureValue[] = [frame.cvdZ, frame.obi, frame.velocityZ, frame.microDev, frame.vpin, frame.detectorScore, frame.volatility];
    const validCount = features.filter(f => f.valid).length;
    frame.dataQuality = validCount >= 4 ? 'good' : validCount >= 2 ? 'degraded' : 'invalid';
    return frame;
  }

  reset(): void {
    this.cvd.reset(); this.obi.reset(); this.velocity.reset();
    this.microprice.reset(); this.vpin.reset(); this.volatility.reset();
  }
}