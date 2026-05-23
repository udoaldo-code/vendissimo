'use client'

import { useEffect, useState } from 'react'
import type { Currency } from '@/lib/types'

const STORAGE_KEY = 'currency'
const EVENT = 'currencychange'

function readStored(): Currency {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'USD' ? 'USD' : 'KHR'
  } catch {
    return 'KHR'
  }
}

export function CurrencyToggle() {
  const [currency, setCurrency] = useState<Currency>('KHR')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrency(readStored())
    function onChange(e: Event) {
      const next = (e as CustomEvent<Currency>).detail
      if (next === 'USD' || next === 'KHR') setCurrency(next)
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  function toggle() {
    const next: Currency = currency === 'USD' ? 'KHR' : 'USD'
    setCurrency(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable — toggle still applies for this tab
    }
    window.dispatchEvent(new CustomEvent<Currency>(EVENT, { detail: next }))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={currency === 'USD' ? 'Switch to KHR' : 'Switch to USD'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-strong hover:text-accent hover:border-border-strong shadow-sm transition-colors"
    >
      <span>{currency === 'USD' ? '$' : '៛'}</span>
      {currency}
    </button>
  )
}
