import { fetchTransactions, getLastSyncTime, getLastCronTime, getFxInfo } from '@/lib/clickhouse'
import { formatLastSync, formatFxRate } from '@/lib/transactions'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import { RefreshButton } from '@/components/RefreshButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ExecSummaryClient } from '@/components/executive-summary/ExecSummaryClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const transactions = await fetchTransactions()
  const lastSync = getLastSyncTime()
  const lastCron = getLastCronTime()
  const fx = getFxInfo()
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Dashboard</h1>
          <p className="text-muted text-xs mt-0.5">
            {transactions.length.toLocaleString()} transactions · Data through {formatLastSync(lastSync)} · Last sync {formatLastSync(lastCron)} · {formatFxRate(fx?.khrPerUsd ?? null, fx?.source ?? null)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
      <ExecSummaryClient transactions={transactions} categoryMap={PRODUCT_CATEGORIES} />
    </div>
  )
}
