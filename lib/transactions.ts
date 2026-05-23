import type { Currency, Transaction } from './types'

/** Cutoff: rows whose sales_time is < this string are USD; >= is KHR. */
export const CURRENCY_CUTOFF = '2026-05-19'

/** Raw ClickHouse row shape (only the columns the dashboard uses). */
export type CHRow = {
  device_id: string | null
  device_name: string | null
  product_name: string | null
  product_brand: string | null
  sales_amount: string | null
  sales_time: string | null
}

/** Currency for a row, derived from its sales_time string. */
export function rowCurrency(salesTime: string): Currency {
  return salesTime < CURRENCY_CUTOFF ? 'USD' : 'KHR'
}

function reformatDate(salesTime: string): string {
  // 'YYYY-MM-DD HH:MM:SS' → 'M/D/YYYY' so parseTransactionDate accepts it.
  const [y, m, d] = salesTime.slice(0, 10).split('-').map(Number)
  return `${m}/${d}/${y}`
}

/** Map one ClickHouse row to the dashboard's Transaction shape. */
export function rowToTransaction(row: CHRow, locations: Record<string, string>): Transaction {
  const salesTime = row.sales_time ?? ''
  const price = row.sales_amount != null ? parseFloat(row.sales_amount) : 0
  return {
    machine: row.device_name ?? '',
    location: (row.device_id && locations[row.device_id]) || 'Unknown',
    product: row.product_name ?? '',
    unitPrice: Number.isNaN(price) ? 0 : price,
    qty: 1,
    time: salesTime.slice(11, 19),
    date: reformatDate(salesTime),
    currency: rowCurrency(salesTime),
  }
}

/** Render an amount in the active currency. */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === 'USD') {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return '៛' + Math.round(amount).toLocaleString('en-US')
}
