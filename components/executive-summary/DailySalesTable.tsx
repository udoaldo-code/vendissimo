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

// Group dates into ISO-style buckets (Monday-start week).
function weekStartKey(dateStr: string): string {
  const d = parseTransactionDate(dateStr)
  const dow = d.getDay() // 0=Sun..6=Sat
  const offsetToMon = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetToMon)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

type WeekBucket = { key: string; label: string; dates: string[] }

function buildWeekBuckets(dates: string[]): WeekBucket[] {
  const grouped: Record<string, string[]> = {}
  const order: string[] = []
  for (const d of dates) {
    const key = weekStartKey(d)
    if (!grouped[key]) { grouped[key] = []; order.push(key) }
    grouped[key].push(d)
  }
  return order.map(key => {
    const ds = grouped[key]
    const start = parseTransactionDate(ds[0])
    const end = parseTransactionDate(ds[ds.length - 1])
    const startLbl = `${String(start.getDate()).padStart(2, '0')} ${start.toLocaleString('en-US', { month: 'short' })}`
    const endLbl = `${String(end.getDate()).padStart(2, '0')} ${end.toLocaleString('en-US', { month: 'short' })}`
    return { key, label: ds.length === 1 ? startLbl : `${startLbl}–${endLbl}`, dates: ds }
  })
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
  const weeklyTarget = kpiTarget * 7

  // Only highlight under-performers — green is omitted by request.
  function cellTint(qty: number): string {
    return qty > 0 && qty < kpiTarget ? 'bg-danger/15' : ''
  }
  function weekTint(qty: number): string {
    return qty > 0 && qty < weeklyTarget ? 'bg-danger/15' : ''
  }
  function cellTitle(qty: number, dateLabel: string): string {
    if (qty <= 0) return `${dateLabel} — no sale`
    return qty >= kpiTarget
      ? `${dateLabel} — Met (${qty} ≥ ${kpiTarget})`
      : `${dateLabel} — Below (${qty} < ${kpiTarget})`
  }
  function weekTitle(qty: number, weekLabel: string): string {
    if (qty <= 0) return `${weekLabel} — no sale`
    return qty >= weeklyTarget
      ? `${weekLabel} — Met (${qty} ≥ ${weeklyTarget})`
      : `${weekLabel} — Below (${qty} < ${weeklyTarget})`
  }

  const displayDates = preset === 'all' ? dates.slice(-14) : dates.slice()
  if (displayDates.length === 0 || machines.length === 0) return null

  const weekBuckets = buildWeekBuckets(displayDates)

  const locations: string[] = []
  const byLocation: Record<string, typeof machines> = {}
  for (const m of machines) {
    if (!byLocation[m.location]) { byLocation[m.location] = []; locations.push(m.location) }
    byLocation[m.location].push(m)
  }

  const tdBase = 'py-1.5 px-2 text-xs whitespace-nowrap border-b border-border'
  const numCell = `${tdBase} text-right tabular-nums`
  const stickyTd = 'py-1.5 px-2 text-xs border-b border-border min-w-[90px] md:min-w-[150px] max-w-[110px] md:max-w-[200px] break-words'
  const stickyStyle = { boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }

  function entry(daily: Record<string, { qty: number; rev: number }>, date: string) {
    const e = daily[date]
    return e ?? { qty: 0, rev: 0 }
  }

  function weekTotalQty(daily: Record<string, { qty: number; rev: number }>, weekDates: string[]) {
    let qty = 0
    for (const d of weekDates) qty += daily[d]?.qty ?? 0
    return qty
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-muted text-xs uppercase tracking-wider">Daily Sales by Machine</p>
          <span className="text-muted-strong text-xs">
            KPI Daily: ≥ {kpiTarget} units/day · Weekly: ≥ {weeklyTarget} units/week
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block w-3 h-3 rounded-sm bg-danger/30 border border-danger/50" />
            Below target
          </span>
        </div>
        {preset === 'all' && (
          <span className="text-muted text-xs">Last 14 days shown · Totals reflect full period</span>
        )}
      </div>
      <div className="overflow-x-auto w-full">
        <table className="text-xs border-collapse" style={{ width: '100%' }}>
          <thead>
            {/* Row 1: day names + weekly group header + TOTAL */}
            <tr className="bg-surface-hover">
              <th className={`sticky left-0 z-10 bg-surface-hover text-left text-muted font-medium ${stickyTd}`} style={stickyStyle}>
                Name of Machine
              </th>
              {weekBuckets.map(wk => (
                <Fragment key={wk.key}>
                  {wk.dates.map(d => (
                    <th key={d} colSpan={2} className="py-1.5 px-2 text-center text-muted-strong font-medium border-b border-border border-l border-border">
                      {fmtDateHeader(d).day}
                    </th>
                  ))}
                  <th className="py-1.5 px-2 text-center text-accent-pink font-semibold border-b border-border border-l border-border whitespace-nowrap">
                    Wk
                  </th>
                </Fragment>
              ))}
              <th colSpan={2} className="py-1.5 px-2 text-center text-accent font-semibold border-b border-border border-l border-border">
                TOTAL
              </th>
              <th className="border-b border-border" style={{ width: '100%' }} />
            </tr>
            {/* Row 2: dates + week range labels */}
            <tr className="bg-surface-hover">
              <th className="sticky left-0 z-10 bg-surface-hover border-b border-border" style={stickyStyle} />
              {weekBuckets.map(wk => (
                <Fragment key={wk.key}>
                  {wk.dates.map(d => (
                    <th key={d} colSpan={2} className="py-1 px-2 text-center text-muted-strong font-normal border-b border-border border-l border-border">
                      {fmtDateHeader(d).date}
                    </th>
                  ))}
                  <th className="py-1 px-2 text-center text-accent-pink font-normal border-b border-border border-l border-border whitespace-nowrap">
                    {wk.label}
                  </th>
                </Fragment>
              ))}
              <th colSpan={2} className="border-b border-border border-l border-border" />
              <th className="border-b border-border" />
            </tr>
            {/* Row 3: Qty / Rev sub-headers */}
            <tr className="bg-surface-hover">
              <th className="sticky left-0 z-10 bg-surface-hover border-b border-border" style={stickyStyle} />
              {weekBuckets.map(wk => (
                <Fragment key={wk.key}>
                  {wk.dates.map(d => (
                    <Fragment key={d}>
                      <th className="py-1 px-2 text-right text-muted font-medium border-b border-border border-l border-border whitespace-nowrap">Qty</th>
                      <th className="py-1 px-2 text-right text-muted font-medium border-b border-border whitespace-nowrap">Rev</th>
                    </Fragment>
                  ))}
                  <th className="py-1 px-2 text-right text-accent-pink font-semibold border-b border-border border-l border-border whitespace-nowrap">Qty</th>
                </Fragment>
              ))}
              <th className="py-1 px-2 text-right text-accent font-semibold border-b border-border border-l border-border whitespace-nowrap">Qty</th>
              <th className="py-1 px-2 text-right text-accent font-semibold border-b border-border whitespace-nowrap">Rev</th>
              <th className="border-b border-border" />
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
                    {weekBuckets.map(wk => {
                      const wkQty = weekTotalQty(lt.daily, wk.dates)
                      return (
                        <Fragment key={wk.key}>
                          {wk.dates.map(d => {
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
                          <td className={`${numCell} border-l border-border font-semibold`} style={{ color }}>
                            {wkQty}
                          </td>
                        </Fragment>
                      )
                    })}
                    <td className={`${numCell} border-l border-border font-semibold`} style={{ color }}>{lt.totalQty}</td>
                    <td className={`${numCell} font-semibold`} style={{ color }}>{formatMoney(lt.totalRev, currency)}</td>
                    <td className="border-b border-border" />
                  </tr>
                  {/* Machine rows */}
                  {byLocation[loc].map(m => (
                    <tr key={m.machine} className="hover:bg-surface-hover">
                      <td className={`sticky left-0 z-10 bg-card ${stickyTd} text-foreground pl-5`} style={stickyStyle}>{m.machine}</td>
                      {weekBuckets.map(wk => {
                        const wkQty = weekTotalQty(m.daily, wk.dates)
                        const wkTintCls = weekTint(wkQty)
                        const wkTip = weekTitle(wkQty, wk.label)
                        const wkDot = wkQty <= 0 ? 'bg-muted' : wkQty >= weeklyTarget ? 'bg-emerald-400' : 'bg-danger'
                        return (
                          <Fragment key={wk.key}>
                            {wk.dates.map(d => {
                              const e = entry(m.daily, d)
                              const tint = cellTint(e.qty)
                              const title = cellTitle(e.qty, fmtDateHeader(d).date)
                              const status: 'met' | 'below' | 'idle' =
                                e.qty <= 0 ? 'idle' : e.qty >= kpiTarget ? 'met' : 'below'
                              const dotClass =
                                status === 'met' ? 'bg-emerald-400'
                                : status === 'below' ? 'bg-danger'
                                : 'bg-muted'
                              const tooltip = (
                                <div
                                  role="tooltip"
                                  className="pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2.5 py-1.5 rounded-md bg-card border border-border shadow-lg text-foreground text-xs whitespace-nowrap opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 transition duration-100"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                    <span>{title}</span>
                                  </div>
                                </div>
                              )
                              return (
                                <Fragment key={d}>
                                  <td className={`${numCell} text-muted-strong border-l border-border cursor-help relative group/cell ${tint}`}>
                                    {e.qty}
                                    {tooltip}
                                  </td>
                                  <td className={`${numCell} text-muted-strong cursor-help relative group/cell ${tint}`}>
                                    {formatMoney(e.rev, currency)}
                                    {tooltip}
                                  </td>
                                </Fragment>
                              )
                            })}
                            <td className={`${numCell} text-foreground border-l border-border font-semibold cursor-help relative group/cell ${wkTintCls}`}>
                              {wkQty}
                              <div
                                role="tooltip"
                                className="pointer-events-none absolute z-50 bottom-full right-0 mb-1 px-2.5 py-1.5 rounded-md bg-card border border-border shadow-lg text-foreground text-xs whitespace-nowrap opacity-0 scale-95 group-hover/cell:opacity-100 group-hover/cell:scale-100 transition duration-100"
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${wkDot}`} />
                                  <span>{wkTip}</span>
                                </div>
                              </div>
                            </td>
                          </Fragment>
                        )
                      })}
                      <td className={`${numCell} text-muted-strong border-l border-border font-semibold`}>{m.totalQty}</td>
                      <td className={`${numCell} text-muted-strong font-semibold`}>{formatMoney(m.totalRev, currency)}</td>
                      <td className="border-b border-border" />
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {/* Grand Total */}
            <tr className="bg-[#1e1b4b]">
              <td className={`sticky left-0 z-10 bg-[#1e1b4b] ${stickyTd} text-white font-bold`} style={{ boxShadow: '2px 0 4px rgba(0,0,0,0.2)' }}>
                Grand Total
              </td>
              {weekBuckets.map(wk => {
                const wkQty = weekTotalQty(grandTotal.daily, wk.dates)
                return (
                  <Fragment key={wk.key}>
                    {wk.dates.map(d => {
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
                    <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap border-l border-white/20">
                      {wkQty}
                    </td>
                  </Fragment>
                )
              })}
              <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap border-l border-white/20">
                {grandTotal.totalQty}
              </td>
              <td className="py-2 px-2 text-right text-[#a78bfa] font-bold text-xs tabular-nums whitespace-nowrap">
                {formatMoney(grandTotal.totalRev, currency)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
