'use client'

import { useState, useMemo } from 'react'
import type { Currency, Overrides, Transaction } from '@/lib/types'
import { filterByDateRange, aggregateTransactions } from '@/lib/aggregate'
import { DateFilter, type DatePreset } from '@/components/executive-summary/DateFilter'
import { DailySalesTable } from '@/components/executive-summary/DailySalesTable'
import { WeeklySummary } from '@/components/executive-summary/WeeklySummary'
import { EditProvider } from '@/components/edit-mode/EditContext'
import { EditModeToggle } from '@/components/edit-mode/EditModeToggle'
import { EditBanner } from '@/components/edit-mode/EditBanner'
import { WeeksEditor } from '@/components/edit-mode/WeeksEditor'

type Props = {
  transactions: Transaction[]
  categoryMap: Record<string, string>
  overrides: Overrides
}

export function SalesReportClient({ transactions, categoryMap, overrides }: Props) {
  const currency: Currency = 'USD'
  const [preset, setPreset] = useState<DatePreset>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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
    <EditProvider>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <DateFilter preset={preset} dateFrom={dateFrom} dateTo={dateTo} onChange={handleChange} />
          <EditModeToggle initialOverrides={overrides} />
        </div>

        <EditBanner />
        <WeeksEditor />

        {hasData ? (
          <>
            <DailySalesTable dailySales={dailySales} preset={preset} overrides={overrides} />
            <WeeklySummary dailySales={dailySales} overrides={overrides} preset={preset} />
          </>
        ) : (
          <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
            <p className="text-foreground text-sm font-semibold mb-2">No sales data for the selected period</p>
            <p className="text-muted text-sm">Pick a different period or refresh the data.</p>
          </div>
        )}
      </div>
    </EditProvider>
  )
}
