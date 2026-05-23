# ClickHouse Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Google Sheets CSV ingestion with direct ClickHouse queries against `hbshengma.deliverydetail` and add a USD ⇄ KHR currency toggle so the dashboard works against the mixed-currency live data.

**Architecture:** A new `lib/clickhouse.ts` module fetches rows over HTTP (port 8123) using the official `@clickhouse/client` package, with a 30-minute in-process cache. Pure helpers in `lib/transactions.ts` map each CH row to a currency-tagged `Transaction`. `Transaction` gains a `currency` field; `aggregateTransactions` / `filterTransactions` filter by the selected currency before running the existing math. A `CurrencyToggle` client component (mirror of `ThemeToggle`) writes `localStorage['currency']` and dispatches a `currencychange` event; the top-level client wrappers hold currency state and pass it down via a small React context. Every money display switches from a hard-coded `$` to a `formatMoney(amount, currency)` helper.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, ClickHouse (`@clickhouse/client`), Jest (`node` env).

---

## Reference: the four pages and their existing client wrappers

```
app/dashboard/page.tsx          → components/executive-summary/ExecSummaryClient.tsx
app/executive-summary/page.tsx  → components/executive-summary/ExecSummaryClient.tsx
app/database/page.tsx           → components/database/DatabaseClient.tsx
app/sales-report/page.tsx       → components/sales-report/SalesReportClient.tsx
```

Three client wrappers + four pages. After this plan, every page fetches via `fetchTransactions()` from `@/lib/clickhouse` and renders `<CurrencyToggle />` next to `<ThemeToggle />`.

---

## Task 1: Install dependency, write env files, define currency types

**Files:**
- Modify: `package.json` (add `@clickhouse/client` dependency)
- Create: `.env.local` (NOT committed)
- Modify: `.env.example` (committed)
- Modify: `lib/types.ts`

- [ ] **Step 1: Install the ClickHouse client**

Run:
```bash
npm install @clickhouse/client
```
Expected: dependency added to `package.json` + `package-lock.json` updated.

- [ ] **Step 2: Add ClickHouse vars to `.env.local`**

Append these lines to `.env.local` (file already exists from the machine-monitoring port; keep its existing keys):
```
CLICKHOUSE_URL=http://103.230.81.70:8123
CLICKHOUSE_DB=hbshengma
CLICKHOUSE_USER=hbshengma
CLICKHOUSE_PASSWORD=l1nkit240
```

- [ ] **Step 3: Add the same keys (empty values) to `.env.example`**

Append to `.env.example`:
```
CLICKHOUSE_URL=
CLICKHOUSE_DB=
CLICKHOUSE_USER=
CLICKHOUSE_PASSWORD=
```

- [ ] **Step 4: Add `Currency` to `lib/types.ts`**

Replace `lib/types.ts` Transaction definition and add Currency. Final file:

```ts
export type Currency = 'USD' | 'KHR'

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

export type DailySalesEntry = { qty: number; rev: number }

export type DailySalesMachineRow = {
  location: string
  machine: string
  daily: Record<string, DailySalesEntry>
  totalQty: number
  totalRev: number
}

export type DailySalesData = {
  dates: string[]
  machines: DailySalesMachineRow[]
  locationTotals: Record<string, { daily: Record<string, DailySalesEntry>; totalQty: number; totalRev: number }>
  grandTotal: { daily: Record<string, DailySalesEntry>; totalQty: number; totalRev: number }
}

export type ExecSummaryData = {
  kpis: KPIs
  monthly: MonthlyRow[]
  products: ProductRow[]
  machines: MachineRow[]
  weekday: WeekdayRevenue
  daily: DailyRevenue[]
  dailySales: DailySalesData
}

export type Transaction = {
  machine: string
  location: string
  product: string
  unitPrice: number
  qty: number
  time: string
  date: string
  currency: Currency
}

export type FilterState = {
  search: string
  machine: string
  location: string
  product: string
  dateFrom: string
  dateTo: string
  currency: Currency
}
```

