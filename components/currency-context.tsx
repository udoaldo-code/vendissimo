'use client'

import { createContext, useContext } from 'react'
import type { Currency } from '@/lib/types'

export const CurrencyContext = createContext<Currency>('KHR')

export function useCurrency(): Currency {
  return useContext(CurrencyContext)
}
