import type { Transaction } from '@/lib/types'

type Props = { transactions: Transaction[]; total: number }

export function SummaryBar({ transactions, total }: Props) {
  const revenue = transactions.reduce((sum, t) => sum + t.unitPrice * t.qty, 0)
  const units = transactions.reduce((sum, t) => sum + t.qty, 0)

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white rounded-lg px-4 py-3 text-sm border border-[#ede9fe] shadow-sm">
      <div>
        <span className="text-[#9ca3af] mr-2">Showing</span>
        <span className="text-[#7c3aed] font-bold">{transactions.length.toLocaleString()}</span>
        <span className="text-[#9ca3af]"> / {total.toLocaleString()} rows</span>
      </div>
      <div className="h-4 w-px bg-[#ede9fe] hidden sm:block" />
      <div>
        <span className="text-[#9ca3af] mr-2">Revenue</span>
        <span className="text-[#ec4899] font-bold">${revenue.toFixed(2)}</span>
      </div>
      <div className="h-4 w-px bg-[#ede9fe] hidden sm:block" />
      <div>
        <span className="text-[#9ca3af] mr-2">Units</span>
        <span className="text-[#1e1b4b] font-bold">{units.toLocaleString()}</span>
      </div>
    </div>
  )
}
