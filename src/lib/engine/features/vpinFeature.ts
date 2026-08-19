import type { FeatureValue } from '../domain/frames';

interface Bucket {
  buyVol: number;
  sellVol: number;
  totalVol: number;
  imbalance: number;
  complete: boolean;
}

export class VPINFeature {
  private buckets: Bucket[] = [];
  private currentBucket: Bucket;
  private bucketSize: number;
  private maxBuckets: number;
  private minWarmup: number;

  constructor(config?: { bucketSize?: number; maxBuckets?: number; minWarmup?: number }) {
    this.bucketSize = config?.bucketSize ?? 100000;
    this.maxBuckets = config?.maxBuckets ?? 50;
    this.minWarmup = config?.minWarmup ?? 20;
    this.currentBucket = this.newBucket();
  }

  private newBucket(): Bucket {
    return { buyVol: 0, sellVol: 0, totalVol: 0, imbalance: 0, complete: false };
  }

  onTrade(side: 'buy' | 'sell', qty: number): void {
    let remaining = qty;
    while (remaining > 0 && this.currentBucket.totalVol + remaining >= this.bucketSize) {
      const fill = this.bucketSize - this.currentBucket.totalVol;
      this.addToBucket(fill, side);
      remaining -= fill;
      this.closeBucket();
    }
    if (remaining > 0) this.addToBucket(remaining, side);
  }

  private addToBucket(qty: number, side: 'buy' | 'sell'): void {
    this.currentBucket.totalVol += qty;
    if (side === 'buy') this.currentBucket.buyVol += qty;
    else this.currentBucket.sellVol += qty;
    this.currentBucket.imbalance = Math.abs(this.currentBucket.buyVol - this.currentBucket.sellVol) / (this.currentBucket.totalVol || 1);
  }

  private closeBucket(): void {
    if (this.currentBucket.totalVol > 0) {
      this.currentBucket.complete = true;
      this.buckets.push(this.currentBucket);
      if (this.buckets.length > this.maxBuckets) this.buckets.shift();
    }
    this.currentBucket = this.newBucket();
  }

  getValue(ts: number): FeatureValue {
    const completed = this.buckets.filter(b => b.complete);
    if (completed.length < this.minWarmup) {
      return { value: 0, valid: false, warmup: completed.length, ageMs: 0 };
    }
    const mean = completed.reduce((s, b) => s + b.imbalance, 0) / completed.length;
    return {
      value: mean,
      valid: true,
      warmup: completed.length,
      ageMs: 0,
      evidence: { meanImbalance: mean, completedBuckets: completed.length },
    };
  }

  reset(): void {
    this.buckets = [];
    this.currentBucket = this.newBucket();
  }
}