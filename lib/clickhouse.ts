import { createClient } from '@clickhouse/client'
import type { Transaction } from './types'
import { rowToTransaction, buildCanonicalNames, type CHRow } from './transactions'
import { DEVICE_LOCATIONS } from './locations'

const CACHE_TTL_MS = 5 * 60_000 // 5 minutes — short enough that new sales appear quickly on every page

let cache: { at: number; data: Transaction[]; lastSync: string | null } | null = null

function client() {
  return createClient({
    url: process.env.CLICKHOUSE_URL,
    database: process.env.CLICKHOUSE_DB,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    request_timeout: 30_000,
  })
}

/**
 * Fetch every sales row from ClickHouse, mapped to the dashboard's Transaction
 * shape. Results are cached in process memory for CACHE_TTL_MS. Call
 * invalidateTransactionsCache() to force a refetch.
 */
export async function fetchTransactions(): Promise<Transaction[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data
  }
  const ch = client()
  try {
    const result = await ch.query({
      query: `
        SELECT device_id, device_name, product_name, product_brand, sales_amount, sales_time
        FROM deliverydetail
        WHERE sales_time IS NOT NULL AND sales_amount IS NOT NULL
        ORDER BY sales_time
      `,
      format: 'JSONEachRow',
    })
    const rows = (await result.json()) as CHRow[]
    const canonicalNames = buildCanonicalNames(rows)
    const data = rows.map(r => rowToTransaction(r, DEVICE_LOCATIONS, canonicalNames))
    let lastSync: string | null = null
    for (const r of rows) {
      if (r.sales_time && (!lastSync || r.sales_time > lastSync)) lastSync = r.sales_time
    }
    cache = { at: Date.now(), data, lastSync }
    return data
  } finally {
    await ch.close()
  }
}

/** Most recent sales_time in the dataset (proxy for ETL freshness). Null if no data yet. */
export function getLastSyncTime(): string | null {
  return cache?.lastSync ?? null
}

/** Drop the in-process cache so the next call refetches from ClickHouse. */
export function invalidateTransactionsCache(): void {
  cache = null
}
