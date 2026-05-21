# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # dev server (localhost:3000)
npm run build        # production build
npm run lint         # eslint (eslint-config-next, flat config)
npm test             # jest, all tests
npm run test:watch   # jest watch mode
npx jest tests/sheets.test.ts          # run a single test file
npx jest -t "parseExecSummary"         # run tests matching a name
```

Next.js 16 / React 19, Tailwind v4, TypeScript strict. Path alias `@/*` maps to repo root.
Jest runs in `node` environment (not jsdom); `testMatch` only picks up `tests/**/*.test.ts` — tests live in `tests/`, not colocated.

## Architecture

Read-only sales dashboard for Vendissimo vending machines. Data source is two **public Google Sheets CSV exports** — there is no database and no write path.

### Data flow

`lib/sheets.ts` is the single ingestion point. It fetches two CSVs from one spreadsheet (different `gid`):
- **Exec summary tab** (`EXEC_URL`) — pre-aggregated sections (KPIs, monthly, products, machines, weekday).
- **Database tab** (`DB_URL`) — raw transaction rows.

`fetch` uses `next: { revalidate: 1800 }` (30 min ISR cache). Both page routes also set `export const dynamic = 'force-dynamic'`.

Page → `lib` → client component is the standard path:
- `app/executive-summary/page.tsx` — server component fetches **both** CSVs, passes raw `transactions` + a `categoryMap` (product→category, derived from the exec tab since raw rows lack categories) to `ExecSummaryClient`.
- `app/database/page.tsx` — fetches only the database CSV, passes raw `transactions` to `DatabaseClient`.
- `app/page.tsx` redirects to `/executive-summary`.

### Key design point: exec summary is recomputed client-side

`parseExecSummary` parses the exec CSV but the executive-summary page does **not** use those aggregates for display. Instead it passes raw transactions to the client, and `ExecSummaryClient` calls `aggregateTransactions` (`lib/aggregate.ts`) to recompute everything from scratch. This is what makes the date-range filter work — `filterByDateRange` slices transactions, then aggregates re-run via `useMemo`. `aggregateTransactions` is the source of truth for all exec-summary numbers (KPIs, monthly + MoM growth, products, machines, weekday, daily, and the machine×date `dailySales` pivot).

### CSV parsing

`lib/csv-utils.ts` — `parseCSV` is a quote-aware state machine (handles embedded commas/newlines, `""` escapes). The exec tab has no fixed schema: `findSectionRow` locates sections by searching for marker text (e.g. `'KEY PERFORMANCE INDICATORS'`), then code reads at fixed row offsets from the marker. **Section parsing is brittle to sheet layout changes** — adding/removing rows in the spreadsheet shifts offsets. `parseNum` strips `$`, `,`, `%` and non-numeric chars.

### Date handling

Transaction dates arrive in mixed formats. `parseTransactionDate` (`lib/filter-utils.ts`) handles both `M/D/YYYY` and `D-Mon-YY` / `D-Mon-YYYY`. Always parse dates through this function — never `new Date(str)` directly. Bad dates return `new Date(NaN)`; aggregation code filters `isNaN` defensively.

### Filtering

- Database page: `filterTransactions` (`lib/filter-utils.ts`) — search is a **fuzzy subsequence match** on product/machine (not substring), plus exact machine/location/product dropdowns and a date range.
- Exec summary page: `filterByDateRange` only.

### Refresh

`RefreshButton` calls the `revalidateSheets` server action (`app/actions.ts`), which does `revalidatePath('/', 'layout')`, then `router.refresh()` — busts the ISR cache to re-pull the sheets.

### Components

`components/executive-summary/` and `components/database/` mirror the two routes. Charts use `recharts`. Layout is a fixed `Sidebar` + content offset (`md:ml-56`); components are built mobile-first with separate mobile/desktop render branches.

### Tests

`tests/` covers pure logic only — CSV parsing, date parsing, filtering, aggregation. No component tests. When changing `lib/` parsing or aggregation, run the relevant test file.
