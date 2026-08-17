import { createContext, useContext } from 'react'
import type { MarketRuntime } from '../application/marketRuntime'

export const RuntimeContext = createContext<MarketRuntime | null>(null)
export function useMarketRuntime(): MarketRuntime | null { return useContext(RuntimeContext) }
