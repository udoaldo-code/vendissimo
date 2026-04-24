import type { Transaction, FilterState } from './types'

export function parseTransactionDate(dateStr: string): Date {
  const [m, d, y] = dateStr.split('/').map(Number)
  return new Date(y, m - 1, d)
}

// Subsequence match (not substring): each char of `pattern` must appear in `text`
// in order. Allows queries like "bach" to match "BACCHUS" despite the double-c.
function fuzzyMatch(text: string, pattern: string): boolean {
  let pi = 0
  for (let i = 0; i < text.length && pi < pattern.length; i++) {
    if (text[i] === pattern[pi]) pi++
  }
  return pi === pattern.length
}

export function filterTransactions(transactions: Transaction[], filters: FilterState): Transaction[] {
  const search = filters.search.toLowerCase()

  return transactions.filter(t => {
    if (search && !fuzzyMatch(t.product.toLowerCase(), search) && !fuzzyMatch(t.machine.toLowerCase(), search)) {
      return false
    }
    if (filters.machine && t.machine !== filters.machine) return false
    if (filters.location && t.location !== filters.location) return false
    if (filters.product && t.product !== filters.product) return false

    if (filters.dateFrom) {
      const txDate = parseTransactionDate(t.date)
      const [fy, fm, fd] = filters.dateFrom.split('-').map(Number)
      const from = new Date(fy, fm - 1, fd)
      if (txDate < from) return false
    }
    if (filters.dateTo) {
      const txDate = parseTransactionDate(t.date)
      const [ty, tm, td] = filters.dateTo.split('-').map(Number)
      const to = new Date(ty, tm - 1, td)
      to.setHours(23, 59, 59, 999)
      if (txDate > to) return false
    }

    return true
  })
}

export function exportToCSVString(transactions: Transaction[]): string {
  const headers = ['Date', 'Time', 'Machine', 'Location', 'Product', 'Unit Price', 'Qty', 'Revenue']
  const rows = transactions.map(t => [
    t.date,
    t.time,
    t.machine,
    t.location,
    t.product,
    t.unitPrice.toFixed(2),
    t.qty.toString(),
    (t.unitPrice * t.qty).toFixed(2),
  ])
  const headerRow = headers.map(h => `"${h}"`).join(',')
  const dataRows = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
  return [headerRow, ...dataRows].join('\n')
}
