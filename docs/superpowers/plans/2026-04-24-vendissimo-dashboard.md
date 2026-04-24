# Vendissimo Vending Machine KH Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js 15 dashboard with Executive Summary and Database pages, fetching live data from public Google Sheets CSV exports.

**Architecture:** Server components fetch CSV data from Google Sheets export URLs with 30-min ISR caching. A Server Action (`revalidateSheets`) invalidates cache on manual refresh. Recharts charts and database filter/table are client components that receive typed data as props.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, Recharts

---

## File Map

```
lib/
  types.ts              — all shared TypeScript types
  csv-utils.ts          — parseCSVLine, parseCSV, parseNum, findSectionRow
  sheets.ts             — fetchExecutiveSummary(), fetchDatabase(), parse functions
  filter-utils.ts       — filterTransactions(), exportToCSV(), parseTransactionDate()

app/
  globals.css           — Tailwind import + brand body styles
  layout.tsx            — root layout with Sidebar
  page.tsx              — redirect to /executive-summary
  actions.ts            — revalidateSheets() Server Action
  error.tsx             — root error boundary
  executive-summary/
    page.tsx            — Server Component: fetches + assembles exec page
  database/
    page.tsx            — Server Component: fetches transactions, passes to client

components/
  Sidebar.tsx           — nav sidebar (client — uses usePathname)
  RefreshButton.tsx     — manual refresh (client — calls Server Action + router.refresh)
  KPICard.tsx           — reusable KPI display card
  executive-summary/
    KPISidebar.tsx      — left sidebar: 4 KPI cards + peak day card
    MonthlyRevenueChart.tsx  — Recharts BarChart (client)
    LocationPieChart.tsx     — Recharts PieChart (client)
    WeekdayBarChart.tsx      — Recharts BarChart (client)
    TopProductsTable.tsx     — ranked product list with progress bars
    MachinePerformanceTable.tsx — grouped by location
  database/
    SummaryBar.tsx      — live totals that update as filters change (client)
    FilterBar.tsx       — search + dropdowns + date range (client)
    TransactionsTable.tsx — sortable, paginated table (client)
    ExportCSVButton.tsx — downloads filtered rows as CSV (client)

tests/
  csv-utils.test.ts
  sheets.test.ts
  filter-utils.test.ts

jest.config.ts
jest.setup.ts
```

---

## Task 1: Scaffold project

**Files:**
- Initialize: `/Users/user/vendissimo dashboard/` (existing empty dir)
- Create: `jest.config.ts`, `jest.setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd "/Users/user/vendissimo dashboard"
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*" --yes
```

Expected: Project scaffolded with `app/`, `components/`, `public/`, `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`.

- [ ] **Step 2: Install dependencies**

```bash
cd "/Users/user/vendissimo dashboard"
npm install recharts
npm install --save-dev jest jest-environment-jsdom @testing-library/jest-dom
```

- [ ] **Step 3: Create Jest config**

Create `jest.config.ts`:
```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:
```ts
// intentionally empty — extend here if DOM tests added later
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 5: Verify scaffold**

```bash
cd "/Users/user/vendissimo dashboard"
npm run build 2>&1 | tail -5
```

Expected: Build succeeds (or only lint warnings, no errors).

- [ ] **Step 6: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git init
git add package.json package-lock.json next.config.ts tsconfig.json postcss.config.mjs jest.config.ts jest.setup.ts
git commit -m "chore: scaffold Next.js 15 project with Jest"
```

---

## Task 2: Types + CSS theme

**Files:**
- Create: `lib/types.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Create type definitions**

Create `lib/types.ts`:
```ts
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

export type ExecSummaryData = {
  kpis: KPIs
  monthly: MonthlyRow[]
  products: ProductRow[]
  machines: MachineRow[]
  weekday: WeekdayRevenue
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
```

- [ ] **Step 2: Replace globals.css with brand theme**

Replace `app/globals.css` entirely:
```css
@import "tailwindcss";

body {
  background-color: #1c1917;
  color: #e7e5e4;
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

* {
  box-sizing: border-box;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #1c1917;
}

::-webkit-scrollbar-thumb {
  background: #44403c;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #57534e;
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add lib/types.ts app/globals.css
git commit -m "feat: add types and brand theme"
```

---

## Task 3: CSV utilities (TDD)

