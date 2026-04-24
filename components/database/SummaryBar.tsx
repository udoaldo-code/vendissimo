'use client'

import type { Transaction } from '@/lib/types'

type Props = { transactions: Transaction[]; total: number }

export function SummaryBar({ transactions, total }: Props) {
  const revenue = transactions.reduce((sum, t) => sum + t.unitPrice * t.qty, 0)
  const units = transactions.reduce((sum, t) => sum + t.qty, 0)

  return (
    <div className="flex items-center gap-6 bg-[#292524] rounded-lg px-4 py-3 text-sm">
      <div>
        <span className="text-[#57534e] mr-2">Showing</span>
        <span className="text-[#fbbf24] font-bold">{transactions.length.toLocaleString()}</span>
        <span className="text-[#57534e]"> / {total.toLocaleString()} rows</span>
      </div>
      <div className="h-4 w-px bg-[#44403c]" />
      <div>
        <span className="text-[#57534e] mr-2">Revenue</span>
        <span className="text-[#f97316] font-bold">${revenue.toFixed(2)}</span>
      </div>
      <div className="h-4 w-px bg-[#44403c]" />
      <div>
        <span className="text-[#57534e] mr-2">Units</span>
        <span className="text-[#e7e5e4] font-bold">{units.toLocaleString()}</span>
      </div>
    </div>
  )
}
