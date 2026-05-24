/**
 * KHR → USD exchange rate, fetched from a free daily-updated API
 * (fawazahmed0/currency-api, CDN-hosted, no signup).
 *
 * Cached for 24 hours in-process. Falls back to a hardcoded rate if the
 * API is unreachable, so the dashboard never breaks because of FX.
 */

/** Khmer riel per US dollar — used as the fallback when the API is unreachable. */
const FALLBACK_KHR_PER_USD = 4100

const CACHE_TTL_MS = 24 * 60 * 60_000 // 24 hours
const URL = 'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/khr/usd.json'

type Cache = { khrPerUsd: number; usdPerKhr: number; fetchedAt: number; source: 'api' | 'fallback' }

let cache: Cache | null = null

/**
 * Get the current KHR→USD conversion. Returns USD per 1 KHR
 * (so `khrAmount * usdPerKhr = usdAmount`) plus the inverse and metadata.
 */
export async function getKhrToUsd(): Promise<Cache> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache
  }
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) throw new Error(`fx api ${res.status}`)
    const json = (await res.json()) as { usd: number }
    const usdPerKhr = Number(json.usd)
    if (!Number.isFinite(usdPerKhr) || usdPerKhr <= 0) throw new Error('fx api returned invalid rate')
    cache = {
      usdPerKhr,
      khrPerUsd: 1 / usdPerKhr,
      fetchedAt: Date.now(),
      source: 'api',
    }
    return cache
  } catch (e) {
    console.error('[fx] rate fetch failed, using fallback:', e instanceof Error ? e.message : e)
    cache = {
      usdPerKhr: 1 / FALLBACK_KHR_PER_USD,
      khrPerUsd: FALLBACK_KHR_PER_USD,
      fetchedAt: Date.now(),
      source: 'fallback',
    }
    return cache
  }
}
