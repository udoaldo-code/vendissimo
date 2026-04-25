'use client'

import { exportToCSVString } from '@/lib/filter-utils'
import type { Transaction } from '@/lib/types'

export function ExportCSVButton({ transactions }: { transactions: Transaction[] }) {
  function handleExport() {
    const csv = exportToCSVString(transactions)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendissimo-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#7c3aed]/10 border border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#7c3aed]/20 transition-colors whitespace-nowrap"
    >
      ↓ Export CSV ({transactions.length.toLocaleString()} rows)
    </button>
  )
}
