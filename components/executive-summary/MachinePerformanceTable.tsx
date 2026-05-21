import { Fragment } from 'react'
import type { MachineRow } from '@/lib/types'

export function MachinePerformanceTable({ machines }: { machines: MachineRow[] }) {
  const byLocation = machines.reduce<Record<string, MachineRow[]>>((acc, m) => {
    ;(acc[m.location] ??= []).push(m)
    return acc
  }, {})

  const locationTotals = Object.entries(byLocation).map(([loc, rows]) => ({
    location: loc,
    total: rows.reduce((sum, r) => sum + r.revenue, 0),
    machines: rows,
  }))

  return (
    <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
      <p className="text-muted text-xs uppercase tracking-wider mb-4">Machine Performance</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[400px]">
          <thead>
            <tr className="text-muted text-xs uppercase">
              <th className="text-left pb-2 font-medium">Machine</th>
              <th className="text-right pb-2 font-medium">Units</th>
              <th className="text-right pb-2 font-medium">Revenue</th>
              <th className="text-right pb-2 font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {locationTotals.map(({ location, total, machines: rows }) => (
              <Fragment key={location}>
                <tr className="border-t border-border">
                  <td colSpan={2} className="py-2 text-accent font-semibold text-xs uppercase tracking-wide">
                    📍 {location}
                  </td>
                  <td className="py-2 text-right text-accent font-semibold">${total.toFixed(2)}</td>
                  <td />
                </tr>
                {rows.map(m => (
                  <tr key={m.machine} className="hover:bg-surface-hover">
                    <td className="py-1.5 pl-4 text-muted-strong text-xs">{m.machine}</td>
                    <td className="py-1.5 text-right text-muted-strong text-xs">{m.unitsSold.toLocaleString()}</td>
                    <td className="py-1.5 text-right text-foreground text-xs">${m.revenue.toFixed(2)}</td>
                    <td className="py-1.5 text-right text-muted text-xs">{m.revShare.toFixed(1)}%</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
