import { parseCSV, parseNum, findSectionRow } from './csv-utils'
import type { ExecSummaryData, KPIs, MonthlyRow, ProductRow, MachineRow, WeekdayRevenue, Transaction } from './types'

const EXEC_URL =
  'https://docs.google.com/spreadsheets/d/1K68zOQ5iHvIgt4ZIF6xSaqzx5yyTJuhV/export?format=csv'
const DB_URL =
  'https://docs.google.com/spreadsheets/d/1K68zOQ5iHvIgt4ZIF6xSaqzx5yyTJuhV/export?format=csv&gid=602546910'

export async function fetchExecutiveSummary(): Promise<ExecSummaryData> {
  const res = await fetch(EXEC_URL, { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`Exec CSV fetch failed: ${res.status}`)
  return parseExecSummary(await res.text())
}

export async function fetchDatabase(): Promise<Transaction[]> {
  const res = await fetch(DB_URL, { next: { revalidate: 1800 } })
  if (!res.ok) throw new Error(`Database CSV fetch failed: ${res.status}`)
  return parseDatabase(await res.text())
}

export function parseExecSummary(text: string): ExecSummaryData {
  const rows = parseCSV(text)

  // KPIs
  const kpiIdx = findSectionRow(rows, 'KEY PERFORMANCE INDICATORS')
  const kpiVals = rows[kpiIdx + 2]
  const peakRow = rows[kpiIdx + 4]
  const kpis: KPIs = {
    totalRevenue: parseNum(kpiVals[1]),
    totalTransactions: parseNum(kpiVals[2]),
    unitsSold: parseNum(kpiVals[3]),
    avgDailyRevenue: parseNum(kpiVals[4]),
    peakDayRevenue: parseNum(kpiVals[5]),
    activeMachines: parseNum(kpiVals[6]),
    activeLocations: parseNum(kpiVals[7]),
    peakDayDate: (peakRow?.[4] ?? '').replace('> Peak: ', '').trim(),
  }

  // Monthly (12 rows after header row)
  const monthlyIdx = findSectionRow(rows, 'MONTHLY REVENUE SUMMARY')
  const monthly: MonthlyRow[] = []
  for (let i = monthlyIdx + 2; i < monthlyIdx + 14; i++) {
    const row = rows[i]
    if (!row?.[1] || row[1] === 'TOTAL') continue
    const growth = row[5]
    monthly.push({
      month: row[1],
      revenue: parseNum(row[2]),
      transactions: parseNum(row[3]),
      unitsSold: parseNum(row[4]),
      momGrowth: !growth || growth === '—' || growth === 'N/A' ? null : growth,
    })
  }

  // Products (rows until first empty col-1)
  const productIdx = findSectionRow(rows, 'PRODUCT PERFORMANCE')
  const products: ProductRow[] = []
  for (let i = productIdx + 2; ; i++) {
    const row = rows[i]
    if (!row?.[1]) break
    products.push({
      product: row[1],
      revenue: parseNum(row[2]),
      unitsSold: parseNum(row[3]),
      revenueShare: parseNum(row[4]),
      avgUnitPrice: parseNum(row[5]),
      category: row[6] ?? '',
    })
  }

  // Machines (track current location from 📍 rows)
  const machineIdx = findSectionRow(rows, 'LOCATION & MACHINE PERFORMANCE')
  const machines: MachineRow[] = []
  let currentLocation = ''
  for (let i = machineIdx + 2; ; i++) {
    const row = rows[i]
    if (!row?.[1]) break
    const name = row[1].trim()
    if (name.startsWith('📍')) {
      currentLocation = name.replace('📍', '').trim()
    } else if (name.includes('↳')) {
      machines.push({
        location: currentLocation,
        machine: name.replace(/.*↳\s*/, '').trim(),
        revenue: parseNum(row[2]),
        unitsSold: parseNum(row[3]),
        revShare: parseNum(row[4]),
      })
    }
  }

  // Weekday
  const weekdayIdx = findSectionRow(rows, 'REVENUE BY DAY OF WEEK')
  const wdVals = rows[weekdayIdx + 2]
  const weekday: WeekdayRevenue = {
    sun: parseNum(wdVals?.[1] ?? ''),
    mon: parseNum(wdVals?.[2] ?? ''),
    tue: parseNum(wdVals?.[3] ?? ''),
    wed: parseNum(wdVals?.[4] ?? ''),
    thu: parseNum(wdVals?.[5] ?? ''),
    fri: parseNum(wdVals?.[6] ?? ''),
    sat: parseNum(wdVals?.[7] ?? ''),
  }

  return { kpis, monthly, products, machines, weekday, daily: [], dailySales: { dates: [], machines: [], locationTotals: {}, grandTotal: { daily: {}, totalQty: 0, totalRev: 0 } } }
}

export function parseDatabase(text: string): Transaction[] {
  const rows = parseCSV(text)
  // Row index 3 is the column header: Name of Machine, Location, Product, Unit Price, Qty, Time, Date
  // Data starts at row index 4
  const transactions: Transaction[] = []
  for (let i = 4; i < rows.length; i++) {
    const row = rows[i]
    if (!row?.[1] || row[1] === 'Name of Machine') continue
    transactions.push({
      machine: row[1],
      location: row[2],
      product: row[3],
      unitPrice: parseNum(row[4]),
      qty: parseNum(row[5]),
      time: row[6],
      date: row[7],
    })
  }
  return transactions
}
