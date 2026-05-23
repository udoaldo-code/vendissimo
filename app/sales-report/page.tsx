import { fetchTransactions, getLastSyncTime, getLastCronTime } from '@/lib/clickhouse'
import { formatLastSync } from '@/lib/transactions'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import { ThemeToggle } from '@/components/ThemeToggle'
import { RefreshButton } from '@/components/RefreshButton'
import { SalesReportClient } from '@/components/sales-report/SalesReportClient'

export const revalidate = 300 // 5-min ISR cache — re-render in background after window

export default async function SalesReportPage() {
  const transactions = await fetchTransactions()
  const lastSync = getLastSyncTime()
  const lastCron = getLastCronTime()

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Sales Report</h1>
          <p className="text-muted text-xs mt-0.5">Daily sales breakdown by machine · Data through {formatLastSync(lastSync)} · Last sync {formatLastSync(lastCron)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
      <SalesReportClient transactions={transactions} categoryMap={PRODUCT_CATEGORIES} />
    </div>
  )
}
