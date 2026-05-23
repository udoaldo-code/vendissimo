'use client'

import { useState, useMemo } from 'react'
import type { Currency, Transaction } from '@/lib/types'
import { filterByDateRange, aggregateTransactions } from '@/lib/aggregate'
import { DateFilter, type DatePreset } from '@/components/executive-summary/DateFilter'
import { DailySalesTable } from '@/components/executive-summary/DailySalesTable'

type Props = {
  transactions: Transaction[]
  categoryMap: Record<string, string>
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function isoOffset(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

export function SalesReportClient({ transactions, categoryMap }: Props) {
  const currency: Currency = 'USD'
  const [preset, setPreset] = useState<DatePreset>('14d')
  const [dateFrom, setDateFrom] = useState(isoOffset(13))
  const [dateTo, setDateTo] = useState(isoToday())

  function handleChange(p: DatePreset, from: string, to: string) {
    setPreset(p)
    setDateFrom(from)
    setDateTo(to)
  }

  const filtered = useMemo(
    () => filterByDateRange(transactions, dateFrom, dateTo),
    [transactions, dateFrom, dateTo],
  )

  const dailySales = useMemo(
    () => aggregateTransactions(filtered, categoryMap, currency).dailySales,
    [filtered, categoryMap, currency],
  )

  const hasData = dailySales.dates.length > 0 && dailySales.machines.length > 0

  return (
    <div className="flex flex-col gap-4">
      <DateFilter preset={preset} dateFrom={dateFrom} dateTo={dateTo} onChange={handleChange} />

      {hasData ? (
        <DailySalesTable dailySales={dailySales} preset={preset} />
      ) : (
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <p className="text-foreground text-sm font-semibold mb-2">No sales data for the selected period</p>
          <p className="text-muted text-sm">Pick a different period or refresh the data.</p>
        </div>
      )}
    </div>
  )
}
