import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Source } from '../types'

export interface StrategyWeights { w1: number; w2: number; w3: number; w4: number; w5: number; w6: number }
export interface SettingsState {
  source: Source; symbol: string; weights: StrategyWeights; threshold: number; cooldown: number
  confirmations: number; minConfirmationMs: number; sound: boolean; haptics: boolean; reducedMotion: boolean
  paperTradingEnabled: boolean; balance: number; riskPct: number
  setSource: (source: Source) => void; setSymbol: (symbol: string) => void; setWeights: (weights: StrategyWeights) => void
  setThreshold: (value: number) => void; setCooldown: (value: number) => void; setConfirmations: (value: number) => void
  setSound: (value: boolean) => void; setHaptics: (value: boolean) => void; setReducedMotion: (value: boolean) => void
  setPaperTradingEnabled: (value: boolean) => void; setBalance: (value: number) => void; setRiskPct: (value: number) => void
}

export const DEFAULT_WEIGHTS: StrategyWeights = { w1: 0.30, w2: 0.18, w3: 0.13, w4: 0.16, w5: 0.10, w6: 0.13 }
export const normalizeStrategyWeights = (weights: StrategyWeights): StrategyWeights => {
  const values = Object.values(weights)
  if (values.some(value => !Number.isFinite(value) || value < 0)) return { ...DEFAULT_WEIGHTS }
  const sum = values.reduce((a, b) => a + b, 0)
  if (!sum) return { ...DEFAULT_WEIGHTS }
  return { w1: weights.w1 / sum, w2: weights.w2 / sum, w3: weights.w3 / sum, w4: weights.w4 / sum, w5: weights.w5 / sum, w6: weights.w6 / sum }
}
const normalizeSymbol = (symbol: unknown) => {
  const clean = String(symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean.endsWith('USDT') ? clean : `${clean}USDT`
}

export function migrateSettings(input: any, fromVersion: number): Partial<SettingsState> {
  let state = { ...(input ?? {}) }
  let version = fromVersion
  if (version < 4) {
    const old = state.weights ?? { w1: 0.5, w2: 0.3, w3: 0.2 }
    state.weights = { w1: Number(old.w1 ?? 0.5), w2: Number(old.w2 ?? 0.3), w3: Number(old.w3 ?? 0.2), w4: 0.18, w5: 0.12, w6: 0.13 }
    state.threshold = state.threshold ?? 0.75; state.cooldown = state.cooldown ?? 18; version = 4
  }
  if (version < 5) { state.paperTradingEnabled = false; version = 5 }
  if (version < 6) { state.weights = { ...DEFAULT_WEIGHTS, ...(state.weights ?? {}), w6: Number(state.weights?.w6 ?? 0.13) }; version = 6 }
  if (version < 7) { state.symbol = normalizeSymbol(state.symbol); version = 7 }
  if (version < 8) {
    state.confirmations = 2; state.minConfirmationMs = 100; state.reducedMotion = false
    state.paperTradingEnabled = Boolean(state.paperTradingEnabled ?? false)
    state.balance = Number(state.balance ?? 1000); state.riskPct = Number(state.riskPct ?? 1); version = 8
  }
  state.weights = normalizeStrategyWeights({ ...DEFAULT_WEIGHTS, ...(state.weights ?? {}) })
  state.symbol = normalizeSymbol(state.symbol)
  return state
}

export const useSettingsStore = create<SettingsState>()(persist((set) => ({
  source: 'okx', symbol: 'BTCUSDT', weights: { ...DEFAULT_WEIGHTS }, threshold: 0.75, cooldown: 18,
  confirmations: 2, minConfirmationMs: 100, sound: true, haptics: true, reducedMotion: false,
  paperTradingEnabled: false, balance: 1000, riskPct: 1,
  setSource: source => set({ source }), setSymbol: symbol => set({ symbol: normalizeSymbol(symbol) }),
  setWeights: weights => set({ weights: normalizeStrategyWeights(weights) }),
  setThreshold: threshold => set({ threshold: Math.max(0.1, Math.min(3, threshold)) }),
  setCooldown: cooldown => set({ cooldown: Math.max(0, Math.min(300, cooldown)) }),
  setConfirmations: confirmations => set({ confirmations: Math.max(1, Math.min(10, Math.round(confirmations))) }),
  setSound: sound => set({ sound }), setHaptics: haptics => set({ haptics }), setReducedMotion: reducedMotion => set({ reducedMotion }),
  setPaperTradingEnabled: paperTradingEnabled => set({ paperTradingEnabled }),
  setBalance: balance => set({ balance: Math.max(10, Number(balance) || 1000) }),
  setRiskPct: riskPct => set({ riskPct: Math.max(0.1, Math.min(5, Number(riskPct) || 1)) })
}), { name: 'claimmoney-settings', version: 8, migrate: (state, version) => migrateSettings(state, version) as SettingsState }))
