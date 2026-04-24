'use client'

import { useState, useEffect } from 'react'
import type { Transaction } from '@/lib/types'

type SortKey = keyof Transaction | 'revenue'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 100

const thClass = 'text-left py-2 px-3 text-[#57534e] text-xs uppercase font-medium cursor-pointer hover:text-[#a8a29e] select-none whitespace-nowrap'
const tdClass = 'py-2 px-3 text-[#a8a29e] text-xs whitespace-nowrap'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>
  return <span className="ml-1 text-[#f97316]">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [transactions])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sorted = [...transactions].sort((a, b) => {
    let av: string | number
    let bv: string | number
    if (sortKey === 'revenue') {
      av = a.unitPrice * a.qty
      bv = b.unitPrice * b.qty
    } else {
      av = a[sortKey]
      bv = b[sortKey]
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="bg-[#292524] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[#44403c]">
            <tr>
              {(['date', 'time', 'machine', 'location', 'product', 'unitPrice', 'qty', 'revenue'] as SortKey[]).map(col => (
                <th key={col} className={thClass} onClick={() => toggleSort(col)}>
                  {col === 'unitPrice' ? 'Price' : col === 'revenue' ? 'Revenue' : col.charAt(0).toUpperCase() + col.slice(1)}
                  <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t, i) => (
              <tr key={i} className="border-b border-[#44403c]/50 hover:bg-[#44403c]/30">
                <td className={tdClass}>{t.date}</td>
                <td className={`${tdClass} text-[#57534e]`}>{t.time}</td>
                <td className={tdClass}>{t.machine}</td>
                <td className={tdClass}>{t.location}</td>
                <td className={`${tdClass} text-[#e7e5e4]`}>{t.product}</td>
                <td className={`${tdClass} text-right`}>${t.unitPrice.toFixed(2)}</td>
                <td className={`${tdClass} text-right`}>{t.qty}</td>
                <td className={`${tdClass} text-right text-[#f97316]`}>${(t.unitPrice * t.qty).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#44403c]">
          <span className="text-[#57534e] text-xs">
            Page {page + 1} of {totalPages} · {sorted.length.toLocaleString()} rows
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded bg-[#44403c] text-[#a8a29e] hover:text-[#e7e5e4] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-xs rounded bg-[#44403c] text-[#a8a29e] hover:text-[#e7e5e4] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
