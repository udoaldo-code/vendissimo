'use client'

import { useState, useMemo } from 'react'
import type { Transaction } from '@/lib/types'
import { filterByDateRange, aggregateTransactions } from '@/lib/aggregate'
import { DateFilter, type DatePreset } from './DateFilter'
import { KPISidebar } from './KPISidebar'
import { MonthlyRevenueChart } from './MonthlyRevenueChart'
import { LocationPieChart } from './LocationPieChart'
import { WeekdayBarChart } from './WeekdayBarChart'
import { TopProductsTable } from './TopProductsTable'
import { MachinePerformanceTable } from './MachinePerformanceTable'

type Props = {
  transactions: Transaction[]
  categoryMap: Record<string, string>
}

export function ExecSummaryClient({ transactions, categoryMap }: Props) {
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
    () => aggregateTransactions(filtered, categoryMap),
    [filtered, categoryMap]
  )

  const mobileKpis = [
    { label: 'Total Revenue', value: `$${data.kpis.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, accent: '#7c3aed' },
    { label: 'Transactions', value: data.kpis.totalTransactions.toLocaleString(), accent: '#ec4899' },
    { label: 'Avg Daily', value: `$${data.kpis.avgDailyRevenue.toFixed(2)}`, accent: '#7c3aed' },
    { label: 'Peak Day', value: `$${data.kpis.peakDayRevenue.toFixed(2)}`, accent: '#dc2626' },
  ]

  const charts = (
    <>
      <MonthlyRevenueChart data={data.monthly} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LocationPieChart machines={data.machines} />
        <WeekdayBarChart weekday={data.weekday} daily={data.daily} preset={preset} />
      </div>
      <TopProductsTable products={data.products} />
      <MachinePerformanceTable machines={data.machines} />
    </>
  )

  return (
    <div className="flex flex-col gap-4">
      <DateFilter preset={preset} dateFrom={dateFrom} dateTo={dateTo} onChange={handleChange} />

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[#9ca3af] text-sm">
          No transactions found for selected period.
        </div>
      )}

      {filtered.length > 0 && (
        <>
          {/* Mobile: 2-column KPI grid */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {mobileKpis.map(k => (
              <div key={k.label} className="bg-white rounded-lg p-3 border border-[#ede9fe] border-l-4 shadow-sm" style={{ borderLeftColor: k.accent }}>
                <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-0.5">{k.label}</p>
                <p className="font-bold text-base" style={{ color: k.accent }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Desktop: sidebar + charts */}
          <div className="hidden md:flex gap-6">
            <div className="w-52 shrink-0">
              <KPISidebar kpis={data.kpis} />
            </div>
            <div className="flex-1 flex flex-col gap-4 min-w-0">
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
