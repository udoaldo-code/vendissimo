'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { Currency } from '@/lib/types'

type CurrencyCtx = {
  currency: Currency
  setCurrency: (c: Currency) => void
  khrPerUsd: number  // used for back-conversion when displaying KHR
}

const Ctx = createContext<CurrencyCtx | null>(null)

type ProviderProps = {
  children: React.ReactNode
  /** KHR per USD — used for back-converting USD→KHR display. Defaults to 4018. */
  khrPerUsd?: number
  /** Initial currency, defaults to USD. */
  initial?: Currency
}

export function CurrencyProvider({ children, khrPerUsd = 4018, initial = 'USD' }: ProviderProps) {
  const [currency, setCurrencyState] = useState<Currency>(initial)
  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), [])
  const value = useMemo<CurrencyCtx>(() => ({ currency, setCurrency, khrPerUsd }), [currency, setCurrency, khrPerUsd])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/**
 * Active currency seen by every money-rendering component. Falls back to USD
 * when no provider is mounted (e.g. legacy callers).
 */
export function useCurrency(): Currency {
  const v = useContext(Ctx)
  return v ? v.currency : 'USD'
}

export function useCurrencyContext(): CurrencyCtx {
  const v = useContext(Ctx)
  // Fallback: assume USD + 4018 if no provider — legacy callers don't break.
  return v ?? { currency: 'USD', setCurrency: () => {}, khrPerUsd: 4018 }
}
