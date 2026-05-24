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

/**
 * Map one ClickHouse row to the dashboard's Transaction shape.
 *
 * - `canonicalNames[device_id]` overrides the per-row device_name so historic
 *   rows with stale names roll up under the machine's current name.
 * - `usdPerKhr` is used to convert KHR rows (sales_time >= CURRENCY_CUTOFF) to
 *   USD at ingest, so the dashboard works in a single unified currency.
 */
export function rowToTransaction(
  row: CHRow,
  locations: Record<string, string>,
  canonicalNames: Record<string, string> = {},
  usdPerKhr: number = 1 / 4100,
): Transaction {
  const salesTime = row.sales_time ?? ''
  const rawPrice = row.sales_amount != null ? parseFloat(row.sales_amount) : 0
  const safePrice = Number.isNaN(rawPrice) ? 0 : rawPrice
  const originalCurrency = rowCurrency(salesTime)
  const usdPrice = originalCurrency === 'KHR' ? safePrice * usdPerKhr : safePrice
  const id = row.device_id ?? ''
  return {
    machine: (id && canonicalNames[id]) || row.device_name || '',
    location: (id && locations[id]) || 'Unknown',
    product: row.product_name ?? '',
    unitPrice: usdPrice,
    qty: 1,
    time: salesTime.slice(11, 19),
    date: reformatDate(salesTime),
    currency: 'USD',
  }
}

/**
 * Build device_id → latest device_name from a list of CH rows.
 * "Latest" = the row with the greatest sales_time string (lexicographic
 * comparison works for 'YYYY-MM-DD HH:MM:SS').
 */
export function buildCanonicalNames(rows: CHRow[]): Record<string, string> {
  const latestTime: Record<string, string> = {}
  const name: Record<string, string> = {}
  for (const r of rows) {
    const id = r.device_id
    const t = r.sales_time
    const n = r.device_name
    if (!id || !t || !n) continue
    if (!latestTime[id] || t > latestTime[id]) {
      latestTime[id] = t
      name[id] = n
    }
  }
  return name
}

/** Format the dataset's latest sales_time as 'YYYY-MM-DD HH:MM' for a banner. */
export function formatLastSync(salesTime: string | null): string {
  if (!salesTime) return 'no data yet'
  return salesTime.slice(0, 16)
}

/** Format the KHR/USD rate for a header banner, with a tag for fallback source. */
export function formatFxRate(rate: number | null, source: 'api' | 'fallback' | null): string {
  if (rate == null) return 'FX n/a'
  const rounded = Math.round(rate).toLocaleString('en-US')
  return source === 'fallback' ? `FX ${rounded} KHR/USD (fallback)` : `FX ${rounded} KHR/USD`
}

/** Render an amount in the active currency. */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === 'USD') {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return '៛' + Math.round(amount).toLocaleString('en-US')
}
