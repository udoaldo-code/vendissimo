'use client'

import dynamic from 'next/dynamic'
import { useState, useMemo } from 'react'
import type { Transaction } from '@/lib/types'
import type { Currency } from '@/lib/types'
import { formatMoney } from '@/lib/transactions'
import { filterByDateRange, aggregateTransactions } from '@/lib/aggregate'
import { DateFilter, type DatePreset } from './DateFilter'
import { KPISidebar } from './KPISidebar'
import { TopProductsTable } from './TopProductsTable'
import { MachinePerformanceTable } from './MachinePerformanceTable'

function PanelSkeleton({ heightClass }: { heightClass: string }) {
  return <div className={`bg-card border border-border rounded-lg shadow-sm animate-pulse ${heightClass}`} />
}

const MonthlyRevenueChart = dynamic(
  () => import('./MonthlyRevenueChart').then((m) => m.MonthlyRevenueChart),
  {
    loading: () => <PanelSkeleton heightClass="h-[232px]" />,
    ssr: false,
  }
)

const LocationPieChart = dynamic(
  () => import('./LocationPieChart').then((m) => m.LocationPieChart),
  {
    loading: () => <PanelSkeleton heightClass="h-[212px]" />,
    ssr: false,
  }
)

const WeekdayBarChart = dynamic(
  () => import('./WeekdayBarChart').then((m) => m.WeekdayBarChart),
  {
    loading: () => <PanelSkeleton heightClass="h-[212px]" />,
    ssr: false,
  }
)

type Props = {
  transactions: Transaction[]
  categoryMap: Record<string, string>
}

export function ExecSummaryClient({ transactions, categoryMap }: Props) {
  const currency: Currency = 'USD'
  const [preset, setPreset] = useState<DatePreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function handleChange(p: DatePreset, from: string, to: string) {
    setPreset(p)
    setDateFrom(from)
    setDateTo(to)
  }

  const filtered = useMemo(
    () => filterByDateRange(transactions, dateFrom, dateTo),
    [transactions, dateFrom, dateTo]
  )

  const data = useMemo(
    () => aggregateTransactions(filtered, categoryMap, currency),
    [filtered, categoryMap, currency]
  )

  const mobileKpis = [
    { label: 'Total Revenue', value: formatMoney(data.kpis.totalRevenue, currency), accent: 'var(--color-accent)' },
    { label: 'Transactions', value: data.kpis.totalTransactions.toLocaleString(), accent: 'var(--color-accent-pink)' },
    { label: 'Avg Daily', value: formatMoney(data.kpis.avgDailyRevenue, currency), accent: 'var(--color-accent)' },
    { label: 'Peak Day', value: formatMoney(data.kpis.peakDayRevenue, currency), accent: 'var(--color-danger)' },
  ]

  const charts = (
    <>
      <MonthlyRevenueChart data={data.monthly} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LocationPieChart machines={data.machines} />
        <WeekdayBarChart daily={data.daily} preset={preset} />
      </div>
      <TopProductsTable products={data.products} />
      <MachinePerformanceTable machines={data.machines} />
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <DateFilter preset={preset} dateFrom={dateFrom} dateTo={dateTo} onChange={handleChange} />

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          No transactions found for selected period.
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* Mobile: 2-column KPI grid */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {mobileKpis.map(k => (
              <div key={k.label} className="bg-card rounded-lg p-3 border border-border border-l-4 shadow-sm" style={{ borderLeftColor: k.accent }}>
                <p className="text-muted text-xs uppercase tracking-wider mb-0.5">{k.label}</p>
                <p className="font-bold text-base" style={{ color: k.accent }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Desktop: KPI top + charts */}
          <div className="hidden md:flex md:flex-col gap-4">
            <div className="w-full">
              <KPISidebar kpis={data.kpis} />
            </div>
            <div className="flex flex-col gap-4 min-w-0">
              {charts}
            </div>
          </div>

          {/* Mobile: stacked charts */}
          <div className="flex flex-col gap-4 md:hidden">
            {charts}
          </div>
        </>
      )}
    </div>
  )
}
