'use client'

import { createContext, useContext } from 'react'
import type { Currency } from '@/lib/types'

/**
 * Active currency seen by every money-rendering component. The dashboard
 * currently runs USD-only — no toggle. KHR data (post 2026-05-19) is not
 * shown. Flip the default here (or reintroduce a toggle) when KHR display
 * is needed again.
 */
export const CurrencyContext = createContext<Currency>('USD')

export function useCurrency(): Currency {
  return useContext(CurrencyContext)
}
