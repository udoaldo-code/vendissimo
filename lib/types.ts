export type KPIs = {
  totalRevenue: number
  totalTransactions: number
  unitsSold: number
  avgDailyRevenue: number
  peakDayRevenue: number
  peakDayDate: string
  activeMachines: number
  activeLocations: number
}

export type MonthlyRow = {
  month: string
  revenue: number
  transactions: number
  unitsSold: number
  momGrowth: string | null
}

export type ProductRow = {
  product: string
  revenue: number
  unitsSold: number
  revenueShare: number
  avgUnitPrice: number
  category: string
}

export type MachineRow = {
  location: string
  machine: string
  revenue: number
  unitsSold: number
  revShare: number
}

export type WeekdayRevenue = {
  sun: number
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
}

export type DailyRevenue = { date: string; revenue: number }

export type ExecSummaryData = {
  kpis: KPIs
  monthly: MonthlyRow[]
  products: ProductRow[]
  machines: MachineRow[]
  weekday: WeekdayRevenue
  daily: DailyRevenue[]
}

export type Transaction = {
  machine: string
  location: string
  product: string
  unitPrice: number
  qty: number
  time: string
  date: string
}

export type FilterState = {
  search: string
  machine: string
  location: string
  product: string
  dateFrom: string
  dateTo: string
}
