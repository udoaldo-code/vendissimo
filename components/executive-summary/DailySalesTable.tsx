'use client'

import { Fragment } from 'react'
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
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
const LOCATION_BG: Record<string, string> = {
  Airport: '#fee2e2',
  Hospital: '#dbeafe',
}
function locationColor(loc: string): string {
  return LOCATION_COLORS[loc] ?? '#7c3aed'
}
function locationBg(loc: string): string {
  return LOCATION_BG[loc] ?? '#f5f3ff'
}

type Props = {
  dailySales: DailySalesData
  preset: DatePreset
}

export function DailySalesTable({ dailySales, preset }: Props) {
  const currency = useCurrency()
  const { dates, machines, locationTotals, grandTotal, kpiTarget } = dailySales

  function cellTint(qty: number): string {
    if (qty <= 0) return ''
    return qty >= kpiTarget ? 'bg-emerald-500/15' : 'bg-danger/15'
  }

  const displayDates = preset === 'all' ? dates.slice(-14) : dates.slice()

  if (displayDates.length === 0 || machines.length === 0) return null

  const locations: string[] = []
  const byLocation: Record<string, typeof machines> = {}
  for (const m of machines) {
    if (!byLocation[m.location]) { byLocation[m.location] = []; locations.push(m.location) }
    byLocation[m.location].push(m)
  }

  const tdBase = 'py-1.5 px-2 text-xs whitespace-nowrap border-b border-border'
  const numCell = `${tdBase} text-right tabular-nums`
  // Sticky name column: wraps on mobile, fixed on desktop
  const stickyTd = 'py-1.5 px-2 text-xs border-b border-border min-w-[90px] md:min-w-[150px] max-w-[110px] md:max-w-[200px] break-words'
  const stickyStyle = { boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }

  function entry(daily: Record<string, { qty: number; rev: number }>, date: string) {
    const e = daily[date]
    return e ?? { qty: 0, rev: 0 }
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-muted text-xs uppercase tracking-wider">Daily Sales by Machine</p>
        <span className="text-muted text-xs">
          {preset === 'all' && 'Last 14 days shown · Totals reflect full period · '}
          KPI target ≥{kpiTarget} units/day
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead>
            {/* Row 1: day names */}
            <tr className="bg-surface-hover">
              <th className={`sticky left-0 z-10 bg-surface-hover text-left text-muted font-medium ${stickyTd}`} style={stickyStyle}>
                Name of Machine
              </th>
              <th colSpan={2} className="py-1.5 px-2 text-center text-accent font-semibold border-b border-border border-l border-border">
                TOTAL
              </th>
              <th colSpan={3} className="py-1.5 px-2 text-center text-accent-pink font-semibold border-b border-border border-l border-border">
                KPI
              </th>
              {displayDates.map(d => (
                <th key={d} colSpan={2} className="py-1.5 px-2 text-center text-muted-strong font-medium border-b border-border border-l border-border">
                  {fmtDateHeader(d).day}
                </th>
              ))}
            </tr>
            {/* Row 2: dates */}
            <tr className="bg-surface-hover">
              <th className="sticky left-0 z-10 bg-surface-hover border-b border-border" style={stickyStyle} />
              <th colSpan={2} className="border-b border-border border-l border-border" />
              <th colSpan={3} className="border-b border-border border-l border-border" />
              {displayDates.map(d => (
                <th key={d} colSpan={2} className="py-1 px-2 text-center text-muted-strong font-normal border-b border-border border-l border-border">
                  {fmtDateHeader(d).date}
                </th>
              ))}
            </tr>
            {/* Row 3: Qty / Rev sub-headers */}
            <tr className="bg-surface-hover">
              <th className="sticky left-0 z-10 bg-surface-hover border-b border-border" style={stickyStyle} />
              <th className="py-1 px-2 text-right text-accent font-semibold border-b border-border border-l border-border whitespace-nowrap">Qty</th>
              <th className="py-1 px-2 text-right text-accent font-semibold border-b border-border whitespace-nowrap">Rev</th>
              <th className="py-1 px-2 text-right text-accent-pink font-semibold border-b border-border border-l border-border whitespace-nowrap">Active</th>
              <th className="py-1 px-2 text-right text-accent-pink font-semibold border-b border-border whitespace-nowrap">Met</th>
              <th className="py-1 px-2 text-center text-accent-pink font-semibold border-b border-border whitespace-nowrap">Status</th>
              {displayDates.map(d => (
                <Fragment key={d}>
                  <th className="py-1 px-2 text-right text-muted font-medium border-b border-border border-l border-border whitespace-nowrap">Qty</th>
                  <th className="py-1 px-2 text-right text-muted font-medium border-b border-border whitespace-nowrap">Rev</th>
                </Fragment>
              ))}
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
                    <td className={`sticky left-0 z-10 ${stickyTd} font-semibold border-l-4`} style={{ color, borderLeftColor: color, backgroundColor: locationBg(loc), boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
                      {loc}
                    </td>
                    <td className={`${numCell} border-l border-border font-semibold`} style={{ color }}>{lt.totalQty}</td>
                    <td className={`${numCell} font-semibold`} style={{ color }}>{formatMoney(lt.totalRev, currency)}</td>
                    <td className={`${numCell} border-l border-border`} />
                    <td className={numCell} />
                    <td className={numCell} />
                    {displayDates.map(d => {
                      const e = entry(lt.daily, d)
                      return (
                        <Fragment key={d}>
                          <td className={`${numCell} border-l border-border font-medium`} style={{ color }}>
                            {e.qty}
                          </td>
                          <td className={`${numCell} font-medium`} style={{ color }}>
                            {formatMoney(e.rev, currency)}
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                  {/* Machine rows */}
                  {byLocation[loc].map(m => {
                    const statusBadge = m.kpiStatus === 'met'
                      ? <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-xs font-semibold">Met</span>
                      : m.kpiStatus === 'below'
                        ? <span className="bg-danger/20 text-danger px-2 py-0.5 rounded text-xs font-semibold">Below</span>
                        : <span className="text-muted text-xs">Idle</span>
                    return (
                    <tr key={m.machine} className="hover:bg-surface-hover">
                      <td className={`sticky left-0 z-10 bg-card ${stickyTd} text-foreground pl-5`} style={stickyStyle}>{m.machine}</td>
                      <td className={`${numCell} text-muted-strong border-l border-border`}>{m.totalQty}</td>
                      <td className={`${numCell} text-muted-strong`}>{formatMoney(m.totalRev, currency)}</td>
                      <td className={`${numCell} text-foreground border-l border-border font-medium`}>{m.dayActive}</td>
                      <td className={`${numCell} text-foreground font-medium`}>{m.dayMet}</td>
                      <td className={`${tdBase} text-center`}>{statusBadge}</td>
                      {displayDates.map(d => {
                        const e = entry(m.daily, d)
                        const tint = cellTint(e.qty)
                        return (
                          <Fragment key={d}>
                            <td className={`${numCell} text-muted-strong border-l border-border ${tint}`}>
                              {e.qty}
                            </td>
                            <td className={`${numCell} text-muted-strong ${tint}`}>
                              {formatMoney(e.rev, currency)}
                            </td>
                          </Fragment>
                        )
                      })}
                    </tr>
                    )
                  })}
                </Fragment>
              )
            })}
            {/* Grand Total */}
            <tr className="bg-[#1e1b4b]">
              <td className={`sticky left-0 z-10 bg-[#1e1b4b] ${stickyTd} text-white font-bold`} style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.2)' }}>
                Grand Total
              </td>
              <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap border-l border-white/20">
                {grandTotal.totalQty}
              </td>
              <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap">
                {formatMoney(grandTotal.totalRev, currency)}
              </td>
              <td className="py-2 px-2 border-l border-white/20" />
              <td className="py-2 px-2" />
              <td className="py-2 px-2" />
              {displayDates.map(d => {
                const e = entry(grandTotal.daily, d)
                return (
                  <Fragment key={d}>
                    <td className="py-2 px-2 text-right text-white font-medium text-xs tabular-nums whitespace-nowrap border-l border-white/20">
                      {e.qty}
                    </td>
                    <td className="py-2 px-2 text-right text-white font-medium text-xs tabular-nums whitespace-nowrap">
                      {formatMoney(e.rev, currency)}
                    </td>
                  </Fragment>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
