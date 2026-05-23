'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Currency } from '@/lib/types'

export const CurrencyContext = createContext<Currency>('KHR')

/** Consume the active currency from context. */
export function useCurrency(): Currency {
  return useContext(CurrencyContext)
}

/**
 * Owner-side hook: returns the active currency, synced with
 * localStorage['currency'] and the `currencychange` window event so the
 * value matches whatever the header CurrencyToggle has set.
 */
export function useCurrencyState(): Currency {
  const [currency, setCurrency] = useState<Currency>('KHR')

  useEffect(() => {
    try {
      if (localStorage.getItem('currency') === 'USD') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrency('USD')
      }
    } catch {
      // storage unavailable — stay on KHR
    }
    function onChange(e: Event) {
      const next = (e as CustomEvent<Currency>).detail
      if (next === 'USD' || next === 'KHR') setCurrency(next)
    }
    window.addEventListener('currencychange', onChange)
    return () => window.removeEventListener('currencychange', onChange)
  }, [])

  return currency
}
