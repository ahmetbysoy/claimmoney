import type { InstrumentSpec } from '../domain/instrument'
import { roundToStep } from '../domain/instrument'
import type { Signal } from '../types'
import type { WallEntry, TradePlan } from '../core/signal/tradePlan'

export interface TradePlannerConfig { minRR: number; stopVolMultiple: number; targetVolMultiple: number; feeRateBps: number; slippageBps: number }
export interface PlanContext { spread: number; volatilityBps: number; walls: { bid: WallEntry[]; ask: WallEntry[] }; instrument: InstrumentSpec }

export class TradePlanner {
  constructor(private config: TradePlannerConfig = { minRR: 1.8, stopVolMultiple: 1.5, targetVolMultiple: 2.8, feeRateBps: 4, slippageBps: 2 }) {}

  create(signal: Signal, context: PlanContext): TradePlan {
    const { instrument } = context
    const price = signal.price, spreadBuffer = Math.max(context.spread * 1.5, price * 0.0001)
    const volDistance = Math.max(price * Math.max(2, context.volatilityBps) / 10_000, context.spread * 3, instrument.tickSize * 3)
    const strongestBid = [...context.walls.bid].filter(wall => wall.price < price).sort((a, b) => b.notional - a.notional)[0]
    const strongestAsk = [...context.walls.ask].filter(wall => wall.price > price).sort((a, b) => b.notional - a.notional)[0]
    const isLong = signal.side === 'BUY'
    let entry = isLong ? price + spreadBuffer : price - spreadBuffer
    let stop = isLong ? entry - volDistance * this.config.stopVolMultiple : entry + volDistance * this.config.stopVolMultiple
    if (isLong && strongestBid) stop = Math.min(stop, strongestBid.price - context.spread)
    if (!isLong && strongestAsk) stop = Math.max(stop, strongestAsk.price + context.spread)
    let tp1 = isLong ? entry + volDistance * this.config.targetVolMultiple : entry - volDistance * this.config.targetVolMultiple
    if (isLong && strongestAsk && strongestAsk.price > entry) tp1 = Math.min(tp1, strongestAsk.price - context.spread)
    if (!isLong && strongestBid && strongestBid.price < entry) tp1 = Math.max(tp1, strongestBid.price + context.spread)
    const tp2 = isLong ? entry + volDistance * this.config.targetVolMultiple * 1.6 : entry - volDistance * this.config.targetVolMultiple * 1.6

    entry = roundToStep(entry, instrument.tickSize)
    stop = roundToStep(stop, instrument.tickSize, isLong ? 'down' : 'up')
    tp1 = roundToStep(tp1, instrument.tickSize, isLong ? 'down' : 'up')
    const roundedTp2 = roundToStep(tp2, instrument.tickSize, isLong ? 'down' : 'up')
    const risk = Math.abs(entry - stop)
    const grossReward = Math.abs(tp1 - entry)
    const costs = entry * (this.config.feeRateBps * 2 + this.config.slippageBps) / 10_000
    const netRR = risk > 0 ? Math.max(0, grossReward - costs) / (risk + costs) : 0
    if (!(isLong ? stop < entry && tp1 > entry : tp1 < entry && stop > entry) || netRR < this.config.minRR) {
      return { direction: 'NEUTRAL', confidence: 0, ts: signal.ts, rr: netRR, reason: `Net RR ${netRR.toFixed(2)} below ${this.config.minRR}` }
    }
    return {
      direction: isLong ? 'LONG' : 'SHORT', confidence: signal.confidence, entry, stop, tp1, tp2: roundedTp2,
      rr: netRR, ts: signal.ts, reason: `Approved ${signal.side} signal ${signal.id}`,
      walls: { strongWallBid: strongestBid, strongWallAsk: strongestAsk }
    }
  }
  updateConfig(config: Partial<TradePlannerConfig>): void { this.config = { ...this.config, ...config } }
}
