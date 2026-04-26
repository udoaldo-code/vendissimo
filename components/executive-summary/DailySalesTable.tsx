'use client'

import { Fragment } from 'react'
import type { DailySalesData } from '@/lib/types'
import type { DatePreset } from './DateFilter'
import { parseTransactionDate } from '@/lib/filter-utils'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmtDateHeader(dateStr: string): { day: string; date: string } {
  const d = parseTransactionDate(dateStr)
  if (isNaN(d.getTime())) return { day: '—', date: dateStr }
  const day = DAY_NAMES[d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  const yy = String(d.getFullYear()).slice(2)
  return { day, date: `${dd}-${mon}-${yy}` }
}

const LOCATION_COLORS: Record<string, string> = {
  Airport: '#dc2626',
  Hospital: '#1d4ed8',
}
function locationColor(loc: string): string {
  return LOCATION_COLORS[loc] ?? '#7c3aed'
}

type Props = {
  dailySales: DailySalesData
  preset: DatePreset
}

export function DailySalesTable({ dailySales, preset }: Props) {
  const { dates, machines, locationTotals, grandTotal } = dailySales

  const displayDates = (preset === 'all' ? dates.slice(-14) : dates).slice().reverse()

  if (displayDates.length === 0 || machines.length === 0) return null

  const locations: string[] = []
  const byLocation: Record<string, typeof machines> = {}
  for (const m of machines) {
    if (!byLocation[m.location]) { byLocation[m.location] = []; locations.push(m.location) }
    byLocation[m.location].push(m)
  }

  const tdBase = 'py-1.5 px-2 text-xs whitespace-nowrap border-b border-[#ede9fe]'
  const numCell = `${tdBase} text-right tabular-nums`

  function entry(daily: Record<string, { qty: number; rev: number }>, date: string) {
    const e = daily[date]
    return e ?? { qty: 0, rev: 0 }
  }

  return (
    <div className="bg-white rounded-lg border border-[#ede9fe] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#ede9fe] flex items-center justify-between">
        <p className="text-[#9ca3af] text-xs uppercase tracking-wider">Daily Sales by Machine</p>
        {preset === 'all' && (
          <span className="text-[#9ca3af] text-xs">Last 14 days shown · Totals reflect full period</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            {/* Row 1: day names */}
            <tr className="bg-[#f5f3ff]">
              <th className="sticky left-0 z-10 bg-[#f5f3ff] py-1.5 px-3 text-left text-[#9ca3af] font-medium whitespace-nowrap border-b border-[#ede9fe] min-w-[160px]">
                Name of Machine
              </th>
              {displayDates.map(d => (
                <th key={d} colSpan={2} className="py-1.5 px-2 text-center text-[#6b7280] font-medium border-b border-[#ede9fe] border-l border-[#ede9fe]">
                  {fmtDateHeader(d).day}
                </th>
              ))}
              <th colSpan={2} className="py-1.5 px-2 text-center text-[#7c3aed] font-semibold border-b border-[#ede9fe] border-l border-[#ede9fe]">
                TOTAL
              </th>
            </tr>
            {/* Row 2: dates */}
            <tr className="bg-[#f5f3ff]">
              <th className="sticky left-0 z-10 bg-[#f5f3ff] border-b border-[#ede9fe]" />
              {displayDates.map(d => (
                <th key={d} colSpan={2} className="py-1 px-2 text-center text-[#6b7280] font-normal border-b border-[#ede9fe] border-l border-[#ede9fe]">
                  {fmtDateHeader(d).date}
                </th>
              ))}
              <th colSpan={2} className="border-b border-[#ede9fe] border-l border-[#ede9fe]" />
            </tr>
            {/* Row 3: Qty / Rev sub-headers */}
            <tr className="bg-[#faf5ff]">
              <th className="sticky left-0 z-10 bg-[#faf5ff] border-b border-[#ede9fe]" />
              {displayDates.map(d => (
                <Fragment key={d}>
                  <th className="py-1 px-2 text-right text-[#9ca3af] font-medium border-b border-[#ede9fe] border-l border-[#ede9fe] whitespace-nowrap">Qty</th>
                  <th className="py-1 px-2 text-right text-[#9ca3af] font-medium border-b border-[#ede9fe] whitespace-nowrap">Rev</th>
                </Fragment>
              ))}
              <th className="py-1 px-2 text-right text-[#9ca3af] font-medium border-b border-[#ede9fe] border-l border-[#ede9fe] whitespace-nowrap">Qty</th>
              <th className="py-1 px-2 text-right text-[#9ca3af] font-medium border-b border-[#ede9fe] whitespace-nowrap">Rev</th>
            </tr>
          </thead>
          <tbody>
            {locations.map(loc => {
              const lt = locationTotals[loc]
              const color = locationColor(loc)
              return (
                <Fragment key={loc}>
                  {/* Location header row */}
                  <tr style={{ backgroundColor: color + '18' }}>
                    <td className={`sticky left-0 z-10 ${tdBase} font-semibold border-l-4`} style={{ color, borderLeftColor: color, backgroundColor: color + '18' }}>
                      {loc}
                    </td>
                    {displayDates.map(d => {
                      const e = entry(lt.daily, d)
                      return (
                        <Fragment key={d}>
                          <td className={`${numCell} border-l border-[#ede9fe] font-medium`} style={{ color }}>
                            {e.qty > 0 ? e.qty : ''}
                          </td>
                          <td className={`${numCell} font-medium`} style={{ color }}>
                            {e.rev > 0 ? `$${e.rev.toFixed(2)}` : ''}
                          </td>
                        </Fragment>
                      )
                    })}
                    <td className={`${numCell} border-l border-[#ede9fe] font-semibold`} style={{ color }}>{lt.totalQty}</td>
                    <td className={`${numCell} font-semibold`} style={{ color }}>${lt.totalRev.toFixed(2)}</td>
                  </tr>
                  {/* Machine rows */}
                  {byLocation[loc].map(m => (
                    <tr key={m.machine} className="hover:bg-[#faf5ff]">
                      <td className={`sticky left-0 z-10 bg-white ${tdBase} text-[#1e1b4b] pl-5`}>{m.machine}</td>
                      {displayDates.map(d => {
                        const e = entry(m.daily, d)
                        return (
                          <Fragment key={d}>
                            <td className={`${numCell} text-[#6b7280] border-l border-[#ede9fe]`}>
                              {e.qty > 0 ? e.qty : ''}
                            </td>
                            <td className={`${numCell} text-[#6b7280]`}>
                              {e.rev > 0 ? `$${e.rev.toFixed(2)}` : ''}
                            </td>
                          </Fragment>
                        )
                      })}
                      <td className={`${numCell} text-[#6b7280] border-l border-[#ede9fe]`}>{m.totalQty}</td>
                      <td className={`${numCell} text-[#6b7280]`}>${m.totalRev.toFixed(2)}</td>
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {/* Grand Total */}
            <tr className="bg-[#1e1b4b]">
              <td className="sticky left-0 z-10 bg-[#1e1b4b] py-2 px-3 text-white font-bold text-xs whitespace-nowrap">
                Grand Total
              </td>
              {displayDates.map(d => {
                const e = entry(grandTotal.daily, d)
                return (
                  <Fragment key={d}>
                    <td className="py-2 px-2 text-right text-white font-medium text-xs tabular-nums whitespace-nowrap border-l border-white/20">
                      {e.qty > 0 ? e.qty : ''}
                    </td>
                    <td className="py-2 px-2 text-right text-white font-medium text-xs tabular-nums whitespace-nowrap">
                      {e.rev > 0 ? `$${e.rev.toFixed(2)}` : ''}
                    </td>
                  </Fragment>
                )
              })}
              <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap border-l border-white/20">
                {grandTotal.totalQty}
              </td>
              <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap">
                ${grandTotal.totalRev.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
