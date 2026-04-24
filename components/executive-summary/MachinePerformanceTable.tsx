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
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-4">Machine Performance</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[#57534e] text-xs uppercase">
            <th className="text-left pb-2 font-medium">Machine</th>
            <th className="text-right pb-2 font-medium">Units</th>
            <th className="text-right pb-2 font-medium">Revenue</th>
            <th className="text-right pb-2 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {locationTotals.map(({ location, total, machines: rows }) => (
            <Fragment key={location}>
              <tr className="border-t border-[#44403c]">
                <td colSpan={2} className="py-2 text-[#fbbf24] font-semibold text-xs uppercase tracking-wide">
                  {location}
                </td>
                <td className="py-2 text-right text-[#fbbf24] font-semibold">${total.toFixed(2)}</td>
                <td />
              </tr>
              {rows.map(m => (
                <tr key={m.machine} className="hover:bg-[#44403c]/30">
                  <td className="py-1.5 pl-4 text-[#a8a29e] text-xs">{m.machine}</td>
                  <td className="py-1.5 text-right text-[#a8a29e] text-xs">{m.unitsSold.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-[#e7e5e4] text-xs">${m.revenue.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-[#57534e] text-xs">{m.revShare.toFixed(1)}%</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
