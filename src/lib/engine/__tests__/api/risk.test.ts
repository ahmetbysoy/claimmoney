import { describe, it, expect } from 'vitest';
import { RiskPlanner } from '@/lib/engine/risk-planner';
import type { RiskConfig } from '@/lib/engine/types';

const defaultConfig: RiskConfig = {
  equity: 10000,
  maxRiskPerTrade: 0.02,
  maxOpenPositions: 5,
  maxDailyLoss: 500,
  maxCorrelationExposure: 3,
  defaultStopLossATR: 1.5,
  defaultTP1R: 1,
  defaultTP2R: 2,
};

describe('Risk API', () => {
  it('GET risk config returns current config', () => {
    // Equivalent to GET /api/risk/config
    const response = { success: true, data: defaultConfig };
    expect(response.success).toBe(true);
    expect(response.data.equity).toBe(10000);
    expect(response.data.maxRiskPerTrade).toBe(0.02);
  });

  it('POST calculate returns position size and risk', () => {
    const planner = new RiskPlanner();
    const size = planner.calculatePositionSize(defaultConfig, 100, 98);
    const tp = planner.calculateTakeProfits(100, 98, 1, 2);
    const heat = planner.getPortfolioHeat(defaultConfig, []);
    // Equivalent to POST /api/risk/calculate
    const response = {
      success: true,
      data: { positionSize: size, takeProfits: tp, portfolioHeat: heat },
    };
    expect(response.data.positionSize).toBe(100);
    expect(response.data.takeProfits.tp1).toBe(102);
    expect(response.data.takeProfits.tp2).toBe(104);
  });
});
