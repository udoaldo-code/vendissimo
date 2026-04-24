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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#e7e5e4] text-xl font-bold">Executive Summary</h1>
          <p className="text-[#a8a29e] text-xs mt-0.5">
            Period: 01 Jan 2026 – present · All figures in USD
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Layout B: KPI sidebar left, charts right */}
      <div className="flex gap-6">
        {/* Left: KPI sidebar */}
        <div className="w-52 shrink-0">
          <KPISidebar kpis={data.kpis} />
        </div>

        {/* Right: charts + tables */}
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
    </div>
  )
}
