import { KPICard } from '@/components/KPICard'
import type { KPIs } from '@/lib/types'

function fmt(n: number, prefix = '$') {
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function KPISidebar({ kpis }: { kpis: KPIs }) {
  return (
    <div className="flex flex-col gap-3">
      <KPICard
        label="Total Revenue"
        value={fmt(kpis.totalRevenue)}
        sub="YTD 2026"
        accentColor="var(--color-accent)"
      />
      <KPICard
        label="Total Transactions"
        value={kpis.totalTransactions.toLocaleString()}
        sub={`${kpis.unitsSold.toLocaleString()} units sold`}
        accentColor="var(--color-accent-pink)"
      />
      <KPICard
        label="Avg Daily Revenue"
        value={fmt(kpis.avgDailyRevenue)}
        accentColor="var(--color-accent)"
      />
      <KPICard
        label="Peak Day Revenue"
        value={fmt(kpis.peakDayRevenue)}
        sub={kpis.peakDayDate}
        accentColor="var(--color-danger)"
      />
      <KPICard
        label="Machines / Locations"
        value={`${kpis.activeMachines} / ${kpis.activeLocations}`}
        accentColor="var(--color-accent-pink)"
      />
    </div>
  )
}
