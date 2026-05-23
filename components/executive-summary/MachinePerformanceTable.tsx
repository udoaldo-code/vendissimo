'use client'

import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
import type { MachineRow } from '@/lib/types'

export function MachinePerformanceTable({ machines }: { machines: MachineRow[] }) {
  const currency = useCurrency()
  const topMachines = [...machines]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return (
    <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
      <p className="text-muted text-xs uppercase tracking-wider mb-4">Top Machines by Revenue</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-muted text-xs uppercase">
              <th className="text-left pb-2 font-medium">Rank</th>
              <th className="text-left pb-2 font-medium">Machine</th>
              <th className="text-left pb-2 font-medium">Location</th>
              <th className="text-right pb-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {topMachines.map((m, i) => (
              <tr key={`${m.machine}-${m.location}-${i}`} className="border-t border-border hover:bg-surface-hover">
                <td className="py-2 text-muted-strong text-xs font-semibold">{i + 1}</td>
                <td className="py-2 text-foreground text-xs">{m.machine}</td>
                <td className="py-2 text-muted-strong text-xs">{m.location}</td>
                <td className="py-2 text-right text-foreground text-xs font-semibold">{formatMoney(m.revenue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
