import type { Transaction } from '@/lib/types'

type Props = { transactions: Transaction[]; total: number }

export function SummaryBar({ transactions, total }: Props) {
  const revenue = transactions.reduce((sum, t) => sum + t.unitPrice * t.qty, 0)
  const units = transactions.reduce((sum, t) => sum + t.qty, 0)

  return (
    <div className="flex flex-wrap items-center gap-4 bg-card rounded-lg px-4 py-3 text-sm border border-border shadow-sm">
      <div>
        <span className="text-muted mr-2">Showing</span>
        <span className="text-accent font-bold">{transactions.length.toLocaleString()}</span>
        <span className="text-muted"> / {total.toLocaleString()} rows</span>
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div>
        <span className="text-muted mr-2">Revenue</span>
        <span className="text-accent-pink font-bold">${revenue.toFixed(2)}</span>
      </div>
      <div className="h-4 w-px bg-border hidden sm:block" />
      <div>
        <span className="text-muted mr-2">Units</span>
        <span className="text-foreground font-bold">{units.toLocaleString()}</span>
      </div>
    </div>
  )
}
