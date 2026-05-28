import { createClient } from '@clickhouse/client'
import type { Transaction } from './types'
import { rowToTransaction, buildCanonicalNames, type CHRow } from './transactions'
import { DEVICE_LOCATIONS } from './locations'
import { getKhrToUsd } from './fx'
import { getOverrides } from './overrides'

const CACHE_TTL_MS = 5 * 60_000 // 5 minutes — short enough that new sales appear quickly on every page

type FxInfo = { khrPerUsd: number; fetchedAt: number; source: 'api' | 'fallback' | 'pinned' }

let cache: { at: number; data: Transaction[]; lastSync: string | null; lastCron: string | null; fx: FxInfo | null } | null = null

function client() {
  return createClient({
    url: process.env.CLICKHOUSE_URL,
    database: process.env.CLICKHOUSE_DB,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    request_timeout: 120_000,
    // Compress the response so 21k JSON rows fit in a few hundred KB
    // instead of multiple MB over the WAN link to ClickHouse.
    compression: { request: false, response: true },
    // Keep the HTTP connection alive during long queries so load-balancer
    // idle timeouts do not kill the response stream.
    clickhouse_settings: {
      send_progress_in_http_headers: 1,
      http_headers_progress_interval_ms: '10000',
    },
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
  // Fetch FX rate + overrides BEFORE opening CH client so slow upstreams
  // cannot idle out the CH connection between its two queries.
  const [fxRate, overrides] = await Promise.all([getKhrToUsd(), getOverrides()])

  const ch = client()
  try {
    // Combine both queries into one round trip so there is no idle window.
    const rowsResult = await ch.query({
      query: `
        SELECT device_id, device_name, product_name, sales_amount, sales_time
        FROM deliverydetail
        WHERE sales_time IS NOT NULL AND sales_amount IS NOT NULL
        ORDER BY sales_time
      `,
      format: 'JSONEachRow',
    })
    const rows = (await rowsResult.json()) as CHRow[]

    const cronResult = await ch.query({
      query: 'SELECT max(scrape_timestamp) AS s FROM deliverydetail',
      format: 'JSONEachRow',
    })
    const cronRows = (await cronResult.json()) as { s: string | null }[]
    const lastCron = cronRows[0]?.s ?? null

    const canonicalNames = buildCanonicalNames(rows)
    const data = rows.map(r => rowToTransaction(r, DEVICE_LOCATIONS, canonicalNames, fxRate.usdPerKhr, overrides))
    let lastSync: string | null = null
    for (const r of rows) {
      if (r.sales_time && (!lastSync || r.sales_time > lastSync)) lastSync = r.sales_time
    }

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
