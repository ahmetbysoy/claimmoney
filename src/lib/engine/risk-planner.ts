import type { RiskConfig, Position, Signal } from './types';
import { clamp } from './helpers';

export class RiskPlanner {
  calculatePositionSize(
    config: RiskConfig,
    entryPrice: number,
    stopLoss: number
  ): number {
    if (entryPrice === stopLoss || entryPrice === 0) return 0;
    const riskAmount = config.equity * config.maxRiskPerTrade;
    const priceRisk = Math.abs(entryPrice - stopLoss);
    return riskAmount / priceRisk;
  }

  calculateStopLoss(
    entryPrice: number,
    atr: number,
    multiplier: number
  ): number {
    return entryPrice - atr * multiplier;
  }

  calculateTakeProfits(
    entryPrice: number,
    stopLoss: number,
    tp1R: number,
    tp2R: number
  ): { tp1: number; tp2: number } {
    const risk = Math.abs(entryPrice - stopLoss);
    return {
      tp1: entryPrice + risk * tp1R,
      tp2: entryPrice + risk * tp2R,
    };
  }

  checkRisk(
    config: RiskConfig,
    openPositions: Position[],
    newSignal: Signal
  ): boolean {
    // Max positions check
    if (openPositions.length >= config.maxOpenPositions) return false;

    // Max daily loss check
    const dailyPnL = this.getDailyPnL(openPositions);
    const maxLoss = config.equity * config.maxDailyLoss;
    if (dailyPnL <= -maxLoss) return false;

    // Correlation check
    const sameDirCount = openPositions.filter(
      (p) => p.side === newSignal.side
    ).length;
    const maxCorr = Math.ceil(config.maxCorrelationExposure * config.maxOpenPositions);
    if (sameDirCount >= maxCorr) return false;

    return true;
  }

  getDailyPnL(positions: Position[]): number {
    return positions.reduce((sum, p) => sum + p.pnl, 0);
  }

  getPortfolioHeat(
    config: RiskConfig,
    openPositions: Position[]
  ): number {
    if (config.equity === 0) return 0;
    const totalRisk = openPositions.reduce((sum, p) => {
      const risk = Math.abs(p.entryPrice - p.stopLoss) * p.size;
      return sum + risk;
    }, 0);
    return totalRisk / config.equity;
  }
}
