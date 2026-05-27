'use client'

import { Fragment, useMemo } from 'react'
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
import { parseTransactionDate } from '@/lib/filter-utils'
import { chooseWeekBuckets, bucketTarget, type WeekBucket } from '@/lib/week-buckets'
import type { DailySalesData, Overrides, WeekRange } from '@/lib/types'
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

function toIsoFromMdY(mdY: string): string {
  const d = parseTransactionDate(mdY)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function makeId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WeeklySummary({ dailySales, overrides, preset }: Props) {
  const currency = useCurrency()
  const { isEditMode, draft, setDraft } = useEdit()
  const { dates, machines, locationTotals, grandTotal, kpiTarget } = dailySales

  const displayDates = preset === 'all' ? dates.slice(-14) : dates.slice()

  // When in edit mode and draft.weeks is empty, seed from auto buckets so the
  // user has rows to tweak. Auto seeding happens lazily on first edit action.
  const activeWeeks = isEditMode ? (draft.weeks ?? []) : (overrides.weeks ?? [])

  const buckets = useMemo(
    () => chooseWeekBuckets(displayDates, activeWeeks.length > 0 ? activeWeeks : undefined),
    [displayDates, activeWeeks],
  )

  if (displayDates.length === 0 || machines.length === 0 || buckets.length === 0) return null

  // Convert current visible buckets to explicit WeekRange list (used when seeding
  // from auto buckets the first time the user edits something).
  function bucketsToWeeks(): WeekRange[] {
    return buckets.map(b => {
      const ds = b.dates.length > 0 ? b.dates : []
      const first = ds[0] ? toIsoFromMdY(ds[0]) : todayIso()
      const last = ds.length > 0 ? toIsoFromMdY(ds[ds.length - 1]) : first
      return { id: b.key, startDate: first, endDate: last, label: b.label }
    })
  }

  function ensureDraftWeeks(): WeekRange[] {
    if ((draft.weeks ?? []).length > 0) return draft.weeks!
    return bucketsToWeeks()
  }

  function setWeeks(next: WeekRange[]) {
    setDraft(prev => ({ ...prev, weeks: next }))
  }

  function patchWeek(id: string, patch: Partial<WeekRange>) {
    const cur = ensureDraftWeeks()
    setWeeks(cur.map(w => w.id === id ? { ...w, ...patch } : w))
  }

  function addWeek() {
    const cur = ensureDraftWeeks()
    setWeeks([...cur, { id: makeId(), startDate: todayIso(), endDate: todayIso() }])
  }

  function removeWeek(id: string) {
    const cur = ensureDraftWeeks()
    setWeeks(cur.filter(w => w.id !== id))
  }

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
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-muted text-xs uppercase tracking-wider">Weekly KPI Summary</p>
          <span className="text-muted-strong text-xs">
            Target auto = {kpiTarget} × days (atau override per-week)
          </span>
        </div>
        {isEditMode && (
          <button
            type="button"
            onClick={addWeek}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:opacity-90"
          >
            + Add Week
          </button>
        )}
      </div>
      <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {buckets.map(wk => (
          <WeekCard
            key={wk.key}
            wk={wk}
            kpiTarget={kpiTarget}
            isEditMode={isEditMode}
            machinesByLoc={byLocation}
            locOrder={locOrder}
            locationTotals={locationTotals}
            grandTotalDaily={grandTotal.daily}
            currency={currency}
            machineCount={machines.length}
            onPatch={patchWeek}
            onRemove={removeWeek}
          />
        ))}
      </div>
    </div>
  )
}

// ─── single card ──────────────────────────────────────────────────

type CardProps = {
  wk: WeekBucket
  kpiTarget: number
  isEditMode: boolean
  machinesByLoc: Record<string, DailySalesData['machines']>
  locOrder: string[]
  locationTotals: DailySalesData['locationTotals']
  grandTotalDaily: Record<string, { qty: number; rev: number }>
  currency: 'USD' | 'KHR'
  machineCount: number
  onPatch: (id: string, patch: Partial<WeekRange>) => void
  onRemove: (id: string) => void
}

function WeekCard({
  wk, kpiTarget, isEditMode, machinesByLoc, locOrder, locationTotals,
  grandTotalDaily, currency, machineCount, onPatch, onRemove,
}: CardProps) {
  const target = bucketTarget(wk, kpiTarget)
  const grandQty = sumQty(grandTotalDaily, wk.dates)
  const grandRev = sumRev(grandTotalDaily, wk.dates)
  const grandTarget = target * machineCount

  // ISO start/end derived from bucket's existing dates (for date inputs).
  const startIso = wk.dates[0] ? toIsoFromMdY(wk.dates[0]) : ''
  const endIso = wk.dates.length > 0 ? toIsoFromMdY(wk.dates[wk.dates.length - 1]) : startIso

  return (
    <div className="bg-background border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-surface-hover border-b border-border flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex-1 min-w-0">
            {isEditMode ? (
              <input
                type="text"
                defaultValue={wk.label}
                onBlur={(e) => onPatch(wk.key, { label: e.target.value.trim() || undefined })}
                className="bg-background border border-accent rounded px-2 py-1 text-sm font-semibold text-foreground w-full"
                placeholder="Week label"
              />
            ) : (
              <div className="text-foreground text-sm font-semibold">{wk.label}</div>
            )}
            <div className="text-muted text-[10px] uppercase tracking-wider mt-1">
              {wk.dates.length} day{wk.dates.length === 1 ? '' : 's'} · target {target}/machine
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-foreground text-sm font-bold tabular-nums">{grandQty}</span>
            <span className="text-muted text-[10px]">/ {grandTarget}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${grandQty >= grandTarget ? 'bg-emerald-500/20 text-emerald-300' : 'bg-danger/20 text-danger'}`}>
              {grandQty >= grandTarget ? 'MET' : 'BELOW'}
            </span>
            {isEditMode && (
              <button
                type="button"
                onClick={() => onRemove(wk.key)}
                className="text-danger hover:opacity-80 text-xs px-1"
                title="Remove this week"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {isEditMode && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
            <label className="flex flex-col text-[10px] text-muted uppercase tracking-wider">
              Start
              <input
                type="date"
                value={startIso}
                onChange={(e) => onPatch(wk.key, { startDate: e.target.value })}
                className="mt-0.5 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col text-[10px] text-muted uppercase tracking-wider">
              End
              <input
                type="date"
                value={endIso}
                onChange={(e) => onPatch(wk.key, { endDate: e.target.value })}
                className="mt-0.5 bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col text-[10px] text-muted uppercase tracking-wider">
              Target/machine (auto if blank)
              <input
                type="number"
                min={0}
                step={1}
                defaultValue={wk.target ?? ''}
                onBlur={(e) => {
                  const v = e.target.value
                  onPatch(wk.key, { targetOverride: v === '' ? undefined : Number(v) })
                }}
                placeholder={`auto = ${kpiTarget}×${wk.dates.length} = ${kpiTarget * wk.dates.length}`}
                className="mt-0.5 bg-background border border-border rounded px-2 py-1 text-xs text-foreground tabular-nums focus:outline-none focus:border-accent"
              />
            </label>
          </div>
        )}
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
            const machinesInLoc = machinesByLoc[loc]
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
}
