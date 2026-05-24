'use client'

import type { DailySalesData, DailySalesMachineRow } from '@/lib/types'

type Tone = 'emerald' | 'danger'
type RankedRow = DailySalesMachineRow & { avgPerDay: number }

type CardProps = {
  title: string
  icon: string
  tone: Tone
  items: RankedRow[]
  kpiTarget: number
}

function PerformerCard({ title, icon, tone, items, kpiTarget }: CardProps) {
  const accentBg = tone === 'emerald' ? 'bg-emerald-500/10' : 'bg-danger/10'
  const accentBorder = tone === 'emerald' ? 'border-emerald-500/40' : 'border-danger/40'
  const accentText = tone === 'emerald' ? 'text-emerald-300' : 'text-danger'
  const rowMetric = tone === 'emerald' ? 'text-emerald-300' : 'text-danger'

  return (
    <div className={`rounded-lg border ${accentBorder} ${accentBg} p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <h3 className={`text-sm font-semibold ${accentText} uppercase tracking-wide`}>{title}</h3>
        </div>
        <span className="text-xs text-muted">Target ≥ {kpiTarget} u/day</span>
      </div>

      {items.length === 0 ? (
        <p className="text-muted text-xs">No machine data in this period.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((m, i) => (
            <li key={m.machine} className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2">
              <span className={`text-xs font-bold ${accentText} w-5 text-center`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-foreground text-sm font-medium truncate" title={m.machine}>{m.machine}</div>
                <div className="text-muted text-xs">{m.location}</div>
              </div>
              <div className="text-right whitespace-nowrap">
                <div className={`text-base font-bold tabular-nums ${rowMetric}`}>{Math.round(m.avgPerDay)}</div>
                <div className="text-muted text-[10px] uppercase tracking-wider">units/day</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function HighLowPerformersCards({ dailySales }: { dailySales: DailySalesData }) {
  const periodDays = dailySales.dates.length || 1
  const ranked: RankedRow[] = dailySales.machines
    .filter(m => m.dayActive > 0)
    .map(m => ({ ...m, avgPerDay: m.totalQty / periodDays }))
    .sort((a, b) => b.avgPerDay - a.avgPerDay)

  const top = ranked.slice(0, 3)
  const bottom = ranked.slice(-3).reverse()

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PerformerCard title="High Performing Machines" icon="🏆" tone="emerald" items={top} kpiTarget={dailySales.kpiTarget} />
      <PerformerCard title="Low Performing Machines" icon="⚠️" tone="danger" items={bottom} kpiTarget={dailySales.kpiTarget} />
    </div>
  )
}
