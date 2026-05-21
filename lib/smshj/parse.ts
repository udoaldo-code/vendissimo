import type { Machine } from './types'

const RE_MACHINE_ID = /machine\.html\?id=(\d+)/g
const RE_TEMP = /主柜温度[:：]\s*(-?\d+(?:\.\d+)?)\s*℃/
const RE_NAME = /<input[^>]+id=["']new-name["'][^>]*value=["']([^"']+)/
const RE_CODE = /sbId\s*:\s*["']([a-z0-9]{10,30})["']/

/** Distinct machine ids in first-seen order. */
export function parseMachineIds(html: string): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const m of html.matchAll(RE_MACHINE_ID)) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

/** Parse one machine-detail page. `scrapedAt` is passed in so this stays pure. */
export function parseMachineDetail(html: string, id: string, scrapedAt: string): Machine {
  const m: Machine = {
    id, code: '', name: '', temperature_c: null, online: null, scraped_at: scrapedAt, breached: false,
  }
  const t = RE_TEMP.exec(html)
  if (t) {
    const n = parseFloat(t[1])
    if (!Number.isNaN(n)) m.temperature_c = n
  }
  const nm = RE_NAME.exec(html)
  if (nm) m.name = nm[1]
  const cd = RE_CODE.exec(html)
  if (cd) m.code = cd[1]
  if (html.includes('正常售卖')) m.online = true
  else if (html.includes('停止售卖') || html.includes('停售')) m.online = false
  return m
}
