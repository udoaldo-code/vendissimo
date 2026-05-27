'use client'

import { Fragment, useMemo } from 'react'
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
import { chooseWeekBuckets, bucketTarget } from '@/lib/week-buckets'
import type { DailySalesData, Overrides } from '@/lib/types'
import type { DatePreset } from './DateFilter'
import { useEdit } from '@/components/edit-mode/EditContext'

type Props = {
  dailySales: DailySalesData
  overrides: Overrides
  preset: DatePreset
}

function sumQty(daily: Record<string, { qty: number; rev: number }>, dates: string[]): number {
  let s = 0
  for (const d of dates) s += daily[d]?.qty ?? 0
  return s
}

function sumRev(daily: Record<string, { qty: number; rev: number }>, dates: string[]): number {
  let s = 0
  for (const d of dates) s += daily[d]?.rev ?? 0
  return s
}

export function WeeklySummary({ dailySales, overrides, preset }: Props) {
  const currency = useCurrency()
  const { isEditMode, draft } = useEdit()
  const { dates, machines, locationTotals, grandTotal, kpiTarget } = dailySales

  const displayDates = preset === 'all' ? dates.slice(-14) : dates.slice()
  const activeWeeks = isEditMode ? draft.weeks : overrides.weeks

  const buckets = useMemo(() => chooseWeekBuckets(displayDates, activeWeeks), [displayDates, activeWeeks])

  if (displayDates.length === 0 || machines.length === 0 || buckets.length === 0) return null

  // Group machines by location for nested display
  const locOrder: string[] = []
  const byLocation: Record<string, typeof machines> = {}
  for (const m of machines) {
    if (!byLocation[m.location]) { byLocation[m.location] = []; locOrder.push(m.location) }
    byLocation[m.location].push(m)
  }

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <p className="text-muted text-xs uppercase tracking-wider">Weekly KPI Summary</p>
        <span className="text-muted-strong text-xs">
          Target = override OR auto ({kpiTarget} × days)
        </span>
      </div>
      <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {buckets.map(wk => {
          const target = bucketTarget(wk, kpiTarget)
          const grandQty = sumQty(grandTotal.daily, wk.dates)
          const grandRev = sumRev(grandTotal.daily, wk.dates)
          // Grand target = target × machine count (per-machine target × machines)
          const grandTarget = target * machines.length

          return (
            <div key={wk.key} className="bg-background border border-border rounded-md overflow-hidden">
              <div className="px-3 py-2 bg-surface-hover border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-foreground text-sm font-semibold">{wk.label}</div>
                  <div className="text-muted text-[10px] uppercase tracking-wider">
                    {wk.dates.length} day{wk.dates.length === 1 ? '' : 's'} · target {target}/machine
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground text-sm font-bold tabular-nums">{grandQty}</span>
                  <span className="text-muted text-[10px]">/ {grandTarget}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${grandQty >= grandTarget ? 'bg-emerald-500/20 text-emerald-300' : 'bg-danger/20 text-danger'}`}>
                    {grandQty >= grandTarget ? 'MET' : 'BELOW'}
                  </span>
                </div>
              </div>

              <table className="w-full text-xs">
                <thead className="bg-surface-hover/50">
                  <tr>
                    <th className="text-left text-muted font-medium py-1.5 px-3">Machine</th>
                    <th className="text-right text-muted font-medium py-1.5 px-3">Qty</th>
                    <th className="text-right text-muted font-medium py-1.5 px-3">Target</th>
                    <th className="text-right text-muted font-medium py-1.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {locOrder.map(loc => {
                    const lt = locationTotals[loc]
                    if (!lt) return null
                    const locQty = sumQty(lt.daily, wk.dates)
                    const machinesInLoc = byLocation[loc]
                    return (
                      <Fragment key={`${wk.key}-${loc}`}>
                        <tr className="bg-surface-hover/30">
                          <td className="py-1 px-3 text-muted-strong font-semibold text-[11px] uppercase tracking-wider" colSpan={2}>{loc}</td>
                          <td className="py-1 px-3 text-right text-muted-strong font-semibold tabular-nums" colSpan={2}>{locQty}</td>
                        </tr>
                        {machinesInLoc.map(m => {
                          const qty = sumQty(m.daily, wk.dates)
                          const met = qty >= target
                          const dotClass = qty <= 0 ? 'bg-muted' : met ? 'bg-emerald-400' : 'bg-danger'
                          return (
                            <tr key={`${wk.key}-${m.deviceId}`} className="border-t border-border">
                              <td className="py-1.5 px-3 text-foreground truncate max-w-[200px]" title={m.machine}>{m.machine}</td>
                              <td className={`py-1.5 px-3 text-right tabular-nums font-medium ${qty < target ? 'text-danger' : 'text-foreground'}`}>{qty}</td>
                              <td className="py-1.5 px-3 text-right text-muted tabular-nums">{target}</td>
                              <td className="py-1.5 px-3 text-right">
                                <span className="inline-flex items-center gap-1">
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass}`} />
                                  <span className={`text-[10px] font-semibold ${met ? 'text-emerald-300' : qty <= 0 ? 'text-muted' : 'text-danger'}`}>
                                    {qty <= 0 ? 'IDLE' : met ? 'MET' : 'BELOW'}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                  <tr className="bg-[#1e1b4b]">
                    <td className="py-1.5 px-3 text-white font-bold">Total</td>
                    <td className="py-1.5 px-3 text-right text-[#a78bfa] font-bold tabular-nums">{grandQty}</td>
                    <td className="py-1.5 px-3 text-right text-white/70 tabular-nums">{grandTarget}</td>
                    <td className="py-1.5 px-3 text-right text-[#a78bfa] font-bold">{formatMoney(grandRev, currency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </div>
  )
}
