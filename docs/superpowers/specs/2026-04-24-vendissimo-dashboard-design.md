# Vendissimo Vending Machine KH — Dashboard Design Spec

**Date:** 2026-04-24  
**Status:** Approved

---

## Overview

Next.js 15 dashboard for Vendissimo Vending Machine KH with two pages: Executive Summary and Database. Data sourced live from two Google Sheets tabs via CSV export (no API key required). Vendissimo Brand dark theme (stone background, orange/amber/red accents).

---

## Data Sources

| Sheet | URL | Content |
|---|---|---|
| Executive Summary | `https://docs.google.com/spreadsheets/d/1K68zOQ5iHvIgt4ZIF6xSaqzx5yyTJuhV/export?format=csv` | KPIs, monthly revenue, product rankings, machine performance, day-of-week revenue |
| Database | `https://docs.google.com/spreadsheets/d/1K68zOQ5iHvIgt4ZIF6xSaqzx5yyTJuhV/export?format=csv&gid=602546910` | ~12,735 raw transaction rows: Machine, Location, Product, Unit Price, Qty, Time, Date |

Both sheets are publicly shared — no auth needed.

---

## Tech Stack

- **Framework:** Next.js 15, App Router, TypeScript
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Data:** Server-side CSV fetch with ISR (30-min revalidation) + Server Action for manual refresh

---

## Architecture

```
Google Sheets CSV Export
        │
        ▼
lib/sheets.ts
  fetchExecutiveSummary()  — fetches + parses exec CSV → typed KPI/monthly/product/machine data
  fetchDatabase()          — fetches + parses DB CSV → Transaction[]

Next.js App Router
  app/
    layout.tsx                  — root layout with sidebar nav
    page.tsx                    — redirect to /executive-summary
    executive-summary/
      page.tsx                  — Server Component
    database/
      page.tsx                  — Server Component (passes rows to client components)
    actions.ts                  — revalidateSheets() Server Action

components/
  Sidebar.tsx                   — nav: Executive Summary | Database
  RefreshButton.tsx             — client, calls revalidateSheets() + router.refresh()
  KPICard.tsx                   — shared KPI display card
  executive-summary/
    KPISidebar.tsx
    MonthlyRevenueChart.tsx     — Recharts BarChart
    LocationPieChart.tsx        — Recharts PieChart
    WeekdayBarChart.tsx         — Recharts BarChart
    TopProductsTable.tsx        — ranked list with progress bars
    MachinePerformanceTable.tsx
  database/
    SummaryBar.tsx              — live totals (rows shown, revenue sum, unit count)
    FilterBar.tsx               — search + machine/location/product dropdowns + date range
    TransactionsTable.tsx       — sortable, filtered table
    ExportCSVButton.tsx         — downloads filtered rows as CSV
```

---

## Data Flow — Refresh

1. Page load → server component calls `fetchExecutiveSummary()` / `fetchDatabase()`
2. `fetch()` uses `next: { revalidate: 1800 }` — cached 30 min, auto-refreshes in background
3. Manual refresh button → `revalidateSheets()` Server Action → `revalidatePath('/', 'layout')` → `router.refresh()` on client → server re-fetches CSV fresh

---

## Data Models

```ts
type KPIs = {
  totalRevenue: number
  totalTransactions: number
  unitsSold: number
  avgDailyRevenue: number
  peakDayRevenue: number
  peakDayDate: string
  activeMachines: number
  activeLocations: number
}

type MonthlyRow = {
  month: string
  revenue: number
  transactions: number
  unitsSold: number
  momGrowth: string | null
}

type ProductRow = {
  product: string
  revenue: number
  unitsSold: number
  revenueShare: number
  avgUnitPrice: number
  category: string
}

type MachineRow = {
  location: string
  machine: string
  revenue: number
  unitsSold: number
  revShare: number
}

type WeekdayRevenue = {
  sun: number; mon: number; tue: number; wed: number
  thu: number; fri: number; sat: number
}

type Transaction = {
  machine: string
  location: string
  product: string
  unitPrice: number
  qty: number
  time: string
  date: string
}
```

CSV parse notes:
- Column A is always empty in both sheets; data starts at column B (index 1)
- **Executive Summary sheet** — multi-section report, not a flat table. Parse by scanning for section-header strings and reading data rows beneath each:
  - KPIs: find row containing `TOTAL REVENUE` → next row has values (cols B–H)
  - Monthly: find row containing `MONTHLY REVENUE SUMMARY` → next 13 rows are Jan–Dec + TOTAL
  - Products: find row containing `PRODUCT PERFORMANCE` → rows until next blank section
  - Machines: find row containing `LOCATION & MACHINE PERFORMANCE` → rows until next blank section
  - Weekday: find row containing `REVENUE BY DAY OF WEEK` → next row has Sun–Sat values
- **Database sheet**: skip first 4 rows, row 5 is column header (Name of Machine, Location, Product, Unit Price, Qty, Time, Date), rows 6+ are transactions
- Strip `$`, `,`, `%` from numeric strings before parsing as float

---

## Pages

### Executive Summary

Layout B — KPIs left sidebar, charts right.

**Left sidebar:**
- KPICard × 4: Total Revenue / Total Transactions / Avg Daily Revenue / Machines + Locations
- PeakDayCard: peak revenue + date

**Right panel (stacked):**
1. MonthlyRevenueChart — Recharts BarChart, Jan–Dec (zeros shown as empty)
2. Row: LocationPieChart (Hospital 73% / Airport 19%) + WeekdayBarChart (Sun–Sat)
3. TopProductsTable — ranked by revenue, with inline progress bars, category badge
4. MachinePerformanceTable — grouped by location → machines

### Database

**SummaryBar (top, client):** Updates live as filters change — shows count of rows displayed, total revenue, total units.

**FilterBar (client):**
- Text search: product or machine name
- Dropdowns: Machine, Location, Product (populated from data)
- Date range: from / to date pickers

**TransactionsTable (client):** Sortable columns — Date, Time, Machine, Location, Product, Unit Price, Qty, Revenue (unitPrice × qty). Paginated (100 rows/page).

**ExportCSVButton:** Downloads currently-filtered rows as `.csv`.

---

## Visual Theme — Vendissimo Brand

| Element | Value |
|---|---|
| Page background | `#1c1917` (stone-900) |
| Card background | `#292524` (stone-800) |
| Border/divider | `#44403c` (stone-700) |
| Primary accent | `#f97316` (orange-500) |
| Secondary accent | `#fbbf24` (amber-400) |
| Danger/highlight | `#ef4444` (red-500) |
| Primary text | `#e7e5e4` (stone-200) |
| Muted text | `#a8a29e` (stone-400) |

KPI cards: left border accent color per metric. Charts: orange bars, amber secondary series.

---

## Error Handling

- CSV fetch fails + cache exists → serve cached data + show stale warning banner
- CSV fetch fails + no cache → show full error state with retry button
- Malformed CSV row → skip row, log to console, continue parsing

---

## Out of Scope

- Authentication / login
- Write-back to Google Sheets
- Mobile-specific layout (responsive but not mobile-first)
- Historical comparison beyond what's in the sheet