- [ ] **Step 5: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds. (Existing modules that create `Transaction` / `FilterState` literals will now error — that's expected; subsequent tasks fix those call sites.)

If build errors only come from the now-missing `currency` field in `lib/sheets.ts`, `lib/aggregate.ts`, `lib/filter-utils.ts`, and the client components, that is the expected state for this checkpoint — the next tasks supply the field.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example lib/types.ts
git commit -m "Add @clickhouse/client and Currency type"
```

`.env.local` is gitignored and is intentionally not staged.

---

## Task 2: Currency cutoff and pure mapping helpers

**Files:**
- Create: `lib/transactions.ts`
- Create: `tests/transactions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/transactions.test.ts`:

```ts
import { rowCurrency, rowToTransaction, formatMoney, type CHRow } from '@/lib/transactions'

describe('rowCurrency', () => {
  it('returns USD strictly before 2026-05-19', () => {
    expect(rowCurrency('2026-05-18 23:59:59')).toBe('USD')
    expect(rowCurrency('2026-01-01 00:00:00')).toBe('USD')
  })

  it('returns KHR from 2026-05-19 onward', () => {
    expect(rowCurrency('2026-05-19 00:00:00')).toBe('KHR')
    expect(rowCurrency('2026-12-31 23:59:59')).toBe('KHR')
  })
})

describe('rowToTransaction', () => {
  const row: CHRow = {
    device_id: '9fl9g4hgn0f243c',
    device_name: 'V1- KHMER HOUSE',
    product_name: 'BACCHUS',
    product_brand: '',
    sales_amount: '1.5',
    sales_time: '2026-01-31 23:05:48',
  }

  it('maps a USD row with correct field shapes', () => {
    expect(rowToTransaction(row, { '9fl9g4hgn0f243c': 'KHMER House' })).toEqual({
      machine: 'V1- KHMER HOUSE',
      location: 'KHMER House',
      product: 'BACCHUS',
      unitPrice: 1.5,
      qty: 1,
      time: '23:05:48',
      date: '1/31/2026',
      currency: 'USD',
    })
  })

  it('falls back to "Unknown" location when device_id is not in the map', () => {
    expect(rowToTransaction(row, {}).location).toBe('Unknown')
  })

  it('tags rows on/after 2026-05-19 as KHR', () => {
    const khr: CHRow = { ...row, sales_time: '2026-05-19 00:00:00', sales_amount: '2500' }
    expect(rowToTransaction(khr, {}).currency).toBe('KHR')
    expect(rowToTransaction(khr, {}).unitPrice).toBe(2500)
  })

  it('treats a malformed amount as 0', () => {
    const bad: CHRow = { ...row, sales_amount: 'abc' }
    expect(rowToTransaction(bad, {}).unitPrice).toBe(0)
  })

  it('treats null device_name / product_name as empty strings', () => {
    const nulled: CHRow = { ...row, device_name: null, product_name: null }
    const t = rowToTransaction(nulled, {})
    expect(t.machine).toBe('')
    expect(t.product).toBe('')
  })
})

describe('formatMoney', () => {
  it('formats USD with $ prefix and two decimals', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50')
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })

  it('formats KHR with the riel sign and no decimals', () => {
    expect(formatMoney(2500, 'KHR')).toBe('៛2,500')
    expect(formatMoney(0, 'KHR')).toBe('៛0')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/transactions.test.ts`
Expected: FAIL with `Cannot find module '@/lib/transactions'`.

- [ ] **Step 3: Write the implementation**

Create `lib/transactions.ts`:

```ts
import type { Currency, Transaction } from './types'

/** Cutoff: rows whose sales_time is < this string are USD; >= is KHR. */
export const CURRENCY_CUTOFF = '2026-05-19'

/** Raw ClickHouse row shape (only the columns the dashboard uses). */
export type CHRow = {
  device_id: string | null
  device_name: string | null
  product_name: string | null
  product_brand: string | null
  sales_amount: string | null
  sales_time: string | null
}

/** Currency for a row, derived from its sales_time string. */
export function rowCurrency(salesTime: string): Currency {
  return salesTime < CURRENCY_CUTOFF ? 'USD' : 'KHR'
}

function reformatDate(salesTime: string): string {
  // 'YYYY-MM-DD HH:MM:SS' → 'M/D/YYYY' so parseTransactionDate accepts it.
  const [y, m, d] = salesTime.slice(0, 10).split('-').map(Number)
  return `${m}/${d}/${y}`
}

/** Map one ClickHouse row to the dashboard's Transaction shape. */
export function rowToTransaction(row: CHRow, locations: Record<string, string>): Transaction {
  const salesTime = row.sales_time ?? ''
  const price = row.sales_amount != null ? parseFloat(row.sales_amount) : 0
  return {
    machine: row.device_name ?? '',
    location: (row.device_id && locations[row.device_id]) || 'Unknown',
    product: row.product_name ?? '',
    unitPrice: Number.isNaN(price) ? 0 : price,
    qty: 1,
    time: salesTime.slice(11, 19),
    date: reformatDate(salesTime),
    currency: rowCurrency(salesTime),
  }
}

/** Render an amount in the active currency. */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === 'USD') {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return '៛' + Math.round(amount).toLocaleString('en-US')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/transactions.test.ts`
Expected: PASS — 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/transactions.ts tests/transactions.test.ts
git commit -m "Add ClickHouse row mapping and currency helpers"
```

---

## Task 3: Static location and category maps

**Files:**
- Create: `lib/locations.ts`
- Create: `lib/categories.ts`

No unit tests — these are plain data files.

- [ ] **Step 1: Create `lib/locations.ts`**

Values seeded from CH `SELECT DISTINCT device_id` and reconciled with the live machine-monitoring API names (today's names take precedence over CH's stale names):

```ts
/** device_id → location label. Edit this map when machines are added or moved. */
export const DEVICE_LOCATIONS: Record<string, string> = {
  '9fl9g4hgn0f243c': 'KHMER House',
  'h5k8l6ou81i5wsq': 'RUPP Uni',
  'g507pbw390zsnsp': 'RUPP Uni',
  'jpi7gb59lbhc4i5': 'RUPP Uni',
  'dlse5t4kwe8ln03': 'NPH',
  't60zf44lqefn6fg': 'NPH',
  '0o2qu1o26votjdq': 'NPH',
  'c91quw8w4q8su5f': 'TKS Market',
}
```

- [ ] **Step 2: Create `lib/categories.ts`**

Values seeded from CH `SELECT DISTINCT product_name`. Category names match the existing `CATEGORY_COLORS` keys in `components/executive-summary/TopProductsTable.tsx` so the badge colors keep working:

```ts
/** product_name → category. Edit this map when new products are added. */
export const PRODUCT_CATEGORIES: Record<string, string> = {
  'Hi-Tech-Water': 'Water',
  'Hi-Tech': 'Water',
  'Hi - Tech 1500ml': 'Water',
  'Water': 'Water',
  'OLATTE': 'Dairy',
  'Olatte apple': 'Dairy',
  'Olatte Original': 'Dairy',
  'Indomilk': 'Dairy',
  'Indomilk chocolate': 'Dairy',
  'Pediasure': 'Dairy',
  'Ensure vanilla': 'Dairy',
  'Pocarisweat-can': 'Sports Drink',
  'BACCHUS': 'Energy Drink',
  'Shin Kim Chi': 'Food',
  'Shin Ramyum': 'Food',
  'Coca-Cola': 'Soda',
  'Fanta-grape': 'Soda',
  'Fanta-orange': 'Soda',
  'Freshy-Soybean': 'Soy Drink',
  'Idol': 'Other',
}
```

- [ ] **Step 3: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds (these files have no imports beyond the implicit string type).

- [ ] **Step 4: Commit**

```bash
git add lib/locations.ts lib/categories.ts
git commit -m "Add static device_id and product_name maps"
```

---

## Task 4: ClickHouse fetcher with in-process cache

**Files:**
- Create: `lib/clickhouse.ts`

No unit test — network-bound; verified end-to-end in Task 10.

- [ ] **Step 1: Write the implementation**

Create `lib/clickhouse.ts`:

```ts
import { createClient } from '@clickhouse/client'
import type { Transaction } from './types'
import { rowToTransaction, type CHRow } from './transactions'
import { DEVICE_LOCATIONS } from './locations'

const CACHE_TTL_MS = 30 * 60_000 // 30 minutes

let cache: { at: number; data: Transaction[] } | null = null

function client() {
  return createClient({
    url: process.env.CLICKHOUSE_URL,
    database: process.env.CLICKHOUSE_DB,
    username: process.env.CLICKHOUSE_USER,
    password: process.env.CLICKHOUSE_PASSWORD,
    request_timeout: 30_000,
  })
}

/**
 * Fetch every sales row from ClickHouse, mapped to the dashboard's Transaction
 * shape. Results are cached in process memory for CACHE_TTL_MS. Call
 * invalidateTransactionsCache() to force a refetch.
 */
export async function fetchTransactions(): Promise<Transaction[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data
  }
  const ch = client()
  try {
    const result = await ch.query({
      query: `
        SELECT device_id, device_name, product_name, product_brand, sales_amount, sales_time
        FROM deliverydetail
        WHERE sales_time IS NOT NULL AND sales_amount IS NOT NULL
        ORDER BY sales_time
      `,
      format: 'JSONEachRow',
    })
    const rows = (await result.json()) as CHRow[]
    const data = rows.map(r => rowToTransaction(r, DEVICE_LOCATIONS))
    cache = { at: Date.now(), data }
    return data
  } finally {
    await ch.close()
  }
}

/** Drop the in-process cache so the next call refetches from ClickHouse. */
export function invalidateTransactionsCache(): void {
  cache = null
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/clickhouse.ts
git commit -m "Add ClickHouse transactions fetcher with 30-minute cache"
```

---

## Task 5: Currency-aware aggregation

**Files:**
- Modify: `lib/aggregate.ts`
- Modify: `tests/sheets.test.ts` (delete — sheets module is going away in Task 10)
- Modify: `tests/csv-utils.test.ts` (delete — csv-utils module is going away in Task 10)
- Create: `tests/aggregate.test.ts`

- [ ] **Step 1: Delete obsolete tests**

Run:
```bash
git rm tests/sheets.test.ts tests/csv-utils.test.ts
```
Their subjects are deleted in Task 10; deleting the tests now keeps the suite green through the intermediate commits.

- [ ] **Step 2: Write the new aggregate test**

Create `tests/aggregate.test.ts`:

```ts
import { aggregateTransactions, filterByDateRange } from '@/lib/aggregate'
import type { Transaction } from '@/lib/types'

function tx(o: Partial<Transaction>): Transaction {
  return {
    machine: 'V1',
    location: 'KHMER House',
    product: 'BACCHUS',
    unitPrice: 1.5,
    qty: 1,
    time: '12:00:00',
    date: '1/10/2026',
    currency: 'USD',
    ...o,
  }
}

describe('aggregateTransactions', () => {
  const cats = { BACCHUS: 'Energy Drink', OLATTE: 'Dairy' }

  it('returns an empty result when no rows of the selected currency exist', () => {
    const out = aggregateTransactions([tx({ currency: 'KHR' })], cats, 'USD')
    expect(out.kpis.totalRevenue).toBe(0)
    expect(out.kpis.totalTransactions).toBe(0)
    expect(out.products).toEqual([])
  })

  it('sums only the rows whose currency matches', () => {
    const rows = [
      tx({ currency: 'USD', unitPrice: 1.5 }),
      tx({ currency: 'USD', unitPrice: 2.0 }),
      tx({ currency: 'KHR', unitPrice: 5000 }),
    ]
    expect(aggregateTransactions(rows, cats, 'USD').kpis.totalRevenue).toBeCloseTo(3.5)
    expect(aggregateTransactions(rows, cats, 'KHR').kpis.totalRevenue).toBe(5000)
  })

  it('counts only matching transactions', () => {
    const rows = [
      tx({ currency: 'USD' }),
      tx({ currency: 'USD' }),
      tx({ currency: 'KHR' }),
    ]
    expect(aggregateTransactions(rows, cats, 'USD').kpis.totalTransactions).toBe(2)
    expect(aggregateTransactions(rows, cats, 'KHR').kpis.totalTransactions).toBe(1)
  })
})

describe('filterByDateRange', () => {
  it('is currency-agnostic — filters only by date', () => {
    const rows = [
      tx({ date: '1/10/2026', currency: 'USD' }),
      tx({ date: '5/20/2026', currency: 'KHR' }),
    ]
    expect(filterByDateRange(rows, '2026-05-01', '2026-05-31')).toHaveLength(1)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest tests/aggregate.test.ts`
Expected: FAIL — `aggregateTransactions` signature does not accept three arguments yet.

- [ ] **Step 4: Modify `lib/aggregate.ts`**

Update the `aggregateTransactions` signature and add the currency filter as the first step. Replace the function declaration and its first lines. Find:

```ts
export function aggregateTransactions(
  transactions: Transaction[],
  categoryMap: Record<string, string>,
): ExecSummaryData {
  if (transactions.length === 0) {
```

Replace with:

```ts
import type { Currency } from './types'

export function aggregateTransactions(
  transactions: Transaction[],
  categoryMap: Record<string, string>,
  currency: Currency,
): ExecSummaryData {
  transactions = transactions.filter(t => t.currency === currency)
  if (transactions.length === 0) {
```

(The `Currency` import is added to the existing imports block at the top of the file. The rest of the function is unchanged.)

- [ ] **Step 5: Run the new test to verify it passes**

Run: `npx jest tests/aggregate.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 6: Run the full suite — expect downstream type errors at compile only**

Run: `npm test`
Expected: PASS — `aggregate.test.ts`, `filter-utils.test.ts`, `transactions.test.ts`, plus all `smshj-*` and `machine-hub` suites. (Note: tests do not type-check inputs the same way `npm run build` does; build still errors against the call sites that pass only 2 args. Those call sites are fixed in Tasks 8-10.)

- [ ] **Step 7: Commit**

```bash
git add lib/aggregate.ts tests/aggregate.test.ts tests/sheets.test.ts tests/csv-utils.test.ts
git commit -m "Make aggregateTransactions filter by currency"
```

---

## Task 6: Currency-aware database filter

**Files:**
- Modify: `lib/filter-utils.ts`
- Modify: `tests/filter-utils.test.ts`

- [ ] **Step 1: Extend the existing filter-utils test**

Open `tests/filter-utils.test.ts` and append the following block (before the final `})` of the file if it has an outer wrapper, otherwise at the end):

```ts
import type { Transaction, FilterState, Currency } from '@/lib/types'

function txC(currency: Currency, overrides: Partial<Transaction> = {}): Transaction {
  return {
    machine: 'V1',
    location: 'KHMER House',
    product: 'BACCHUS',
    unitPrice: 1.5,
    qty: 1,
    time: '12:00:00',
    date: '1/10/2026',
    currency,
    ...overrides,
  }
}

function baseFilters(currency: Currency): FilterState {
  return { search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '', currency }
}

describe('filterTransactions currency', () => {
  it('keeps only rows matching the selected currency', () => {
    const { filterTransactions } = require('@/lib/filter-utils')
    const rows = [txC('USD'), txC('KHR'), txC('USD')]
    expect(filterTransactions(rows, baseFilters('USD'))).toHaveLength(2)
    expect(filterTransactions(rows, baseFilters('KHR'))).toHaveLength(1)
  })
})
```

(If the existing test file already imports `Transaction` / `FilterState` at the top, do not duplicate those imports — fold the new helpers and `describe` block into the existing structure.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/filter-utils.test.ts`
Expected: FAIL — `filterTransactions` does not yet filter by currency, or the `FilterState` literal does not yet require `currency` (the test setup will fail).

- [ ] **Step 3: Modify `lib/filter-utils.ts`**

In `filterTransactions`, add a currency filter as the first check inside the `.filter` callback. Find:

```ts
  return transactions.filter(t => {
    if (search && !fuzzyMatch(t.product.toLowerCase(), search) && !fuzzyMatch(t.machine.toLowerCase(), search)) {
      return false
    }
```

Replace with:

```ts
  return transactions.filter(t => {
    if (t.currency !== filters.currency) return false
    if (search && !fuzzyMatch(t.product.toLowerCase(), search) && !fuzzyMatch(t.machine.toLowerCase(), search)) {
      return false
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/filter-utils.test.ts`
Expected: PASS — every test (existing + new) passes.

- [ ] **Step 5: Commit**

```bash
git add lib/filter-utils.ts tests/filter-utils.test.ts
git commit -m "Make filterTransactions filter by currency"
```

---

## Task 7: CurrencyToggle component + currency context

**Files:**
- Create: `components/CurrencyToggle.tsx`
- Create: `components/currency-context.tsx`

- [ ] **Step 1: Create `components/currency-context.tsx`**

```tsx
'use client'

import { createContext, useContext } from 'react'
import type { Currency } from '@/lib/types'

export const CurrencyContext = createContext<Currency>('KHR')

export function useCurrency(): Currency {
  return useContext(CurrencyContext)
}
```

- [ ] **Step 2: Create `components/CurrencyToggle.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import type { Currency } from '@/lib/types'

const STORAGE_KEY = 'currency'
const EVENT = 'currencychange'

function readStored(): Currency {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'USD' ? 'USD' : 'KHR'
  } catch {
    return 'KHR'
  }
}

export function CurrencyToggle() {
  const [currency, setCurrency] = useState<Currency>('KHR')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrency(readStored())
    function onChange(e: Event) {
      const next = (e as CustomEvent<Currency>).detail
      if (next === 'USD' || next === 'KHR') setCurrency(next)
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  function toggle() {
    const next: Currency = currency === 'USD' ? 'KHR' : 'USD'
    setCurrency(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable — toggle still applies for this tab
    }
    window.dispatchEvent(new CustomEvent<Currency>(EVENT, { detail: next }))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={currency === 'USD' ? 'Switch to KHR' : 'Switch to USD'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-strong hover:text-accent hover:border-border-strong shadow-sm transition-colors"
    >
      <span>{currency === 'USD' ? '$' : '៛'}</span>
      {currency}
    </button>
  )
}
```

- [ ] **Step 3: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint reports 0 errors (the `set-state-in-effect` rule is suppressed on the legitimate post-hydration sync; no new lint warnings are introduced).

- [ ] **Step 4: Commit**

```bash
git add components/CurrencyToggle.tsx components/currency-context.tsx
git commit -m "Add CurrencyToggle button and currency context"
```

---

## Task 8: Replace every `$`-hardcoded money render with `formatMoney`

**Files:**
- Modify: `components/KPICard.tsx`
- Modify: `components/executive-summary/KPISidebar.tsx`
- Modify: `components/executive-summary/ExecSummaryClient.tsx`
- Modify: `components/executive-summary/MonthlyRevenueChart.tsx`
- Modify: `components/executive-summary/WeekdayBarChart.tsx`
- Modify: `components/executive-summary/LocationPieChart.tsx`
- Modify: `components/executive-summary/TopProductsTable.tsx`
- Modify: `components/executive-summary/MachinePerformanceTable.tsx`
- Modify: `components/executive-summary/DailySalesTable.tsx`
- Modify: `components/database/TransactionsTable.tsx`
- Modify: `components/database/SummaryBar.tsx`

The rule is the same in every file: every literal `'$'` or `\`${...}\`` that wraps a money value is replaced by `formatMoney(value, currency)`, where `currency = useCurrency()`. Numeric ticks on chart axes that read `\`$${v}\`` switch to `formatMoney(Number(v), currency)`.

- [ ] **Step 1: Update `components/KPICard.tsx`**

`KPICard` currently takes a pre-formatted `value: string` prop. Keep it that way — the formatting happens at the call site in `KPISidebar`. No changes required to `KPICard.tsx` itself in this step.

- [ ] **Step 2: Update `components/executive-summary/KPISidebar.tsx`**

Add imports at top:
```ts
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
```

Inside the component, after the props destructure, add:
```ts
const currency = useCurrency()
const money = (n: number) => formatMoney(n, currency)
```

Replace every existing `value={fmt(...)}` and `value={kpis.someMoneyField...}` so money values use `money(...)`. The non-money KPIs (`totalTransactions`, `activeMachines / activeLocations`, `peakDayDate`) stay as-is.

Specifically:
- `value={fmt(kpis.totalRevenue)}` → `value={money(kpis.totalRevenue)}`
- `value={fmt(kpis.avgDailyRevenue)}` → `value={money(kpis.avgDailyRevenue)}`
- `value={fmt(kpis.peakDayRevenue)}` → `value={money(kpis.peakDayRevenue)}`

The local `fmt` helper can be deleted from the file.

- [ ] **Step 3: Update `components/executive-summary/ExecSummaryClient.tsx`**

Add imports:
```ts
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
```

Inside `ExecSummaryClient`, after the existing `useState` calls, add:
```ts
const currency = useCurrency()
```

The `mobileKpis` array currently uses template literals like `` `$${data.kpis.totalRevenue.toLocaleString(...)}` `` — rewrite the money entries:

```ts
const mobileKpis = [
  { label: 'Total Revenue', value: formatMoney(data.kpis.totalRevenue, currency), accent: 'var(--color-accent)' },
  { label: 'Transactions', value: data.kpis.totalTransactions.toLocaleString(), accent: 'var(--color-accent-pink)' },
  { label: 'Avg Daily', value: formatMoney(data.kpis.avgDailyRevenue, currency), accent: 'var(--color-accent)' },
  { label: 'Peak Day', value: formatMoney(data.kpis.peakDayRevenue, currency), accent: 'var(--color-danger)' },
]
```

`aggregateTransactions(filtered, categoryMap)` becomes `aggregateTransactions(filtered, categoryMap, currency)`.

- [ ] **Step 4: Update `components/executive-summary/MonthlyRevenueChart.tsx`**

Add imports and pull currency:
```ts
import { useCurrency } from '@/components/currency-context'
import { formatMoney } from '@/lib/transactions'
```
Inside the component:
```ts
const currency = useCurrency()
```
Replace the Y-axis tick formatter `tickFormatter={v => \`$${v}\`}` with `tickFormatter={v => formatMoney(Number(v), currency)}`. Replace the Tooltip `formatter={(v) => [\`$${Number(v).toFixed(2)}\`, 'Revenue']}` with `formatter={(v) => [formatMoney(Number(v), currency), 'Revenue']}`.

- [ ] **Step 5: Update `components/executive-summary/WeekdayBarChart.tsx`**

Same pattern — import `useCurrency` + `formatMoney`, derive `currency`, replace the YAxis `tickFormatter={v => \`$${v}\`}` and the Tooltip `formatter={(v) => [\`$${Number(v).toFixed(2)}\`, 'Revenue']}` with their `formatMoney` equivalents.

- [ ] **Step 6: Update `components/executive-summary/LocationPieChart.tsx`**

Same pattern — import + derive `currency`. Replace the Tooltip `formatter={(v) => [\`$${Number(v).toFixed(2)}\`, 'Revenue']}` with `formatter={(v) => [formatMoney(Number(v), currency), 'Revenue']}`.

- [ ] **Step 7: Update `components/executive-summary/TopProductsTable.tsx`**

Add imports + derive `currency`. The revenue render is `` `$${p.revenue.toFixed(2)}` `` — replace with `formatMoney(p.revenue, currency)`. The `avgUnitPrice` (if rendered) uses the same conversion.

- [ ] **Step 8: Update `components/executive-summary/MachinePerformanceTable.tsx`**

Add imports + derive `currency`. The location-total `` `$${total.toFixed(2)}` `` and per-machine revenue `` `$${m.revenue.toFixed(2)}` `` both become `formatMoney(value, currency)`.

- [ ] **Step 9: Update `components/executive-summary/DailySalesTable.tsx`**

Add imports + derive `currency`. Every `` `$${e.rev.toFixed(2)}` `` and `` `$${lt.totalRev.toFixed(2)}` `` and `` `$${grandTotal.totalRev.toFixed(2)}` `` becomes `formatMoney(value, currency)`. Six total occurrences — confirm with grep at the end.

- [ ] **Step 10: Update `components/database/TransactionsTable.tsx`**

Add imports + derive `currency`. The `unitPrice` and `revenue` columns currently render `` `$${t.unitPrice.toFixed(2)}` `` and `` `$${(t.unitPrice * t.qty).toFixed(2)}` `` — replace with `formatMoney(...)`.

- [ ] **Step 11: Update `components/database/SummaryBar.tsx`**

Add imports + derive `currency`. The revenue total render becomes `formatMoney(total, currency)`.

- [ ] **Step 12: Verify no stray `$`-prefixed money templates remain**

Run:
```bash
git grep -nE '\$\$\{|\$\{Number\(v\)' -- components/
```
Expected: no output (every money render now goes through `formatMoney`).

- [ ] **Step 13: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors.

- [ ] **Step 14: Commit**

```bash
git add components/executive-summary/ components/database/
git commit -m "Render money via formatMoney(currency) instead of literal $"
```

---

## Task 9: Wire client wrappers — hold currency state + provide via context

**Files:**
- Modify: `components/executive-summary/ExecSummaryClient.tsx`
- Modify: `components/database/DatabaseClient.tsx`
- Modify: `components/sales-report/SalesReportClient.tsx`

Each wrapper holds the currency state, reads `localStorage['currency']` on mount, listens for the `currencychange` event, and provides the value via `CurrencyContext`. The aggregation/filter calls inside each wrapper switch to use that state.

- [ ] **Step 1: Update `ExecSummaryClient.tsx`**

Add imports:
```ts
import { CurrencyContext } from '@/components/currency-context'
import type { Currency } from '@/lib/types'
```

At the top of the component body (alongside the existing `preset`/`dateFrom`/`dateTo` state), add:
```ts
const [currency, setCurrency] = useState<Currency>('KHR')

useEffect(() => {
  try {
    if (localStorage.getItem('currency') === 'USD') setCurrency('USD')
  } catch {}
  function onChange(e: Event) {
    const next = (e as CustomEvent<Currency>).detail
    if (next === 'USD' || next === 'KHR') setCurrency(next)
  }
  window.addEventListener('currencychange', onChange)
  return () => window.removeEventListener('currencychange', onChange)
}, [])
```

`useEffect` needs to be imported alongside `useState` and `useMemo`.

The `useMemo` for `data` becomes:
```ts
const data = useMemo(
  () => aggregateTransactions(filtered, categoryMap, currency),
  [filtered, categoryMap, currency],
)
```

Wrap the entire returned JSX in `<CurrencyContext.Provider value={currency}>...</CurrencyContext.Provider>` so all child components see the active currency.

- [ ] **Step 2: Update `DatabaseClient.tsx`**

Add imports:
```ts
import { useState, useEffect, useMemo } from 'react'
import { CurrencyContext } from '@/components/currency-context'
import type { Currency } from '@/lib/types'
```

Add currency state + effect (same block as in Step 1). Update the filters `useState` initialization to include `currency: 'KHR'`:

```ts
const [filters, setFilters] = useState<FilterState>({
  search: '', machine: '', location: '', product: '', dateFrom: '', dateTo: '', currency: 'KHR',
})
```

Whenever `currency` (the local state) changes, sync it into `filters.currency`:

```ts
useEffect(() => {
  setFilters(f => ({ ...f, currency }))
}, [currency])
```

Wrap the returned JSX in `<CurrencyContext.Provider value={currency}>...</CurrencyContext.Provider>`.

- [ ] **Step 3: Update `SalesReportClient.tsx`**

Same currency state + effect + Provider wrap as the other two. The `aggregateTransactions(filtered, categoryMap)` call becomes `aggregateTransactions(filtered, categoryMap, currency)`.

- [ ] **Step 4: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/executive-summary/ExecSummaryClient.tsx components/database/DatabaseClient.tsx components/sales-report/SalesReportClient.tsx
git commit -m "Wire currency state into client wrappers via context"
```

---

## Task 10: Swap pages to ClickHouse + delete sheets module

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/executive-summary/page.tsx`
- Modify: `app/database/page.tsx`
- Modify: `app/sales-report/page.tsx`
- Modify: `app/actions.ts`
- Modify: `components/RefreshButton.tsx`
- Delete: `lib/sheets.ts`
- Delete: `lib/csv-utils.ts`

- [ ] **Step 1: Update `app/dashboard/page.tsx`**

Replace the contents with:

```tsx
import { fetchTransactions } from '@/lib/clickhouse'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import { RefreshButton } from '@/components/RefreshButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CurrencyToggle } from '@/components/CurrencyToggle'
import { ExecSummaryClient } from '@/components/executive-summary/ExecSummaryClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const transactions = await fetchTransactions()
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Dashboard</h1>
          <p className="text-muted text-xs mt-0.5">
            {transactions.length.toLocaleString()} transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CurrencyToggle />
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
      <ExecSummaryClient transactions={transactions} categoryMap={PRODUCT_CATEGORIES} />
    </div>
  )
}
```

- [ ] **Step 2: Update `app/executive-summary/page.tsx`**

Replace with the same shape as Step 1, but the `<h1>` reads "Executive Summary" and the subtitle reads `\`${transactions.length.toLocaleString()} transactions\``.

- [ ] **Step 3: Update `app/database/page.tsx`**

```tsx
import { fetchTransactions } from '@/lib/clickhouse'
import { RefreshButton } from '@/components/RefreshButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CurrencyToggle } from '@/components/CurrencyToggle'
import { DatabaseClient } from '@/components/database/DatabaseClient'

export const dynamic = 'force-dynamic'

export default async function DatabasePage() {
  const transactions = await fetchTransactions()
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Database</h1>
          <p className="text-muted text-xs mt-0.5">{transactions.length.toLocaleString()} records</p>
        </div>
        <div className="flex items-center gap-2">
          <CurrencyToggle />
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
      <DatabaseClient transactions={transactions} />
    </div>
  )
}
```

- [ ] **Step 4: Update `app/sales-report/page.tsx`**

```tsx
import { fetchTransactions } from '@/lib/clickhouse'
import { PRODUCT_CATEGORIES } from '@/lib/categories'
import { ThemeToggle } from '@/components/ThemeToggle'
import { CurrencyToggle } from '@/components/CurrencyToggle'
import { RefreshButton } from '@/components/RefreshButton'
import { SalesReportClient } from '@/components/sales-report/SalesReportClient'

export const dynamic = 'force-dynamic'

export default async function SalesReportPage() {
  const transactions = await fetchTransactions()
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Sales Report</h1>
          <p className="text-muted text-xs mt-0.5">Daily sales breakdown by machine</p>
        </div>
        <div className="flex items-center gap-2">
          <CurrencyToggle />
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
      <SalesReportClient transactions={transactions} categoryMap={PRODUCT_CATEGORIES} />
    </div>
  )
}
```

- [ ] **Step 5: Rename the server action**

Replace `app/actions.ts` with:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { invalidateTransactionsCache } from '@/lib/clickhouse'

export async function revalidateData(): Promise<void> {
  invalidateTransactionsCache()
  revalidatePath('/', 'layout')
}
```

- [ ] **Step 6: Update `components/RefreshButton.tsx`**

Find the import + call:
```ts
import { revalidateSheets } from '@/app/actions'
// ...
await revalidateSheets()
```
Replace with:
```ts
import { revalidateData } from '@/app/actions'
// ...
await revalidateData()
```

- [ ] **Step 7: Delete the obsolete modules**

```bash
git rm lib/sheets.ts lib/csv-utils.ts
```

- [ ] **Step 8: Verify build + lint + tests**

Run: `npm run build && npm run lint && npm test`
Expected:
- build succeeds (no references to `@/lib/sheets` or `@/lib/csv-utils` remain).
- lint 0 errors.
- All Jest suites green (`transactions`, `aggregate`, `filter-utils`, `smshj-crypto`, `smshj-cookies`, `smshj-parse`, `machine-hub`).

- [ ] **Step 9: Commit**

```bash
git add app/ components/RefreshButton.tsx lib/sheets.ts lib/csv-utils.ts
git commit -m "Swap pages to ClickHouse; drop Google Sheets ingestion"
```

---

## Task 11: End-to-end verification against the live ClickHouse instance

**Files:** none modified.

- [ ] **Step 1: Restart the dev server**

If a `next dev` process is already running, stop it so the new `instrumentation.ts`-era boot is exercised cleanly:
- Find the PID with `netstat -ano | grep :3000` (Windows / Git Bash).
- `taskkill //F //PID <pid>`.
- `npm run dev` — confirm "Ready in" line; confirm no `.env.local` warning.

- [ ] **Step 2: Curl `/api/machines`**

(Sanity — proves the existing machine port still works.)

Run: `curl -s http://localhost:3000/api/machines | head -c 200`
Expected: a JSON object whose `machines` array has 8 entries (or whatever the live API returns).

- [ ] **Step 3: Open `/dashboard` in a browser**

Confirm:
- KPI cards render with money values prefixed by `៛` (KHR default).
- Click the `៛ KHR` button in the header → it flips to `$ USD` and every KPI / chart / table re-renders with `$X.XX`.
- Click again → back to KHR.
- Reload the page — the previously selected currency is preserved (read from localStorage).

- [ ] **Step 4: Open `/executive-summary` and `/sales-report` and `/database`**

Confirm each page:
- Loads without error.
- The CurrencyToggle is present in the header and switches the displayed unit live.
- Date filter still works (the period filter on exec-summary and sales-report; the filter bar on database).
- Charts and tables show the active-currency numbers.

- [ ] **Step 5: Confirm the spreadsheet cache warning is gone**

Watch the dev console for the previous `Failed to set Next.js data cache https://docs.google.com/...` warning. It must not appear — the Google Sheets fetch is no longer made.

If any step fails, fix the cause before committing the verification step (this task itself produces no commit; it is a gate).

---

## Self-Review Notes

- **Spec coverage:** `lib/clickhouse.ts` (T4), `lib/transactions.ts` (T2), static maps (T3), types (T1), currency-aware aggregate/filter (T5/T6), `CurrencyToggle` + context (T7), formatMoney rendering across components (T8), client wrappers wired (T9), pages swapped + cleanup + RefreshButton + action rename (T10), end-to-end manual (T11). All spec sections covered.
- **Type consistency:** `Currency` defined in T1, used by every subsequent task. `Transaction.currency` declared in T1, populated in T2, consumed in T5/T6, surfaced in T8/T9. `FilterState.currency` declared in T1, populated in T9, consumed in T6. `formatMoney(amount, currency)` declared in T2, called in every component in T8.
- **Out of scope, honored:** server-side aggregation (Approach B), side-by-side dual-currency rendering, writes to ClickHouse, a `product_categories` table.
- **Known risk:** every component touched in Task 8 picks up a new dependency on the `CurrencyContext`; if any wrapper is missed in Task 9 the children render with the default `'KHR'` value silently. The end-to-end check in Task 11 (Steps 3–4 across all four routes) catches that.
- **Known risk:** the 30-minute in-process cache in `lib/clickhouse.ts` is per-process; in dev mode a hot-reload that re-evaluates `lib/clickhouse.ts` resets the cache. This is desirable in dev and acceptable in prod (the `revalidateData` action explicitly clears it on user request).
- **Concern protocol:** any task that would deviate from the above — particularly schema changes, irreversible operations, security surface widening, or workarounds that diverge from this plan — is flagged explicitly to the user before being committed.
