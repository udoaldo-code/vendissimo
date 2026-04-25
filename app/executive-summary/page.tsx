export const dynamic = 'force-dynamic'

import { fetchExecutiveSummary, fetchDatabase } from '@/lib/sheets'
import { RefreshButton } from '@/components/RefreshButton'
import { ExecSummaryClient } from '@/components/executive-summary/ExecSummaryClient'

export default async function ExecSummaryPage() {
  const [execData, transactions] = await Promise.all([
    fetchExecutiveSummary(),
    fetchDatabase(),
  ])

  // Category map built from sheet data (categories not in raw transactions)
  const categoryMap: Record<string, string> = {}
  for (const p of execData.products) {
    categoryMap[p.product] = p.category
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-[#1e1b4b] text-xl font-bold">Executive Summary</h1>
          <p className="text-[#9ca3af] text-xs mt-0.5">
            {transactions.length.toLocaleString()} transactions · All figures in USD
          </p>
        </div>
        <RefreshButton />
      </div>
      <ExecSummaryClient transactions={transactions} categoryMap={categoryMap} />
    </div>
  )
}
