'use client'

import { KPICard } from '@/components/KPICard'
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
import type { KPIs } from '@/lib/types'

export function KPISidebar({ kpis }: { kpis: KPIs }) {
  const currency = useCurrency()
  const money = (n: number) => formatMoney(n, currency)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 auto-rows-fr">
      <div className="h-full">
        <KPICard
          label="Total Revenue"
          value={money(kpis.totalRevenue)}
          sub="YTD 2026"
          accentColor="var(--color-accent)"
        />
      </div>
      <div className="h-full">
        <KPICard
          label="Total Transactions"
          value={kpis.totalTransactions.toLocaleString()}
          sub={`${kpis.unitsSold.toLocaleString()} units sold`}
          accentColor="var(--color-accent-pink)"
        />
      </div>
      <div className="h-full">
        <KPICard
          label="Avg Daily Revenue"
          value={money(kpis.avgDailyRevenue)}
          accentColor="var(--color-accent)"
        />
      </div>
      <div className="h-full">
        <KPICard
          label="Peak Day Revenue"
          value={money(kpis.peakDayRevenue)}
          sub={kpis.peakDayDate}
          accentColor="var(--color-danger)"
        />
      </div>
      <div className="h-full">
        <KPICard
          label="Machines / Locations"
          value={`${kpis.activeMachines} / ${kpis.activeLocations}`}
          accentColor="var(--color-accent-pink)"
        />
      </div>
    </div>
  )
}
