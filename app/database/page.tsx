export const dynamic = 'force-dynamic'

import { fetchDatabase } from '@/lib/sheets'
import { RefreshButton } from '@/components/RefreshButton'
import { DatabaseClient } from '@/components/database/DatabaseClient'

export default async function DatabasePage() {
  const transactions = await fetchDatabase()

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-[#1e1b4b] text-xl font-bold">Database</h1>
          <p className="text-[#9ca3af] text-xs mt-0.5">
            Vendissimo Daily Sales 2026 · {transactions.length.toLocaleString()} records
          </p>
        </div>
        <RefreshButton />
      </div>
      <DatabaseClient transactions={transactions} />
    </div>
  )
}
