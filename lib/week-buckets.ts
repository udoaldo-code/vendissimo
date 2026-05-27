import { parseTransactionDate } from './filter-utils'
import type { WeekRange } from './types'

export type WeekBucket = {
  key: string
  label: string
  dates: string[]   // original "M/D/YYYY" date strings present in displayDates
  target?: number   // explicit per-week target override (else compute from kpiTarget × days)
}

function weekStartKey(dateStr: string): string {
  const d = parseTransactionDate(dateStr)
  const dow = d.getDay()
  const offsetToMon = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetToMon)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

function weekOfMonthLabel(mondayKey: string): string {
  const [y, m, d] = mondayKey.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const weekNum = Math.ceil(monday.getDate() / 7)
  const monthName = monday.toLocaleString('en-US', { month: 'short' })
  return `Week ${weekNum} ${monthName}`
}

export function buildAutoWeekBuckets(dates: string[]): WeekBucket[] {
  const grouped: Record<string, string[]> = {}
  const order: string[] = []
  for (const d of dates) {
    const key = weekStartKey(d)
    if (!grouped[key]) { grouped[key] = []; order.push(key) }
    grouped[key].push(d)
  }
  return order.map(key => ({ key, label: weekOfMonthLabel(key), dates: grouped[key] }))
}

function toIsoDate(mdY: string): string {
  const d = parseTransactionDate(mdY)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildOverrideWeekBuckets(dates: string[], weeks: WeekRange[]): WeekBucket[] {
  const isoDates = dates.map(d => ({ orig: d, iso: toIsoDate(d) }))
  return weeks
    .slice()
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(w => {
      const ds = isoDates.filter(x => x.iso >= w.startDate && x.iso <= w.endDate).map(x => x.orig)
      const label = w.label ?? `${w.startDate.slice(5)} → ${w.endDate.slice(5)}`
      return { key: w.id, label, dates: ds, target: w.targetOverride }
    })
}

export function chooseWeekBuckets(dates: string[], weeks: WeekRange[] | undefined): WeekBucket[] {
  if (weeks && weeks.length > 0) return buildOverrideWeekBuckets(dates, weeks)
  return buildAutoWeekBuckets(dates)
}

export function bucketTarget(wk: WeekBucket, dailyKpi: number): number {
  if (typeof wk.target === 'number') return wk.target
  return dailyKpi * wk.dates.length
}
