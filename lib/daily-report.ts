import { fetchTransactions, getLastSyncTime } from './clickhouse'
import { aggregateTransactions } from './aggregate'
import { getKpiTarget } from './kpi'

export type DailyReportMachine = {
  id: string
  name: string
  location: string
  qty: number
  revenue: number
  kpiStatus: 'met' | 'below' | 'idle'
}

export type DailyReport = {
  date: string
  kpi: {
    totalQty: number
    totalRevenueUsd: number
    targetPerMachine: number
    machinesAchieved: number
    machinesBelow: number
  }
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  topMachines: DailyReportMachine[]
  bottomMachines: DailyReportMachine[]
  perMachine: DailyReportMachine[]
  lastSync: string
  generatedAt: string
}

export async function getDailyReportData(): Promise<DailyReport> {
  const transactions = await fetchTransactions()
  const data = aggregateTransactions(transactions, {}, 'USD')
  const target = getKpiTarget()

  const allDates = data.dailySales.dates
  const today = allDates[allDates.length - 1] ?? new Date().toISOString().slice(0, 10)
  const lastSync = getLastSyncTime() ?? ''

  const perMachine: DailyReportMachine[] = data.dailySales.machines.map(m => {
    const last = m.daily[today] ?? { qty: 0, rev: 0 }
    const status: 'met' | 'below' | 'idle' =
      last.qty <= 0 ? 'idle' : last.qty >= target ? 'met' : 'below'
    return {
      id: m.deviceId || m.machine,
      name: m.machine,
      location: m.location,
      qty: last.qty,
      revenue: last.rev,
      kpiStatus: status,
    }
  })

  const topProducts = data.products.slice(0, 5).map(p => ({
    name: p.product, qty: p.unitsSold, revenue: p.revenue,
  }))
  const rankedByQty = [...perMachine].sort((a, b) => b.qty - a.qty)
  const topMachines = rankedByQty.slice(0, 3)
  const bottomMachines = rankedByQty.filter(m => m.qty > 0).slice(-3).reverse()

  return {
    date: today,
    kpi: {
      totalQty: perMachine.reduce((s, m) => s + m.qty, 0),
      totalRevenueUsd: perMachine.reduce((s, m) => s + m.revenue, 0),
      targetPerMachine: target,
      machinesAchieved: perMachine.filter(m => m.kpiStatus === 'met').length,
      machinesBelow: perMachine.filter(m => m.kpiStatus === 'below').length,
    },
    topProducts,
    topMachines,
    bottomMachines,
    perMachine,
    lastSync,
    generatedAt: new Date().toISOString(),
  }
}
