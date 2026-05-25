'use client'

import { Fragment, useMemo } from 'react'
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
import type { DailySalesData, DailySalesMachineRow, Overrides } from '@/lib/types'
import type { DatePreset } from './DateFilter'
import { parseTransactionDate } from '@/lib/filter-utils'
import { useEdit } from '@/components/edit-mode/EditContext'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

function weekStartKey(dateStr: string): string {
  const d = parseTransactionDate(dateStr)
  const dow = d.getDay()
  const offsetToMon = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetToMon)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

type WeekBucket = { key: string; label: string; dates: string[] }

function weekOfMonthLabel(mondayKey: string): string {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const weekNum = Math.ceil(monday.getDate() / 7)
  const monthName = monday.toLocaleString('en-US', { month: 'short' })
  return `Week ${weekNum} ${monthName}`
}

function buildWeekBuckets(dates: string[]): WeekBucket[] {
  const grouped: Record<string, string[]> = {}
  const order: string[] = []
  for (const d of dates) {
    const key = weekStartKey(d)
    if (!grouped[key]) { grouped[key] = []; order.push(key) }
    grouped[key].push(d)
  }
  return order.map(key => ({ key, label: weekOfMonthLabel(key), dates: grouped[key] }))
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

// Apply override locationKey to a machine row (returns rebound row with
// override's locationKey as the display "location" so cross-loc drag is
// reflected optimistically). machine display name uses override too.
// In edit mode reflect machine.name + machine.locationKey overrides only.
// Location LABEL is rendered via locationDisplay() so the underlying key
// (used by drag-drop + grouping) stays stable while label is editable.
function applyDraftToRow(m: DailySalesMachineRow, draft: Overrides): DailySalesMachineRow {
  const ov = draft.machines[m.deviceId]
  if (!ov) return m
  return {
    ...m,
    machine: ov.name ?? m.machine,
    location: ov.locationKey ?? m.location,
  }
}

export function DailySalesTable({ dailySales, preset }: Props) {
  const currency = useCurrency()
  const { dates, machines, locationTotals, grandTotal, kpiTarget } = dailySales
  const weeklyTarget = kpiTarget * 7
  const { isEditMode, draft, setDraft } = useEdit()

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Build location grouping. In edit mode honor draft overrides so cross-loc
  // drags + intra-loc reorders feel instant.
  const { locationOrder, byLocation } = useMemo(() => {
    const src = isEditMode ? machines.map(m => applyDraftToRow(m, draft)) : machines
    const grouped: Record<string, DailySalesMachineRow[]> = {}
    const order: string[] = []
    for (const m of src) {
      if (!grouped[m.location]) { grouped[m.location] = []; order.push(m.location) }
      grouped[m.location].push(m)
    }
    if (isEditMode) {
      for (const loc of order) {
        grouped[loc].sort((a, b) => {
          const ao = draft.machines[a.deviceId]?.order ?? Number.MAX_SAFE_INTEGER
          const bo = draft.machines[b.deviceId]?.order ?? Number.MAX_SAFE_INTEGER
          if (ao !== bo) return ao - bo
          return a.machine.localeCompare(b.machine)
        })
      }
    }
    return { locationOrder: order, byLocation: grouped }
  }, [machines, draft, isEditMode])

  if (displayDates.length === 0 || machines.length === 0) return null

  const weekBuckets = buildWeekBuckets(displayDates)

  const tdBase = 'py-1.5 px-2 text-xs whitespace-nowrap border-b border-border'
  const numCell = `${tdBase} text-right tabular-nums`
  const stickyTd = 'py-1.5 px-2 text-xs border-b border-border min-w-[90px] md:min-w-[150px] max-w-[160px] md:max-w-[260px] break-words'
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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const activeData = active.data.current as { locationKey?: string; type?: string } | undefined
    const overData = over.data.current as { locationKey?: string; type?: string } | undefined
    if (!activeData?.locationKey) return

    const sourceLoc = activeData.locationKey
    const isDropOnLocEnd = overData?.type === 'location-end'
    const targetLoc = isDropOnLocEnd ? overData!.locationKey! : (overData?.locationKey ?? sourceLoc)

    const sourceIds = byLocation[sourceLoc]?.map(m => m.deviceId) ?? []
    const targetIds = sourceLoc === targetLoc ? sourceIds : (byLocation[targetLoc]?.map(m => m.deviceId) ?? [])

    const fromIdx = sourceIds.indexOf(active.id as string)
    let toIdx: number
    if (isDropOnLocEnd) {
      toIdx = targetIds.length
    } else {
      toIdx = targetIds.indexOf(over.id as string)
      if (toIdx < 0) return
    }
    if (fromIdx < 0) return

    setDraft(prev => {
      const nextMachines = { ...prev.machines }
      if (sourceLoc === targetLoc) {
        const reordered = arrayMove(sourceIds, fromIdx, toIdx)
        reordered.forEach((id, i) => {
          nextMachines[id] = { ...(nextMachines[id] ?? {}), order: i, locationKey: sourceLoc }
        })
      } else {
        const newSource = [...sourceIds]; newSource.splice(fromIdx, 1)
        const newTarget = [...targetIds]; newTarget.splice(toIdx, 0, active.id as string)
        newSource.forEach((id, i) => {
          nextMachines[id] = { ...(nextMachines[id] ?? {}), order: i, locationKey: sourceLoc }
        })
        newTarget.forEach((id, i) => {
          nextMachines[id] = { ...(nextMachines[id] ?? {}), order: i, locationKey: targetLoc }
        })
      }
      return { ...prev, machines: nextMachines }
    })
  }

  function renameMachine(deviceId: string, newName: string) {
    setDraft(prev => ({
      ...prev,
      machines: { ...prev.machines, [deviceId]: { ...(prev.machines[deviceId] ?? {}), name: newName } },
    }))
  }

  function renameLocation(locKey: string, newLabel: string) {
    setDraft(prev => ({
      ...prev,
      locations: { ...prev.locations, [locKey]: { ...(prev.locations[locKey] ?? {}), label: newLabel } },
    }))
  }

  // Pretty label for a location key — picks draft override if user is editing.
  function locationDisplay(locKey: string): string {
    return draft.locations[locKey]?.label ?? locKey
  }

  // Render a single machine row (used for both edit + non-edit modes).
  const renderMachineRow = (m: DailySalesMachineRow, locKey: string, dragHandle?: { setActivatorNodeRef: (el: HTMLElement | null) => void; listeners: Record<string, unknown> | undefined }) => (
    <>
      {isEditMode ? (
        <td className={`sticky left-0 z-10 bg-card ${stickyTd} text-foreground`} style={stickyStyle}>
          <div className="flex items-center gap-1.5">
            <span
              ref={dragHandle?.setActivatorNodeRef}
              {...(dragHandle?.listeners ?? {})}
              className="cursor-grab text-muted hover:text-accent select-none px-1 leading-none"
              title="Drag to reorder or move between locations"
            >
              ⠿
            </span>
            <input
              type="text"
              defaultValue={m.machine}
              onPointerDown={e => e.stopPropagation()}
              onBlur={(e) => renameMachine(m.deviceId, e.target.value.trim())}
              className="flex-1 bg-background border border-accent rounded px-1.5 py-0.5 text-xs w-full min-w-0"
            />
          </div>
        </td>
      ) : (
        <td className={`sticky left-0 z-10 bg-card ${stickyTd} text-foreground pl-5`} style={stickyStyle}>{m.machine}</td>
      )}
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
            <td className={`py-1.5 px-3 text-center text-sm font-bold tabular-nums whitespace-nowrap border-b border-border border-l-2 border-accent-pink/40 text-foreground cursor-help relative group/cell ${wkTintCls}`}>
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
    </>
  )

  const locationGroups = locationOrder.map(loc => {
    const lt = locationTotals[loc] ?? { daily: {}, totalQty: 0, totalRev: 0 }
    const color = locationColor(loc)
    return (
      <Fragment key={loc}>
        {/* Location header */}
        <tr style={{ backgroundColor: color + '18' }}>
          <td className={`sticky left-0 z-10 ${stickyTd} font-semibold border-l-4`} style={{ color, borderLeftColor: color, backgroundColor: locationBg(loc), boxShadow: '2px 0 4px rgba(0,0,0,0.06)' }}>
            {isEditMode ? (
              <input
                type="text"
                defaultValue={locationDisplay(loc)}
                onBlur={(e) => renameLocation(loc, e.target.value.trim())}
                className="bg-background border border-accent rounded px-1.5 py-0.5 text-xs font-semibold w-full"
                style={{ color }}
                title="Rename location (label only — does not move machines)"
              />
            ) : (
              locationDisplay(loc)
            )}
          </td>
          {weekBuckets.map(wk => {
            const wkQty = weekTotalQty(lt.daily, wk.dates)
            return (
              <Fragment key={wk.key}>
                {wk.dates.map(d => {
                  const e = entry(lt.daily, d)
                  return (
                    <Fragment key={d}>
                      <td className={`${numCell} border-l border-border font-medium`} style={{ color }}>{e.qty}</td>
                      <td className={`${numCell} font-medium`} style={{ color }}>{formatMoney(e.rev, currency)}</td>
                    </Fragment>
                  )
                })}
                <td className={`py-1.5 px-3 text-center text-sm font-bold tabular-nums whitespace-nowrap border-b border-border border-l-2 border-accent-pink/40`} style={{ color }}>
                  {wkQty}
                </td>
              </Fragment>
            )
          })}
          <td className={`${numCell} border-l border-border font-semibold`} style={{ color }}>{lt.totalQty}</td>
          <td className={`${numCell} font-semibold`} style={{ color }}>{formatMoney(lt.totalRev, currency)}</td>
          <td className="border-b border-border" />
        </tr>

        {/* Machine rows: sortable when editing */}
        {isEditMode ? (
          <SortableContext items={byLocation[loc].map(m => m.deviceId)} strategy={verticalListSortingStrategy}>
            {byLocation[loc].map(m => (
              <SortableMachineRow key={m.deviceId} deviceId={m.deviceId} locationKey={loc}>
                {(handle) => renderMachineRow(m, loc, handle)}
              </SortableMachineRow>
            ))}
            <LocationDropTarget locationKey={loc} />
          </SortableContext>
        ) : (
          byLocation[loc].map(m => (
            <tr key={m.deviceId} className="hover:bg-surface-hover">
              {renderMachineRow(m, loc)}
            </tr>
          ))
        )}
      </Fragment>
    )
  })

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
                  <th className="py-1.5 px-3 text-center text-accent-pink font-bold text-sm border-b border-border border-l-2 border-accent-pink/40 whitespace-nowrap min-w-[110px]">
                    {wk.label}
                  </th>
                </Fragment>
              ))}
              <th colSpan={2} className="py-1.5 px-2 text-center text-accent font-semibold border-b border-border border-l border-border">
                TOTAL
              </th>
              <th className="border-b border-border" style={{ width: '100%' }} />
            </tr>
            <tr className="bg-surface-hover">
              <th className="sticky left-0 z-10 bg-surface-hover border-b border-border" style={stickyStyle} />
              {weekBuckets.map(wk => (
                <Fragment key={wk.key}>
                  {wk.dates.map(d => (
                    <th key={d} colSpan={2} className="py-1 px-2 text-center text-muted-strong font-normal border-b border-border border-l border-border">
                      {fmtDateHeader(d).date}
                    </th>
                  ))}
                  <th className="py-1 px-3 text-center text-accent-pink font-semibold text-sm border-b border-border border-l-2 border-accent-pink/40 whitespace-nowrap">
                    KPI/Target
                  </th>
                </Fragment>
              ))}
              <th colSpan={2} className="border-b border-border border-l border-border" />
              <th className="border-b border-border" />
            </tr>
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
                  <th className="py-1 px-3 text-center text-accent-pink font-bold text-sm border-b border-border border-l-2 border-accent-pink/40 whitespace-nowrap">QTY</th>
                </Fragment>
              ))}
              <th className="py-1 px-2 text-right text-accent font-semibold border-b border-border border-l border-border whitespace-nowrap">Qty</th>
              <th className="py-1 px-2 text-right text-accent font-semibold border-b border-border whitespace-nowrap">Rev</th>
              <th className="border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {isEditMode ? (
              <DndContextWrapper sensors={sensors} onDragEnd={handleDragEnd}>
                {locationGroups}
              </DndContextWrapper>
            ) : (
              locationGroups
            )}
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
                    <td className="py-2 px-3 text-center text-[#a78bfa] font-bold text-sm tabular-nums whitespace-nowrap border-l-2 border-accent-pink/40">
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

// ─── DnD helpers ──────────────────────────────────────────────────

function DndContextWrapper({
  sensors, onDragEnd, children,
}: {
  sensors: ReturnType<typeof useSensors>
  onDragEnd: (e: DragEndEvent) => void
  children: React.ReactNode
}) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  )
}

function SortableMachineRow({
  deviceId, locationKey, children,
}: {
  deviceId: string
  locationKey: string
  children: (handle: { setActivatorNodeRef: (el: HTMLElement | null) => void; listeners: Record<string, unknown> | undefined }) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: deviceId,
    data: { locationKey, type: 'machine' },
  })
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      className="hover:bg-surface-hover"
    >
      {children({ setActivatorNodeRef, listeners: listeners as Record<string, unknown> | undefined })}
    </tr>
  )
}

function LocationDropTarget({ locationKey }: { locationKey: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `loc-drop:${locationKey}`,
    data: { locationKey, type: 'location-end' },
  })
  return (
    <tr ref={setNodeRef} className={isOver ? 'bg-accent/10' : ''}>
      <td colSpan={99} className="h-1 p-0" />
    </tr>
  )
}
