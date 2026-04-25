import type { Transaction, KPIs, MonthlyRow, ProductRow, MachineRow, WeekdayRevenue, DailyRevenue, ExecSummaryData } from './types'
import { parseTransactionDate } from './filter-utils'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function fmtPeakDate(dateStr: string): string {
  const d = parseTransactionDate(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = d.toLocaleString('en-US', { month: 'short' })
  return `${day}-${mon}-${d.getFullYear()}`
}

export function filterByDateRange(
  transactions: Transaction[],
  dateFrom: string,
  dateTo: string,
): Transaction[] {
  if (!dateFrom && !dateTo) return transactions
  return transactions.filter(t => {
    const d = parseTransactionDate(t.date)
    if (dateFrom) {
      const [fy, fm, fd] = dateFrom.split('-').map(Number)
      if (d < new Date(fy, fm - 1, fd)) return false
    }
    if (dateTo) {
      const [ty, tm, td] = dateTo.split('-').map(Number)
      const to = new Date(ty, tm - 1, td)
      to.setHours(23, 59, 59, 999)
      if (d > to) return false
    }
    return true
  })
}

export function aggregateTransactions(
  transactions: Transaction[],
  categoryMap: Record<string, string>,
): ExecSummaryData {
  if (transactions.length === 0) {
    return {
      kpis: { totalRevenue: 0, totalTransactions: 0, unitsSold: 0, avgDailyRevenue: 0, peakDayRevenue: 0, peakDayDate: '—', activeMachines: 0, activeLocations: 0 },
      monthly: MONTHS.map(month => ({ month, revenue: 0, transactions: 0, unitsSold: 0, momGrowth: null })),
      products: [],
      machines: [],
      weekday: { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 },
      daily: [],
    }
  }

  const totalRevenue = transactions.reduce((s, t) => s + t.unitPrice * t.qty, 0)
  const totalTransactions = transactions.length
  const unitsSold = transactions.reduce((s, t) => s + t.qty, 0)

  // Days span for avg daily (filter NaN in case of malformed dates)
  const timestamps = transactions.map(t => parseTransactionDate(t.date).getTime()).filter(ts => !isNaN(ts))
  const minTs = timestamps.length ? Math.min(...timestamps) : 0
  const maxTs = timestamps.length ? Math.max(...timestamps) : 0
  const days = Math.max(1, Math.round((maxTs - minTs) / 86400000) + 1)
  const avgDailyRevenue = totalRevenue / days

  // Peak day
  const byDay: Record<string, number> = {}
  for (const t of transactions) {
    byDay[t.date] = (byDay[t.date] ?? 0) + t.unitPrice * t.qty
  }
  const [peakDayDate, peakDayRevenue] = Object.entries(byDay).reduce(
    (best, [date, rev]) => rev > best[1] ? [date, rev] : best,
    ['', 0]
  )

  const kpis: KPIs = {
    totalRevenue,
    totalTransactions,
    unitsSold,
    avgDailyRevenue,
    peakDayRevenue,
    peakDayDate: peakDayDate ? fmtPeakDate(peakDayDate) : '—',
    activeMachines: new Set(transactions.map(t => t.machine)).size,
    activeLocations: new Set(transactions.map(t => t.location)).size,
  }

  // Monthly
  const monthlyAcc: Record<string, { revenue: number; transactions: number; unitsSold: number }> = {}
  for (const t of transactions) {
    const month = MONTHS[parseTransactionDate(t.date).getMonth()]
    if (!monthlyAcc[month]) monthlyAcc[month] = { revenue: 0, transactions: 0, unitsSold: 0 }
    monthlyAcc[month].revenue += t.unitPrice * t.qty
    monthlyAcc[month].transactions += 1
    monthlyAcc[month].unitsSold += t.qty
  }
  const monthly: MonthlyRow[] = MONTHS.map((month, i) => {
    const data = monthlyAcc[month] ?? { revenue: 0, transactions: 0, unitsSold: 0 }
    const prev = i > 0 ? monthlyAcc[MONTHS[i - 1]] : null
    let momGrowth: string | null = null
    if (prev && prev.revenue > 0) {
      const pct = ((data.revenue - prev.revenue) / prev.revenue) * 100
      momGrowth = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'
    }
    return { month, ...data, momGrowth }
  })

  // Products
  const productAcc: Record<string, { revenue: number; unitsSold: number }> = {}
  for (const t of transactions) {
    if (!productAcc[t.product]) productAcc[t.product] = { revenue: 0, unitsSold: 0 }
    productAcc[t.product].revenue += t.unitPrice * t.qty
    productAcc[t.product].unitsSold += t.qty
  }
  const products: ProductRow[] = Object.entries(productAcc)
    .map(([product, d]) => ({
      product,
      revenue: d.revenue,
      unitsSold: d.unitsSold,
      revenueShare: totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0,
      avgUnitPrice: d.unitsSold > 0 ? d.revenue / d.unitsSold : 0,
      category: categoryMap[product] ?? 'Other',
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // Machines
  const machineAcc: Record<string, { location: string; revenue: number; unitsSold: number }> = {}
  for (const t of transactions) {
    if (!machineAcc[t.machine]) machineAcc[t.machine] = { location: t.location, revenue: 0, unitsSold: 0 }
    machineAcc[t.machine].revenue += t.unitPrice * t.qty
    machineAcc[t.machine].unitsSold += t.qty
  }
  const machines: MachineRow[] = Object.entries(machineAcc)
    .map(([machine, d]) => ({
      machine,
      location: d.location,
      revenue: d.revenue,
      unitsSold: d.unitsSold,
      revShare: totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  // Weekday
  const wd = [0, 0, 0, 0, 0, 0, 0]
  for (const t of transactions) {
    const day = parseTransactionDate(t.date).getDay()
    if (!isNaN(day)) wd[day] += t.unitPrice * t.qty
  }
  const weekday: WeekdayRevenue = { sun: wd[0], mon: wd[1], tue: wd[2], wed: wd[3], thu: wd[4], fri: wd[5], sat: wd[6] }

  // Daily (individual date → revenue, sorted chronologically)
  const dailyAcc: Record<string, number> = {}
  for (const t of transactions) {
    if (t.date) dailyAcc[t.date] = (dailyAcc[t.date] ?? 0) + t.unitPrice * t.qty
  }
  const daily: DailyRevenue[] = Object.entries(dailyAcc)
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => parseTransactionDate(a.date).getTime() - parseTransactionDate(b.date).getTime())

  return { kpis, monthly, products, machines, weekday, daily }
}