**Files:**
- Create: `lib/csv-utils.ts`
- Create: `tests/csv-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/csv-utils.test.ts`:
```ts
import { parseCSVLine, parseNum, parseCSV, findSectionRow } from '@/lib/csv-utils'

describe('parseCSVLine', () => {
  it('splits simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields containing commas', () => {
    expect(parseCSVLine('"$8,733.00","12,736",8')).toEqual(['$8,733.00', '12,736', '8'])
  })

  it('trims whitespace from fields', () => {
    expect(parseCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })

  it('handles empty leading field (column A always empty)', () => {
    expect(parseCSVLine(',TOTAL REVENUE,TOTAL TRANSACTIONS')).toEqual([
      '',
      'TOTAL REVENUE',
      'TOTAL TRANSACTIONS',
    ])
  })
})

describe('parseNum', () => {
  it('strips dollar sign and commas', () => {
    expect(parseNum('$8,733.00')).toBeCloseTo(8733)
  })

  it('strips percent sign', () => {
    expect(parseNum('16.7%')).toBeCloseTo(16.7)
  })

  it('parses plain number', () => {
    expect(parseNum('78.68')).toBeCloseTo(78.68)
  })

  it('returns 0 for empty string', () => {
    expect(parseNum('')).toBe(0)
  })

  it('returns 0 for DIV/0 error', () => {
    expect(parseNum('#DIV/0!')).toBe(0)
  })
})

describe('parseCSV', () => {
  it('splits text into rows of fields', () => {
    const text = 'a,b\nc,d'
    expect(parseCSV(text)).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('findSectionRow', () => {
  it('finds row index by marker string', () => {
    const rows = [
      ['', 'other'],
      ['', 'KEY PERFORMANCE INDICATORS (YTD)'],
      ['', 'TOTAL REVENUE'],
    ]
    expect(findSectionRow(rows, 'KEY PERFORMANCE INDICATORS')).toBe(1)
  })

  it('returns -1 when not found', () => {
    const rows = [['', 'something']]
    expect(findSectionRow(rows, 'MISSING')).toBe(-1)
  })
})
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
cd "/Users/user/vendissimo dashboard"
npm test -- --testPathPattern=csv-utils 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/lib/csv-utils'`

- [ ] **Step 3: Implement csv-utils**

Create `lib/csv-utils.ts`:
```ts
export function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

export function parseNum(s: string): number {
  const cleaned = s.replace(/[$,%]/g, '').replace(/[^0-9.-]/g, '')
  return parseFloat(cleaned) || 0
}

export function parseCSV(text: string): string[][] {
  return text.split('\n').map(parseCSVLine)
}

export function findSectionRow(rows: string[][], marker: string): number {
  return rows.findIndex(row => row.some(cell => cell.includes(marker)))
}
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
cd "/Users/user/vendissimo dashboard"
npm test -- --testPathPattern=csv-utils 2>&1 | tail -10
```

Expected: PASS — 9 tests pass

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add lib/csv-utils.ts tests/csv-utils.test.ts
git commit -m "feat: add CSV parsing utilities with tests"
```

---

## Task 4: Executive Summary parser (TDD)

**Files:**
- Create: `lib/sheets.ts`
- Create: `tests/sheets.test.ts`

The exec summary CSV has this multi-section structure (column A is always empty):
```
row 0:  (empty)
row 1:  🏪 VENDISSIMO — EXECUTIVE SALES DASHBOARD | 2026 YTD
row 2:  Period: 01 Jan 2026...
row 3:  (empty)
row 4:  ▌ KEY PERFORMANCE INDICATORS (YTD — AUTO-UPDATED)   ← findSectionRow marker
row 5:  TOTAL REVENUE, TOTAL TRANSACTIONS, ...               ← sectionIdx+1
row 6:  "$8,733.00", "12,736", "12,736", $78.68, $193.00, 8, 2  ← sectionIdx+2
row 7:  (empty)
row 8:  (empty col4: "> Peak: 08-Apr-2026")                 ← sectionIdx+4
row 9:  ▌ MONTHLY REVENUE SUMMARY                           ← findSectionRow marker
row 10: Month, Revenue (USD), Buy Transactions, ...         ← +1 (headers)
row 11: January, $574.50, 589, 589, —                      ← +2 (data starts)
...
row 22: December...                                         ← +13
row 23: TOTAL...                                            ← +14 (skip)
row 24: (empty)
row 25: ▌ PRODUCT PERFORMANCE                               ← findSectionRow marker
row 26: Product, Revenue (USD), ...                         ← +1 (headers)
row 27+: product rows until empty row
...
     ▌ LOCATION & MACHINE PERFORMANCE                       ← findSectionRow marker
     Location / Machine, Revenue (USD), ...                 ← +1 (headers)
     📍 HOSPITAL, ...                                       ← location total (skip rev for machines)
         ↳ V4 - NPH ..., $2,080, ...                       ← machine row
...
     ▌ REVENUE BY DAY OF WEEK                               ← findSectionRow marker
     Sun, Mon, Tue, Wed, Thu, Fri, Sat                      ← +1 (labels, skip)
     "$1,384.2", ...                                        ← +2 (values)
```

- [ ] **Step 1: Write failing tests**

Create `tests/sheets.test.ts`:
```ts
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
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
cd "/Users/user/vendissimo dashboard"
npm test -- --testPathPattern=sheets 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/lib/sheets'`

- [ ] **Step 3: Implement lib/sheets.ts**

Create `lib/sheets.ts`:
```ts
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

  return { kpis, monthly, products, machines, weekday }
}

export function parseDatabase(text: string): Transaction[] {
  const rows = parseCSV(text)
  // Row 3 (0-indexed) is the header row: Name of Machine, Location, Product, Unit Price, Qty, Time, Date
  // Data starts at row 4
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
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
cd "/Users/user/vendissimo dashboard"
npm test -- --testPathPattern=sheets 2>&1 | tail -15
```

