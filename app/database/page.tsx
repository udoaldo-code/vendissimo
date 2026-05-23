import { fetchTransactions, getLastSyncTime } from '@/lib/clickhouse'
import { formatLastSync } from '@/lib/transactions'
import { RefreshButton } from '@/components/RefreshButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { DatabaseClient } from '@/components/database/DatabaseClient'

export const dynamic = 'force-dynamic'

export default async function DatabasePage() {
  const transactions = await fetchTransactions()
  const lastSync = getLastSyncTime()

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Database</h1>
          <p className="text-muted text-xs mt-0.5">
            {transactions.length.toLocaleString()} records · Data through {formatLastSync(lastSync)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
      <DatabaseClient transactions={transactions} />
    </div>
  )
}
