'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Currency } from '@/lib/types'

export const CurrencyContext = createContext<Currency>('USD')

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
  const [currency, setCurrency] = useState<Currency>('USD')

  useEffect(() => {
    try {
      if (localStorage.getItem('currency') === 'KHR') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrency('KHR')
      }
    } catch {
      // storage unavailable — stay on USD
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
