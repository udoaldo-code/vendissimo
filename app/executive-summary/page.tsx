export const dynamic = 'force-dynamic'

import { fetchExecutiveSummary } from '@/lib/sheets'
import { RefreshButton } from '@/components/RefreshButton'
import { KPISidebar } from '@/components/executive-summary/KPISidebar'
import { MonthlyRevenueChart } from '@/components/executive-summary/MonthlyRevenueChart'
import { LocationPieChart } from '@/components/executive-summary/LocationPieChart'
import { WeekdayBarChart } from '@/components/executive-summary/WeekdayBarChart'
import { TopProductsTable } from '@/components/executive-summary/TopProductsTable'
import { MachinePerformanceTable } from '@/components/executive-summary/MachinePerformanceTable'

export default async function ExecSummaryPage() {
  const data = await fetchExecutiveSummary()

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-[#1e1b4b] text-xl font-bold">Executive Summary</h1>
          <p className="text-[#9ca3af] text-xs mt-0.5">
            Period: 01 Jan 2026 – present · All figures in USD
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Mobile: KPI cards in 2-column grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 md:hidden">
        {/* Inline KPI cards for mobile */}
        {[
          { label: 'Total Revenue', value: `$${data.kpis.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, accent: '#7c3aed' },
          { label: 'Transactions', value: data.kpis.totalTransactions.toLocaleString(), accent: '#ec4899' },
          { label: 'Avg Daily', value: `$${data.kpis.avgDailyRevenue.toFixed(2)}`, accent: '#7c3aed' },
          { label: 'Peak Day', value: `$${data.kpis.peakDayRevenue.toFixed(2)}`, accent: '#dc2626' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-lg p-3 border border-[#ede9fe] border-l-4 shadow-sm" style={{ borderLeftColor: k.accent }}>
            <p className="text-[#9ca3af] text-xs uppercase tracking-wider mb-0.5">{k.label}</p>
            <p className="font-bold text-base" style={{ color: k.accent }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Desktop: Layout B — sidebar left + charts right */}
      <div className="hidden md:flex gap-6">
        <div className="w-52 shrink-0">
          <KPISidebar kpis={data.kpis} />
        </div>
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <MonthlyRevenueChart data={data.monthly} />
          <div className="grid grid-cols-2 gap-4">
            <LocationPieChart machines={data.machines} />
            <WeekdayBarChart data={data.weekday} />
          </div>
          <TopProductsTable products={data.products} />
          <MachinePerformanceTable machines={data.machines} />
        </div>
      </div>

      {/* Mobile: charts stacked full width */}
      <div className="flex flex-col gap-4 md:hidden">
        <MonthlyRevenueChart data={data.monthly} />
        <LocationPieChart machines={data.machines} />
        <WeekdayBarChart data={data.weekday} />
        <TopProductsTable products={data.products} />
        <MachinePerformanceTable machines={data.machines} />
      </div>
    </div>
  )
}
