'use client'

import { useState, useMemo } from 'react'
import type { Transaction, FilterState } from '@/lib/types'
import { filterTransactions } from '@/lib/filter-utils'
import { SummaryBar } from './SummaryBar'
import { FilterBar } from './FilterBar'
import { TransactionsTable } from './TransactionsTable'
import { ExportCSVButton } from './ExportCSVButton'

function unique(arr: string[]) {
  return [...new Set(arr)].sort()
}

export function DatabaseClient({ transactions }: { transactions: Transaction[] }) {
  const [filters, setFilters] = useState<FilterState>({
    search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '',
  })

  const machines = useMemo(() => unique(transactions.map(t => t.machine)), [transactions])
  const locations = useMemo(() => unique(transactions.map(t => t.location)), [transactions])
  const products = useMemo(() => unique(transactions.map(t => t.product)), [transactions])

  const filtered = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SummaryBar transactions={filtered} total={transactions.length} />
        <ExportCSVButton transactions={filtered} />
      </div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        locations={locations}
        products={products}
      />
      <TransactionsTable transactions={filtered} />
    </div>
  )
}
