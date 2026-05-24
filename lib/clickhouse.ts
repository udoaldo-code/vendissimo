import { createClient } from '@clickhouse/client'
import type { Transaction } from './types'
import { rowToTransaction, buildCanonicalNames, type CHRow } from './transactions'
import { DEVICE_LOCATIONS } from './locations'
import { getKhrToUsd } from './fx'

const CACHE_TTL_MS = 5 * 60_000 // 5 minutes — short enough that new sales appear quickly on every page

type FxInfo = { khrPerUsd: number; fetchedAt: number; source: 'api' | 'fallback' }

let cache: { at: number; data: Transaction[]; lastSync: string | null; lastCron: string | null; fx: FxInfo | null } | null = null

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
    const fxRate = await getKhrToUsd()
    const data = rows.map(r => rowToTransaction(r, DEVICE_LOCATIONS, canonicalNames, fxRate.usdPerKhr))
    let lastSync: string | null = null
    for (const r of rows) {
      if (r.sales_time && (!lastSync || r.sales_time > lastSync)) lastSync = r.sales_time
    }
    const cronResult = await ch.query({
      query: 'SELECT max(scrape_timestamp) AS s FROM deliverydetail',
      format: 'JSONEachRow',
    })
    const cronRows = (await cronResult.json()) as { s: string | null }[]
    const lastCron = cronRows[0]?.s ?? null
    cache = {
      at: Date.now(),
      data,
      lastSync,
      lastCron,
      fx: { khrPerUsd: fxRate.khrPerUsd, fetchedAt: fxRate.fetchedAt, source: fxRate.source },
    }
    return data
  } finally {
    await ch.close()
  }
}

/** Most recent scrape_timestamp = when the external cron last pushed to ClickHouse. */
export function getLastCronTime(): string | null {
  return cache?.lastCron ?? null
}

/** KHR→USD conversion info used during the last fetch (null if not loaded yet). */
export function getFxInfo(): FxInfo | null {
  return cache?.fx ?? null
}

/** Most recent sales_time in the dataset (proxy for ETL freshness). Null if no data yet. */
export function getLastSyncTime(): string | null {
  return cache?.lastSync ?? null
}

/** Drop the in-process cache so the next call refetches from ClickHouse. */
export function invalidateTransactionsCache(): void {
  cache = null
}
