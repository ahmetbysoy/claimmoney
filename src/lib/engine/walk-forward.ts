import type { Candle, RiskConfig, WalkForwardResult, WalkForwardWindow, CalibrationResult } from './types';
import { Calibrator } from './calibration';
import { average, standardDeviation } from './helpers';

export class WalkForwardAnalyzer {
  private calibrator = new Calibrator();

  analyze(
    data: Candle[],
    config: { windowSize: number; stepSize: number; trainRatio: number },
    detector: string,
    paramRanges: Record<string, [number, number]>,
    riskConfig: RiskConfig
  ): WalkForwardResult {
    const windows: WalkForwardWindow[] = [];
    const totalLen = data.length;
    let start = 0;

    while (start + config.windowSize <= totalLen) {
      const end = start + config.windowSize;
      const windowData = data.slice(start, end);
      const trainEnd = Math.floor(windowData.length * config.trainRatio);
      const trainData = windowData.slice(0, trainEnd);
      const testData = windowData.slice(trainEnd);

      if (trainData.length < 20 || testData.length < 5) {
        start += config.stepSize;
        continue;
      }

      const inSampleResults = this.calibrator.calibrate(detector, paramRanges, trainData, riskConfig, 3);
      const bestInSample = this.calibrator.getBestResult(inSampleResults);

      const outSampleResults = this.calibrator.calibrate(detector, paramRanges, testData, riskConfig, 3);
      const bestOutSample = this.calibrator.getBestResult(outSampleResults);

      windows.push({
        inSampleStart: trainData[0].ts,
        inSampleEnd: trainData[trainData.length - 1].ts,
        outOfSampleStart: testData[0].ts,
        outOfSampleEnd: testData[testData.length - 1].ts,
        inSampleResult: bestInSample,
        outOfSampleResult: bestOutSample,
      });

      start += config.stepSize;
    }

    if (windows.length === 0) {
      return { windows: [], aggregatedSharpe: 0, aggregatedMaxDD: 0, aggregatedWinRate: 0, isRobust: false };
    }

    const oosSharpe = windows.map((w) => w.outOfSampleResult.sharpeRatio);
    const oosDD = windows.map((w) => w.outOfSampleResult.maxDrawdown);
    const oosWR = windows.map((w) => w.outOfSampleResult.winRate);

    const aggSharpe = average(oosSharpe);
    const aggMaxDD = Math.max(...oosDD);
    const aggWinRate = average(oosWR);

    // Robustness: check consistency across windows
    const sharpeStd = standardDeviation(oosSharpe);
    const isRobust = aggSharpe > 0 && sharpeStd < Math.abs(aggSharpe) * 0.5 && windows.length >= 3;

    return {
      windows,
      aggregatedSharpe: aggSharpe,
      aggregatedMaxDD: aggMaxDD,
      aggregatedWinRate: aggWinRate,
      isRobust,
    };
  }

  exportResults(result: WalkForwardResult): string {
    return JSON.stringify(result, null, 2);
  }
}
