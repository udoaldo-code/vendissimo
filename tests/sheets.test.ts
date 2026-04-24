import { parseExecSummary, parseDatabase } from '@/lib/sheets'

const MINI_EXEC_CSV = `,,,,,,,
,🏪  VENDISSIMO — EXECUTIVE SALES DASHBOARD  |  2026 YTD,,,,,,
,Period: 01 Jan 2026 – 23 Apr 2026,,,,,,
,,,,,,,
,  ▌ KEY PERFORMANCE INDICATORS (YTD — AUTO-UPDATED),,,,,,
,TOTAL REVENUE,TOTAL TRANSACTIONS,UNITS SOLD,AVG DAILY REVENUE,PEAK DAY REVENUE,ACTIVE MACHINES,ACTIVE LOCATIONS
,"$8,733.00","12,736","12,736",$78.68,$193.00,8,2
,,,,,,,
,,,,> Peak: 08-Apr-2026,,,
,  ▌ MONTHLY REVENUE SUMMARY  (auto-updates as new data added),,,,,,
,Month,Revenue (USD),Buy Transactions,Units Sold,MoM Growth,,
,January,$574.50,589,589,—,,
,February,$655.80,758,758,+14.2%,,
,March,"$4,098.20","6,278","6,278",+524.9%,,
,April,"$3,404.50","5,111","5,111",-16.9%,,
,May,$0.00,0,0,-100.0%,,
,June,$0.00,0,0,N/A,,
,July,$0.00,0,0,N/A,,
,August,$0.00,0,0,N/A,,
,September,$0.00,0,0,N/A,,
,October,$0.00,0,0,N/A,,
,November,$0.00,0,0,N/A,,
,December,$0.00,0,0,N/A,,
,TOTAL,"$8,733.00","12,736","12,736",,,
,,,,,,,
,  ▌ PRODUCT PERFORMANCE  (auto-ranked by revenue),,,,,,
,Product,Revenue (USD),Units Sold,Revenue Share,Avg Unit Price,Category,
,Hi-Tech-Water,"$2,125.50","6,057",16.7%,$0.35,Water,
,OLATTE,"$2,121.20","2,109",16.7%,$1.01,Energy Drink,
,,,,,,,
,  ▌ LOCATION & MACHINE PERFORMANCE  (auto-updates),,,,,,
,Location / Machine,Revenue (USD),Units Sold,Rev Share,Avg Unit Price,Active Days,
,📍 HOSPITAL,"$6,367.50","10,133",50.0%,,,
,    ↳ V4 - NPH - Outpatient Waiting Area 2,"$2,080.40","3,370",16.3%,$0.62,#DIV/0!,
,📍 AIRPORT,"$2,365.50","2,603",18.6%,,,
,    ↳ V1 - KHMER House Entrance 1,"$2,011.00","2,162",15.8%,$0.93,#DIV/0!,
,,,,,,,
,  ▌ REVENUE BY DAY OF WEEK  (auto-updates),,,,,,
,Sun,Mon,Tue,Wed,Thu,Fri,Sat
,"$1,384.2","$1,274.6","$1,281.8","$1,171.4","$1,298.9","$1,184.3","$1,137.8"
,,,,,,,`

const MINI_DB_CSV = `,Vendissimo Daily Sales 2026,,,,,,
,,,,,,,
,,,,,,,
,Name of Machine,Location,Product,Unit Price,Qty,Time,Date
,V1 - KHMER House Entrance 1,Airport,OLATTE,1.5,1,2026-01-01 22:33:04,1/1/2026
,V1 - KHMER House Entrance 1,Airport,BACCHUS,1.5,2,2026-01-01 22:33:04,1/1/2026
,V2 - KHMER House Entrance 2,Airport,Hi-Tech-Water,0.5,3,2026-01-02 10:00:00,1/2/2026`

describe('parseExecSummary', () => {
  it('parses KPIs correctly', () => {
    const data = parseExecSummary(MINI_EXEC_CSV)
    expect(data.kpis.totalRevenue).toBeCloseTo(8733)
    expect(data.kpis.totalTransactions).toBe(12736)
    expect(data.kpis.unitsSold).toBe(12736)
    expect(data.kpis.avgDailyRevenue).toBeCloseTo(78.68)
    expect(data.kpis.peakDayRevenue).toBeCloseTo(193)
    expect(data.kpis.activeMachines).toBe(8)
    expect(data.kpis.activeLocations).toBe(2)
    expect(data.kpis.peakDayDate).toBe('08-Apr-2026')
  })

  it('parses monthly rows', () => {
    const data = parseExecSummary(MINI_EXEC_CSV)
    expect(data.monthly).toHaveLength(12)
    expect(data.monthly[0]).toEqual({
      month: 'January',
      revenue: 574.50,
      transactions: 589,
      unitsSold: 589,
      momGrowth: null,
    })
    expect(data.monthly[1].momGrowth).toBe('+14.2%')
    expect(data.monthly[4].momGrowth).toBe('-100.0%') // valid growth figure
    expect(data.monthly[5].momGrowth).toBeNull() // June: N/A → null
  })

  it('parses products', () => {
    const data = parseExecSummary(MINI_EXEC_CSV)
    expect(data.products).toHaveLength(2)
    expect(data.products[0].product).toBe('Hi-Tech-Water')
    expect(data.products[0].revenue).toBeCloseTo(2125.5)
    expect(data.products[0].category).toBe('Water')
  })

  it('parses machines with location context', () => {
    const data = parseExecSummary(MINI_EXEC_CSV)
    expect(data.machines).toHaveLength(2)
    expect(data.machines[0].location).toBe('HOSPITAL')
    expect(data.machines[0].machine).toBe('V4 - NPH - Outpatient Waiting Area 2')
    expect(data.machines[0].revenue).toBeCloseTo(2080.4)
    expect(data.machines[1].location).toBe('AIRPORT')
  })

  it('parses weekday revenue', () => {
    const data = parseExecSummary(MINI_EXEC_CSV)
    expect(data.weekday.sun).toBeCloseTo(1384.2)
    expect(data.weekday.sat).toBeCloseTo(1137.8)
  })
})

describe('parseDatabase', () => {
  it('parses transaction rows', () => {
    const txs = parseDatabase(MINI_DB_CSV)
    expect(txs).toHaveLength(3)
    expect(txs[0]).toEqual({
      machine: 'V1 - KHMER House Entrance 1',
      location: 'Airport',
      product: 'OLATTE',
      unitPrice: 1.5,
      qty: 1,
      time: '2026-01-01 22:33:04',
      date: '1/1/2026',
    })
    expect(txs[1].qty).toBe(2)
    expect(txs[2].unitPrice).toBeCloseTo(0.5)
  })

  it('skips header rows', () => {
    const txs = parseDatabase(MINI_DB_CSV)
    expect(txs.every(t => t.machine !== 'Name of Machine')).toBe(true)
  })
})
