import { fetchTransactions, getLastSyncTime, getLastCronTime, getFxInfo } from '@/lib/clickhouse'
import { formatLastSync, formatFxRate } from '@/lib/transactions'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import { getOverrides } from '@/lib/overrides'
import { ThemeToggle } from '@/components/ThemeToggle'
import { RefreshButton } from '@/components/RefreshButton'
import { SalesReportClient } from '@/components/sales-report/SalesReportClient'

export const dynamic = 'force-dynamic'

export default async function SalesReportPage() {
  const transactions = await fetchTransactions()
  const overrides = await getOverrides()
  const lastSync = getLastSyncTime()
  const lastCron = getLastCronTime()
  const fx = getFxInfo()

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-3 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Sales Report</h1>
          <p className="text-muted text-xs mt-0.5">Daily sales breakdown by machine</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>

      <div className="mb-4 rounded-md border border-border bg-card px-4 py-2.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-muted-strong">
          <span className="text-muted">Data source:</span>{' '}
          <strong className="text-foreground">ClickHouse</strong> (synced from HBShengma)
        </span>
        <span className="text-muted-strong">
          <span className="text-muted">Last data:</span>{' '}
          <strong className="text-foreground">{formatLastSync(lastSync)}</strong>
        </span>
        <span className="text-muted-strong">
          <span className="text-muted">Last sync:</span>{' '}
          <strong className="text-foreground">{formatLastSync(lastCron)}</strong>
        </span>
        <span className="text-muted-strong">
          <span className="text-muted">FX:</span>{' '}
          <strong className="text-foreground">{formatFxRate(fx?.khrPerUsd ?? null, fx?.source ?? null)}</strong>
        </span>
        <span className="text-muted text-[10px] basis-full mt-0.5">
          ⓘ Revenue may differ from HBShengma source by &lt; $1/day on selected dates due to CH sync drift. Counts match exactly.
        </span>
      </div>

      <SalesReportClient transactions={transactions} categoryMap={PRODUCT_CATEGORIES} overrides={overrides} />
    </div>
  )
}
