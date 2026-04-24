export const dynamic = 'force-dynamic'

import { fetchDatabase } from '@/lib/sheets'
import { RefreshButton } from '@/components/RefreshButton'
import { DatabaseClient } from '@/components/database/DatabaseClient'

export default async function DatabasePage() {
  const transactions = await fetchDatabase()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#e7e5e4] text-xl font-bold">Database</h1>
          <p className="text-[#a8a29e] text-xs mt-0.5">
            Vendissimo Daily Sales 2026 · {transactions.length.toLocaleString()} records
          </p>
        </div>
        <RefreshButton />
      </div>
      <DatabaseClient transactions={transactions} />
    </div>
  )
}
