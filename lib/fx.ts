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

// Primary + fallback URLs. fawazahmed0/currency-api v1 (Cloudflare/jsDelivr
// mirrors) returns `{ date, khr: { usd: number } }`.
const URLS = [
  'https://latest.currency-api.pages.dev/v1/currencies/khr.json',
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/khr.json',
]

type Cache = { khrPerUsd: number; usdPerKhr: number; fetchedAt: number; source: 'api' | 'fallback' }

let cache: Cache | null = null

async function tryFetch(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return null
    const json = (await res.json()) as { khr?: { usd?: number }; usd?: number }
    // v1 shape: { khr: { usd } }; old shape: { usd } — accept both for resilience.
    const usdPerKhr = Number(json?.khr?.usd ?? json?.usd)
    return Number.isFinite(usdPerKhr) && usdPerKhr > 0 ? usdPerKhr : null
  } catch {
    return null
  }
}

/**
 * Get the current KHR→USD conversion. Returns USD per 1 KHR
 * (so `khrAmount * usdPerKhr = usdAmount`) plus the inverse and metadata.
 */
export async function getKhrToUsd(): Promise<Cache> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache
  }
  for (const url of URLS) {
    const usdPerKhr = await tryFetch(url)
    if (usdPerKhr != null) {
      cache = {
        usdPerKhr,
        khrPerUsd: 1 / usdPerKhr,
        fetchedAt: Date.now(),
        source: 'api',
      }
      return cache
    }
  }
  console.warn('[fx] all FX endpoints failed, using fallback rate', FALLBACK_KHR_PER_USD)
  cache = {
    usdPerKhr: 1 / FALLBACK_KHR_PER_USD,
    khrPerUsd: FALLBACK_KHR_PER_USD,
    fetchedAt: Date.now(),
    source: 'fallback',
  }
  return cache
}
