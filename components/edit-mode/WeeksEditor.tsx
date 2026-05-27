'use client'

import { useEdit } from './EditContext'
import type { WeekRange } from '@/lib/types'

function makeId(): string {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function defaultStart(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultEnd(): string {
  const d = new Date()
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

export function WeeksEditor() {
  const { isEditMode, draft, setDraft } = useEdit()
  if (!isEditMode) return null

  const weeks = draft.weeks ?? []

  function setWeeks(next: WeekRange[]) {
    setDraft(prev => ({ ...prev, weeks: next }))
  }

  function addWeek() {
    setWeeks([...weeks, { id: makeId(), startDate: defaultStart(), endDate: defaultEnd() }])
  }

  function removeWeek(id: string) {
    setWeeks(weeks.filter(w => w.id !== id))
  }

  function updateWeek(id: string, patch: Partial<WeekRange>) {
    setWeeks(weeks.map(w => w.id === id ? { ...w, ...patch } : w))
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-foreground text-sm font-semibold">Weekly KPI Periods</h3>
        <button
          type="button"
          onClick={addWeek}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:opacity-90"
        >
          + Add Week
        </button>
      </div>

      {weeks.length === 0 ? (
        <p className="text-muted text-xs">
          Belum ada period custom — sistem pakai Monday-auto bucketing. Klik <strong>+ Add Week</strong> untuk pilih range tanggal sendiri.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-12 gap-2 text-muted text-[10px] uppercase tracking-wider px-1">
            <div className="col-span-3">Start</div>
            <div className="col-span-3">End</div>
            <div className="col-span-3">Label (optional)</div>
            <div className="col-span-2">Target (auto if blank)</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          {weeks.map(w => (
            <div key={w.id} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="date"
                value={w.startDate}
                onChange={e => updateWeek(w.id, { startDate: e.target.value })}
                className="col-span-3 bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
              />
              <input
                type="date"
                value={w.endDate}
                onChange={e => updateWeek(w.id, { endDate: e.target.value })}
                className="col-span-3 bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                value={w.label ?? ''}
                onChange={e => updateWeek(w.id, { label: e.target.value || undefined })}
                placeholder="auto"
                className="col-span-3 bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                min={0}
                step={1}
                value={w.targetOverride ?? ''}
                onChange={e => {
                  const v = e.target.value
                  updateWeek(w.id, { targetOverride: v === '' ? undefined : Number(v) })
                }}
                placeholder="auto"
                className="col-span-2 bg-background border border-border rounded-md px-2 py-1 text-xs text-foreground tabular-nums focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => removeWeek(w.id)}
                className="col-span-1 text-danger hover:opacity-80 text-xs"
                title="Remove week"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
