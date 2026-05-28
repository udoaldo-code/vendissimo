'use client'

import { useCurrencyContext } from './currency-context'

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrencyContext()
  const isUsd = currency === 'USD'
  return (
    <button
      type="button"
      onClick={() => setCurrency(isUsd ? 'KHR' : 'USD')}
      className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-foreground hover:border-accent hover:text-accent transition-colors"
      title={`Switch to ${isUsd ? 'KHR' : 'USD'} display`}
    >
      {isUsd ? '$ USD' : '៛ KHR'}
    </button>
  )
}
