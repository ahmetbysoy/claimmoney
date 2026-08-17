export interface LabeledSample { ts: number; score: number; outcome: number; regime?: string }
export interface WalkForwardFold { train: LabeledSample[]; test: LabeledSample[]; trainStart: number; testStart: number; testEnd: number }
export interface FoldMetrics { samples: number; winRate: number; expectancy: number; median: number; maxDrawdown: number }

export function purgedWalkForward(samples: LabeledSample[], trainSize: number, testSize: number, purgeSize: number): WalkForwardFold[] {
  if (trainSize <= 0 || testSize <= 0 || purgeSize < 0) throw new RangeError('Invalid walk-forward sizes')
  const sorted = [...samples].sort((a, b) => a.ts - b.ts), folds: WalkForwardFold[] = []
  for (let testStartIndex = trainSize + purgeSize; testStartIndex + testSize <= sorted.length; testStartIndex += testSize) {
    const trainEnd = testStartIndex - purgeSize
    const train = sorted.slice(Math.max(0, trainEnd - trainSize), trainEnd)
    const test = sorted.slice(testStartIndex, testStartIndex + testSize)
    if (train.length && test.length) folds.push({ train, test, trainStart: train[0].ts, testStart: test[0].ts, testEnd: test.at(-1)!.ts })
  }
  return folds
}

export function evaluateFold(samples: LabeledSample[]): FoldMetrics {
  const returns = samples.map(sample => sample.outcome), sorted = [...returns].sort((a, b) => a - b)
  const median = sorted.length ? (sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0
  let equity = 0, peak = 0, maxDrawdown = 0
  for (const value of returns) { equity += value; peak = Math.max(peak, equity); maxDrawdown = Math.max(maxDrawdown, peak - equity) }
  return { samples: returns.length, winRate: returns.length ? returns.filter(value => value > 0).length / returns.length : 0,
    expectancy: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0, median, maxDrawdown }
}