Expected: PASS — all describe blocks pass

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add lib/sheets.ts tests/sheets.test.ts
git commit -m "feat: add Google Sheets CSV parsers with tests"
```

---

## Task 5: Root layout + sidebar + actions

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`
- Create: `app/actions.ts`
- Create: `components/Sidebar.tsx`

- [ ] **Step 1: Create Server Action**

Create `app/actions.ts`:
```ts
'use server'

import { revalidatePath } from 'next/cache'

export async function revalidateSheets(): Promise<void> {
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 2: Create Sidebar component**

Create `components/Sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/executive-summary', label: 'Executive Summary', icon: '📊' },
  { href: '/database', label: 'Database', icon: '🗃️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-[#292524] border-r border-[#44403c] flex flex-col">
      <div className="p-4 border-b border-[#44403c]">
        <p className="text-[#f97316] font-bold text-sm tracking-wide">🏪 VENDISSIMO</p>
        <p className="text-[#a8a29e] text-xs mt-0.5">Vending Machine KH</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV_LINKS.map(link => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30'
                  : 'text-[#a8a29e] hover:text-[#e7e5e4] hover:bg-[#44403c]'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-[#44403c]">
        <p className="text-[#57534e] text-xs">Data: Google Sheets · Live</p>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Update root layout**

Replace `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vendissimo KH Dashboard',
  description: 'Vending Machine Sales Dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} flex h-screen overflow-hidden bg-[#1c1917]`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Update root page (redirect)**

Replace `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/executive-summary')
}
```

- [ ] **Step 5: Verify dev server starts**

```bash
cd "/Users/user/vendissimo dashboard"
npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

Expected: `200` (or `307` for redirect)

```bash
kill %1
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add app/layout.tsx app/page.tsx app/actions.ts components/Sidebar.tsx
git commit -m "feat: add root layout, sidebar nav, and revalidate action"
```

---

## Task 6: Shared components — RefreshButton + KPICard

**Files:**
- Create: `components/RefreshButton.tsx`
- Create: `components/KPICard.tsx`

- [ ] **Step 1: Create RefreshButton**

Create `components/RefreshButton.tsx`:
```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { revalidateSheets } from '@/app/actions'

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(async () => {
      await revalidateSheets()
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-[#292524] border border-[#44403c] text-[#a8a29e] hover:text-[#e7e5e4] hover:border-[#57534e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className={isPending ? 'animate-spin' : ''}>↻</span>
      {isPending ? 'Refreshing…' : 'Refresh Data'}
    </button>
  )
}
```

- [ ] **Step 2: Create KPICard**

Create `components/KPICard.tsx`:
```tsx
type KPICardProps = {
  label: string
  value: string
  sub?: string
  accentColor?: string
}

export function KPICard({ label, value, sub, accentColor = '#f97316' }: KPICardProps) {
  return (
    <div
      className="bg-[#292524] rounded-lg p-4 border-l-4"
      style={{ borderLeftColor: accentColor }}
    >
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[#e7e5e4] text-xl font-bold" style={{ color: accentColor }}>
        {value}
      </p>
      {sub && <p className="text-[#57534e] text-xs mt-1">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/RefreshButton.tsx components/KPICard.tsx
git commit -m "feat: add RefreshButton and KPICard shared components"
```

---

## Task 7: Executive Summary — KPI Sidebar

**Files:**
- Create: `components/executive-summary/KPISidebar.tsx`

- [ ] **Step 1: Create KPISidebar**

Create `components/executive-summary/KPISidebar.tsx`:
```tsx
import { KPICard } from '@/components/KPICard'
import type { KPIs } from '@/lib/types'

function fmt(n: number, prefix = '$') {
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function KPISidebar({ kpis }: { kpis: KPIs }) {
  return (
    <div className="flex flex-col gap-3">
      <KPICard
        label="Total Revenue"
        value={fmt(kpis.totalRevenue)}
        sub="YTD 2026"
        accentColor="#f97316"
      />
      <KPICard
        label="Total Transactions"
        value={kpis.totalTransactions.toLocaleString()}
        sub={`${kpis.unitsSold.toLocaleString()} units sold`}
        accentColor="#fbbf24"
      />
      <KPICard
        label="Avg Daily Revenue"
        value={fmt(kpis.avgDailyRevenue)}
        accentColor="#f97316"
      />
      <KPICard
        label="Peak Day Revenue"
        value={fmt(kpis.peakDayRevenue)}
        sub={kpis.peakDayDate}
        accentColor="#ef4444"
      />
      <KPICard
        label="Machines / Locations"
        value={`${kpis.activeMachines} / ${kpis.activeLocations}`}
        accentColor="#fbbf24"
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/executive-summary/KPISidebar.tsx
git commit -m "feat: add KPI sidebar component"
```

---

## Task 8: Executive Summary — Charts

**Files:**
- Create: `components/executive-summary/MonthlyRevenueChart.tsx`
- Create: `components/executive-summary/LocationPieChart.tsx`
- Create: `components/executive-summary/WeekdayBarChart.tsx`

All chart components are `'use client'` (Recharts requires DOM).

- [ ] **Step 1: Create MonthlyRevenueChart**

Create `components/executive-summary/MonthlyRevenueChart.tsx`:
```tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { MonthlyRow } from '@/lib/types'

export function MonthlyRevenueChart({ data }: { data: MonthlyRow[] }) {
  const chartData = data.map(d => ({
    month: d.month.slice(0, 3),
    revenue: d.revenue,
  }))

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-4">Monthly Revenue</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#44403c" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#a8a29e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${v}`}
          />
          <Tooltip
            contentStyle={{ background: '#292524', border: '1px solid #44403c', borderRadius: '6px' }}
            labelStyle={{ color: '#e7e5e4', fontWeight: 600 }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#44403c' }}
          />
          <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Create LocationPieChart**

Create `components/executive-summary/LocationPieChart.tsx`:
```tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { MachineRow } from '@/lib/types'

const COLORS = ['#f97316', '#fbbf24', '#ef4444', '#fb923c']

export function LocationPieChart({ machines }: { machines: MachineRow[] }) {
  const byLocation = machines.reduce<Record<string, number>>((acc, m) => {
    acc[m.location] = (acc[m.location] ?? 0) + m.revenue
    return acc
  }, {})

  const data = Object.entries(byLocation).map(([name, value]) => ({ name, value }))

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-2">Revenue by Location</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#292524', border: '1px solid #44403c', borderRadius: '6px' }}
            labelStyle={{ color: '#e7e5e4' }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
          />
          <Legend
            formatter={value => <span style={{ color: '#a8a29e', fontSize: 11 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Create WeekdayBarChart**

Create `components/executive-summary/WeekdayBarChart.tsx`:
```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { WeekdayRevenue } from '@/lib/types'

export function WeekdayBarChart({ data }: { data: WeekdayRevenue }) {
  const chartData = [
    { day: 'Sun', revenue: data.sun },
    { day: 'Mon', revenue: data.mon },
    { day: 'Tue', revenue: data.tue },
    { day: 'Wed', revenue: data.wed },
    { day: 'Thu', revenue: data.thu },
    { day: 'Fri', revenue: data.fri },
    { day: 'Sat', revenue: data.sat },
  ]
  const maxRev = Math.max(...chartData.map(d => d.revenue))

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-2">Revenue by Day</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fill: '#a8a29e', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#a8a29e', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip
            contentStyle={{ background: '#292524', border: '1px solid #44403c', borderRadius: '6px' }}
            labelStyle={{ color: '#e7e5e4' }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']}
            cursor={{ fill: '#44403c' }}
          />
          <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={30}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.revenue === maxRev ? '#fbbf24' : '#f97316'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/executive-summary/MonthlyRevenueChart.tsx components/executive-summary/LocationPieChart.tsx components/executive-summary/WeekdayBarChart.tsx
git commit -m "feat: add monthly, location, and weekday charts"
```

---

## Task 9: Executive Summary — Tables

**Files:**
- Create: `components/executive-summary/TopProductsTable.tsx`
- Create: `components/executive-summary/MachinePerformanceTable.tsx`

- [ ] **Step 1: Create TopProductsTable**

Create `components/executive-summary/TopProductsTable.tsx`:
```tsx
import type { ProductRow } from '@/lib/types'

const CATEGORY_COLORS: Record<string, string> = {
  'Water': '#38bdf8',
  'Energy Drink': '#f97316',
  'Sports Drink': '#34d399',
  'Dairy': '#fbbf24',
  'Soda': '#a78bfa',
  'Food': '#fb7185',
  'Soy Drink': '#86efac',
}

export function TopProductsTable({ products }: { products: ProductRow[] }) {
  const maxRevenue = products[0]?.revenue ?? 1

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-4">Product Performance</p>
      <div className="space-y-3">
        {products.map((p, i) => (
          <div key={p.product}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[#57534e] text-xs w-5 text-right">{i + 1}</span>
                <span className="text-[#e7e5e4] text-sm">{p.product}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded text-[#1c1917] font-medium"
                  style={{ backgroundColor: CATEGORY_COLORS[p.category] ?? '#a8a29e' }}
                >
                  {p.category}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#a8a29e]">
                <span>{p.unitsSold.toLocaleString()} units</span>
                <span className="text-[#e7e5e4] font-medium w-20 text-right">
                  ${p.revenue.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5" />
              <div className="flex-1 bg-[#44403c] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-[#f97316]"
                  style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                />
              </div>
              <span className="text-[#57534e] text-xs w-10 text-right">{p.revenueShare.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create MachinePerformanceTable**

Create `components/executive-summary/MachinePerformanceTable.tsx`:
```tsx
import type { MachineRow } from '@/lib/types'

export function MachinePerformanceTable({ machines }: { machines: MachineRow[] }) {
  const byLocation = machines.reduce<Record<string, MachineRow[]>>((acc, m) => {
    ;(acc[m.location] ??= []).push(m)
    return acc
  }, {})

  const locationTotals = Object.entries(byLocation).map(([loc, rows]) => ({
    location: loc,
    total: rows.reduce((sum, r) => sum + r.revenue, 0),
    machines: rows,
  }))

  return (
    <div className="bg-[#292524] rounded-lg p-4">
      <p className="text-[#a8a29e] text-xs uppercase tracking-wider mb-4">Machine Performance</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[#57534e] text-xs uppercase">
            <th className="text-left pb-2 font-medium">Machine</th>
            <th className="text-right pb-2 font-medium">Units</th>
            <th className="text-right pb-2 font-medium">Revenue</th>
            <th className="text-right pb-2 font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {locationTotals.map(({ location, total, machines: rows }) => (
            <>
              <tr key={location} className="border-t border-[#44403c]">
                <td colSpan={2} className="py-2 text-[#fbbf24] font-semibold text-xs uppercase tracking-wide">
                  📍 {location}
                </td>
                <td className="py-2 text-right text-[#fbbf24] font-semibold">${total.toFixed(2)}</td>
                <td />
              </tr>
              {rows.map(m => (
                <tr key={m.machine} className="hover:bg-[#44403c]/30">
                  <td className="py-1.5 pl-4 text-[#a8a29e] text-xs">{m.machine}</td>
                  <td className="py-1.5 text-right text-[#a8a29e] text-xs">{m.unitsSold.toLocaleString()}</td>
                  <td className="py-1.5 text-right text-[#e7e5e4] text-xs">${m.revenue.toFixed(2)}</td>
                  <td className="py-1.5 text-right text-[#57534e] text-xs">{m.revShare.toFixed(1)}%</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/executive-summary/TopProductsTable.tsx components/executive-summary/MachinePerformanceTable.tsx
git commit -m "feat: add product and machine performance tables"
```

---

## Task 10: Executive Summary page assembly

**Files:**
- Create: `app/executive-summary/page.tsx`

- [ ] **Step 1: Create Executive Summary page**

Create `app/executive-summary/page.tsx`:
```tsx
import { fetchExecutiveSummary } from '@/lib/sheets'
import { RefreshButton } from '@/components/RefreshButton'
import { KPISidebar } from '@/components/executive-summary/KPISidebar'
import { MonthlyRevenueChart } from '@/components/executive-summary/MonthlyRevenueChart'
import { LocationPieChart } from '@/components/executive-summary/LocationPieChart'
import { WeekdayBarChart } from '@/components/executive-summary/WeekdayBarChart'
import { TopProductsTable } from '@/components/executive-summary/TopProductsTable'
import { MachinePerformanceTable } from '@/components/executive-summary/MachinePerformanceTable'

export default async function ExecSummaryPage() {
  const data = await fetchExecutiveSummary()

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#e7e5e4] text-xl font-bold">Executive Summary</h1>
          <p className="text-[#a8a29e] text-xs mt-0.5">
            Period: 01 Jan 2026 – present · All figures in USD
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Layout B: KPI sidebar left, charts right */}
      <div className="flex gap-6">
        {/* Left: KPI sidebar */}
        <div className="w-52 shrink-0">
          <KPISidebar kpis={data.kpis} />
        </div>

        {/* Right: charts + tables */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <MonthlyRevenueChart data={data.monthly} />
          <div className="grid grid-cols-2 gap-4">
            <LocationPieChart machines={data.machines} />
            <WeekdayBarChart data={data.weekday} />
          </div>
          <TopProductsTable products={data.products} />
          <MachinePerformanceTable machines={data.machines} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Start dev server and verify page**

```bash
cd "/Users/user/vendissimo dashboard"
npm run dev
```

Open `http://localhost:3000` in browser. Verify:
- Redirects to `/executive-summary`
- KPI sidebar shows 5 cards (revenue, transactions, avg/day, peak day, machines/locations)
- Monthly bar chart renders with Jan–Apr bars
- Location pie chart shows Hospital / Airport segments
- Weekday bar chart shows Sun highlighted in amber (peak day)
- Product table shows ranked products with progress bars
- Machine table shows grouped by location
- Refresh button visible, clickable

- [ ] **Step 3: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add app/executive-summary/page.tsx
git commit -m "feat: assemble executive summary page"
```

---

## Task 11: Database filter logic (TDD)

**Files:**
- Create: `lib/filter-utils.ts`
- Create: `tests/filter-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/filter-utils.test.ts`:
```ts
import { filterTransactions, exportToCSVString, parseTransactionDate } from '@/lib/filter-utils'
import type { Transaction, FilterState } from '@/lib/types'

const SAMPLE: Transaction[] = [
  { machine: 'V1 - KHMER House', location: 'Airport', product: 'OLATTE', unitPrice: 1.5, qty: 1, time: '2026-01-01 10:00:00', date: '1/1/2026' },
  { machine: 'V1 - KHMER House', location: 'Airport', product: 'BACCHUS', unitPrice: 1.5, qty: 2, time: '2026-01-02 11:00:00', date: '1/2/2026' },
  { machine: 'V4 - NPH', location: 'Hospital', product: 'Hi-Tech-Water', unitPrice: 0.5, qty: 3, time: '2026-02-01 09:00:00', date: '2/1/2026' },
]

const EMPTY_FILTER: FilterState = {
  search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '',
}

describe('filterTransactions', () => {
  it('returns all rows when no filters set', () => {
    expect(filterTransactions(SAMPLE, EMPTY_FILTER)).toHaveLength(3)
  })

  it('filters by machine name (partial match)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, machine: 'V1 - KHMER House' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.machine === 'V1 - KHMER House')).toBe(true)
  })

  it('filters by location', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, location: 'Hospital' })
    expect(result).toHaveLength(1)
    expect(result[0].product).toBe('Hi-Tech-Water')
  })

  it('filters by product', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, product: 'OLATTE' })
    expect(result).toHaveLength(1)
  })

  it('filters by search (product name partial)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, search: 'bach' })
    expect(result).toHaveLength(1)
    expect(result[0].product).toBe('BACCHUS')
  })

  it('filters by search (machine name partial)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, search: 'NPH' })
    expect(result).toHaveLength(1)
  })

  it('filters by dateFrom (inclusive)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, dateFrom: '2026-01-02' })
    expect(result).toHaveLength(2)
  })

  it('filters by dateTo (inclusive)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, dateTo: '2026-01-02' })
    expect(result).toHaveLength(2)
  })

  it('combines filters (machine + dateFrom)', () => {
    const result = filterTransactions(SAMPLE, { ...EMPTY_FILTER, location: 'Airport', dateFrom: '2026-01-02' })
    expect(result).toHaveLength(1)
    expect(result[0].product).toBe('BACCHUS')
  })
})

describe('parseTransactionDate', () => {
  it('parses M/D/YYYY format', () => {
    const d = parseTransactionDate('1/15/2026')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0) // January (0-indexed)
    expect(d.getDate()).toBe(15)
  })
})

describe('exportToCSVString', () => {
  it('produces CSV with header and data rows', () => {
    const csv = exportToCSVString(SAMPLE.slice(0, 1))
    expect(csv).toContain('Date,Time,Machine,Location,Product')
    expect(csv).toContain('OLATTE')
    expect(csv).toContain('1.50')
    expect(csv).toContain('1.50') // revenue = 1.5 * 1
  })
})
```

- [ ] **Step 2: Run — confirm tests fail**

```bash
cd "/Users/user/vendissimo dashboard"
npm test -- --testPathPattern=filter-utils 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/lib/filter-utils'`

- [ ] **Step 3: Implement filter-utils**

Create `lib/filter-utils.ts`:
```ts
import type { Transaction, FilterState } from './types'

export function parseTransactionDate(dateStr: string): Date {
  const [m, d, y] = dateStr.split('/').map(Number)
  return new Date(y, m - 1, d)
}

export function filterTransactions(transactions: Transaction[], filters: FilterState): Transaction[] {
  const search = filters.search.toLowerCase()

  return transactions.filter(t => {
    if (search && !t.product.toLowerCase().includes(search) && !t.machine.toLowerCase().includes(search)) {
      return false
    }
    if (filters.machine && t.machine !== filters.machine) return false
    if (filters.location && t.location !== filters.location) return false
    if (filters.product && t.product !== filters.product) return false

    if (filters.dateFrom) {
      const txDate = parseTransactionDate(t.date)
      const from = new Date(filters.dateFrom)
      if (txDate < from) return false
    }
    if (filters.dateTo) {
      const txDate = parseTransactionDate(t.date)
      const to = new Date(filters.dateTo)
      to.setHours(23, 59, 59)
      if (txDate > to) return false
    }

    return true
  })
}

export function exportToCSVString(transactions: Transaction[]): string {
  const headers = ['Date', 'Time', 'Machine', 'Location', 'Product', 'Unit Price', 'Qty', 'Revenue']
  const rows = transactions.map(t => [
    t.date,
    t.time,
    t.machine,
    t.location,
    t.product,
    t.unitPrice.toFixed(2),
    t.qty.toString(),
    (t.unitPrice * t.qty).toFixed(2),
  ])
  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}
```

- [ ] **Step 4: Run — confirm tests pass**

```bash
cd "/Users/user/vendissimo dashboard"
npm test -- --testPathPattern=filter-utils 2>&1 | tail -10
```

Expected: PASS — all tests pass

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add lib/filter-utils.ts tests/filter-utils.test.ts
git commit -m "feat: add transaction filter and CSV export utilities with tests"
```

---

## Task 12: Database client components

**Files:**
- Create: `components/database/SummaryBar.tsx`
- Create: `components/database/FilterBar.tsx`
- Create: `components/database/TransactionsTable.tsx`
- Create: `components/database/ExportCSVButton.tsx`

All are `'use client'` components receiving `transactions` as props and managing filter state internally via `useState`.

- [ ] **Step 1: Create SummaryBar**

Create `components/database/SummaryBar.tsx`:
```tsx
import type { Transaction } from '@/lib/types'

type Props = { transactions: Transaction[]; total: number }

export function SummaryBar({ transactions, total }: Props) {
  const revenue = transactions.reduce((sum, t) => sum + t.unitPrice * t.qty, 0)
  const units = transactions.reduce((sum, t) => sum + t.qty, 0)

  return (
    <div className="flex items-center gap-6 bg-[#292524] rounded-lg px-4 py-3 text-sm">
      <div>
        <span className="text-[#57534e] mr-2">Showing</span>
        <span className="text-[#fbbf24] font-bold">{transactions.length.toLocaleString()}</span>
        <span className="text-[#57534e]"> / {total.toLocaleString()} rows</span>
      </div>
      <div className="h-4 w-px bg-[#44403c]" />
      <div>
        <span className="text-[#57534e] mr-2">Revenue</span>
        <span className="text-[#f97316] font-bold">${revenue.toFixed(2)}</span>
      </div>
      <div className="h-4 w-px bg-[#44403c]" />
      <div>
        <span className="text-[#57534e] mr-2">Units</span>
        <span className="text-[#e7e5e4] font-bold">{units.toLocaleString()}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create FilterBar**

Create `components/database/FilterBar.tsx`:
```tsx
import type { FilterState } from '@/lib/types'

type Props = {
  filters: FilterState
  onChange: (filters: FilterState) => void
  machines: string[]
  locations: string[]
  products: string[]
}

export function FilterBar({ filters, onChange, machines, locations, products }: Props) {
  function set(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const selectClass =
    'bg-[#292524] border border-[#44403c] rounded-md px-2 py-1.5 text-sm text-[#e7e5e4] focus:outline-none focus:border-[#f97316] min-w-[140px]'
  const inputClass =
    'bg-[#292524] border border-[#44403c] rounded-md px-2 py-1.5 text-sm text-[#e7e5e4] placeholder-[#57534e] focus:outline-none focus:border-[#f97316]'

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        type="text"
        placeholder="Search product or machine…"
        value={filters.search}
        onChange={e => set('search', e.target.value)}
        className={`${inputClass} w-52`}
      />
      <select value={filters.machine} onChange={e => set('machine', e.target.value)} className={selectClass}>
        <option value="">All Machines</option>
        {machines.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select value={filters.location} onChange={e => set('location', e.target.value)} className={selectClass}>
        <option value="">All Locations</option>
        {locations.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <select value={filters.product} onChange={e => set('product', e.target.value)} className={selectClass}>
        <option value="">All Products</option>
        {products.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        type="date"
        value={filters.dateFrom}
        onChange={e => set('dateFrom', e.target.value)}
        className={inputClass}
        title="From date"
      />
      <input
        type="date"
        value={filters.dateTo}
        onChange={e => set('dateTo', e.target.value)}
        className={inputClass}
        title="To date"
      />
      {Object.values(filters).some(Boolean) && (
        <button
          onClick={() => onChange({ search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '' })}
          className="text-xs text-[#a8a29e] hover:text-[#e7e5e4] px-2 py-1.5 border border-[#44403c] rounded-md hover:border-[#57534e] transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create TransactionsTable**

Create `components/database/TransactionsTable.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { Transaction } from '@/lib/types'

type SortKey = keyof Transaction | 'revenue'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 100

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(0)

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(0)
  }

  const sorted = [...transactions].sort((a, b) => {
    let av: string | number
    let bv: string | number
    if (sortKey === 'revenue') {
      av = a.unitPrice * a.qty
      bv = b.unitPrice * b.qty
    } else {
      av = a[sortKey]
      bv = b[sortKey]
    }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const thClass = 'text-left py-2 px-3 text-[#57534e] text-xs uppercase font-medium cursor-pointer hover:text-[#a8a29e] select-none whitespace-nowrap'
  const tdClass = 'py-2 px-3 text-[#a8a29e] text-xs whitespace-nowrap'

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>
    return <span className="ml-1 text-[#f97316]">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  return (
    <div className="bg-[#292524] rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-[#44403c]">
            <tr>
              {(['date', 'time', 'machine', 'location', 'product', 'unitPrice', 'qty', 'revenue'] as SortKey[]).map(col => (
                <th key={col} className={thClass} onClick={() => toggleSort(col)}>
                  {col === 'unitPrice' ? 'Price' : col === 'revenue' ? 'Revenue' : col.charAt(0).toUpperCase() + col.slice(1)}
                  <SortIcon col={col} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t, i) => (
              <tr key={i} className="border-b border-[#44403c]/50 hover:bg-[#44403c]/30">
                <td className={tdClass}>{t.date}</td>
                <td className={`${tdClass} text-[#57534e]`}>{t.time}</td>
                <td className={tdClass}>{t.machine}</td>
                <td className={tdClass}>{t.location}</td>
                <td className={`${tdClass} text-[#e7e5e4]`}>{t.product}</td>
                <td className={`${tdClass} text-right`}>${t.unitPrice.toFixed(2)}</td>
                <td className={`${tdClass} text-right`}>{t.qty}</td>
                <td className={`${tdClass} text-right text-[#f97316]`}>${(t.unitPrice * t.qty).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#44403c]">
          <span className="text-[#57534e] text-xs">
            Page {page + 1} of {totalPages} · {sorted.length.toLocaleString()} rows
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded bg-[#44403c] text-[#a8a29e] hover:text-[#e7e5e4] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-xs rounded bg-[#44403c] text-[#a8a29e] hover:text-[#e7e5e4] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create ExportCSVButton**

Create `components/database/ExportCSVButton.tsx`:
```tsx
'use client'

import { exportToCSVString } from '@/lib/filter-utils'
import type { Transaction } from '@/lib/types'

export function ExportCSVButton({ transactions }: { transactions: Transaction[] }) {
  function handleExport() {
    const csv = exportToCSVString(transactions)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vendissimo-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#f97316]/20 border border-[#f97316]/40 text-[#f97316] hover:bg-[#f97316]/30 transition-colors"
    >
      ↓ Export CSV ({transactions.length.toLocaleString()} rows)
    </button>
  )
}
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/database/
git commit -m "feat: add database client components (filter, table, export)"
```

---

## Task 13: Database page

**Files:**
- Create: `app/database/page.tsx`

The server fetches all transactions and passes them to a client wrapper. Filter state lives client-side.

- [ ] **Step 1: Create DatabaseClient wrapper**

Create `components/database/DatabaseClient.tsx`:
```tsx
'use client'

import { useState, useMemo } from 'react'
import type { Transaction, FilterState } from '@/lib/types'
import { filterTransactions } from '@/lib/filter-utils'
import { SummaryBar } from './SummaryBar'
import { FilterBar } from './FilterBar'
import { TransactionsTable } from './TransactionsTable'
import { ExportCSVButton } from './ExportCSVButton'

function unique(arr: string[]) {
  return [...new Set(arr)].sort()
}

export function DatabaseClient({ transactions }: { transactions: Transaction[] }) {
  const [filters, setFilters] = useState<FilterState>({
    search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '',
  })

  const machines = useMemo(() => unique(transactions.map(t => t.machine)), [transactions])
  const locations = useMemo(() => unique(transactions.map(t => t.location)), [transactions])
  const products = useMemo(() => unique(transactions.map(t => t.product)), [transactions])

  const filtered = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SummaryBar transactions={filtered} total={transactions.length} />
        <ExportCSVButton transactions={filtered} />
      </div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        locations={locations}
        products={products}
      />
      <TransactionsTable transactions={filtered} />
    </div>
  )
}
```

- [ ] **Step 2: Create Database page**

Create `app/database/page.tsx`:
```tsx
import { fetchDatabase } from '@/lib/sheets'
import { RefreshButton } from '@/components/RefreshButton'
import { DatabaseClient } from '@/components/database/DatabaseClient'

export default async function DatabasePage() {
  const transactions = await fetchDatabase()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[#e7e5e4] text-xl font-bold">Database</h1>
          <p className="text-[#a8a29e] text-xs mt-0.5">Vendissimo Daily Sales 2026 · {transactions.length.toLocaleString()} records</p>
        </div>
        <RefreshButton />
      </div>
      <DatabaseClient transactions={transactions} />
    </div>
  )
}
```

- [ ] **Step 3: Verify Database page in browser**

Open `http://localhost:3000/database`. Verify:
- Summary bar shows "12,735 / 12,735 rows", total revenue, total units
- Filter dropdowns are populated with machine/location/product options
- Table shows 100 rows per page with pagination
- Sort works on each column header click
- Filtering by machine/location/product updates summary bar live
- Export CSV button downloads a `.csv` file of filtered rows
- Refresh button triggers data reload

- [ ] **Step 4: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/database/DatabaseClient.tsx app/database/page.tsx
git commit -m "feat: assemble database page with live filtering and CSV export"
```

---

## Task 14: Error states

**Files:**
- Create: `app/executive-summary/error.tsx`
- Create: `app/database/error.tsx`
- Modify: `app/executive-summary/page.tsx`
- Modify: `app/database/page.tsx`

- [ ] **Step 1: Create shared error boundary component**

Create `components/ErrorState.tsx`:
```tsx
'use client'

type Props = { message: string; reset: () => void }

export function ErrorState({ message, reset }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-[#e7e5e4] text-lg font-semibold">Failed to load data</h2>
      <p className="text-[#a8a29e] text-sm max-w-md text-center">{message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-md bg-[#f97316]/20 border border-[#f97316]/40 text-[#f97316] text-sm hover:bg-[#f97316]/30 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create Executive Summary error boundary**

Create `app/executive-summary/error.tsx`:
```tsx
'use client'

import { ErrorState } from '@/components/ErrorState'

export default function ExecError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={error.message || 'Could not load executive summary data.'} reset={reset} />
}
```

- [ ] **Step 3: Create Database error boundary**

Create `app/database/error.tsx`:
```tsx
'use client'

import { ErrorState } from '@/components/ErrorState'

export default function DatabaseError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState message={error.message || 'Could not load database records.'} reset={reset} />
}
```

- [ ] **Step 4: Run full test suite**

```bash
cd "/Users/user/vendissimo dashboard"
npm test 2>&1 | tail -20
```

Expected: All tests pass (csv-utils, sheets, filter-utils).

- [ ] **Step 5: Run build check**

```bash
cd "/Users/user/vendissimo dashboard"
npm run build 2>&1 | tail -15
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/user/vendissimo dashboard"
git add components/ErrorState.tsx app/executive-summary/error.tsx app/database/error.tsx
git commit -m "feat: add error boundaries for exec summary and database pages"
```

---

## Done

All tasks complete. The dashboard is live at `http://localhost:3000` with:
- Executive Summary: KPI sidebar + monthly bar chart + location pie + weekday bar + product table + machine table
- Database: 12k+ transaction table with live filtering, sort, pagination, and CSV export
- Manual refresh button on both pages
- Error boundaries with retry on both pages
