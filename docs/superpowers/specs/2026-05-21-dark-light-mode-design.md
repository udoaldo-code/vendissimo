# Dark / Light Mode — Design Spec

Date: 2026-05-21
Status: Approved

## Goal

Add a dark/light theme system to the Vendissimo dashboard. Currently the UI is light-only, with 162 hardcoded hex colors spread across 21 component/page/CSS files. This spec replaces the hardcoded colors with a semantic token system that flips between two palettes.

## Decisions

- **Mode selection:** manual toggle only. No OS preference detection. Default is light on first visit.
- **Persistence:** the chosen mode is saved to `localStorage` and survives page reloads.
- **Toggle placement:** in the page header, next to the existing `RefreshButton`, on both routes (`/executive-summary` and `/database`).
- **Strategy:** semantic color tokens via CSS variables + Tailwind v4 `@theme inline` (chosen over per-utility `dark:` variants — fewer edits, single source of truth, cleaner recharts handling).

## Palette

Accent colors are brightened in dark mode so contrast stays adequate on dark surfaces.

| Token             | Light (current) | Dark (Slate Charcoal) |
|-------------------|-----------------|-----------------------|
| `--background`    | `#faf5ff`       | `#14151a`             |
| `--foreground`    | `#1e1b4b`       | `#e5e7eb`             |
| `--card`          | `#ffffff`       | `#1e1f26`             |
| `--border`        | `#ede9fe`       | `#2e2f38`             |
| `--muted`         | `#9ca3af`       | `#9ca3af`             |
| `--accent`        | `#7c3aed`       | `#a78bfa`             |
| `--accent-pink`   | `#ec4899`       | `#f472b6`             |

This table is the **starting** token set. The exact final set is finalized during the implementation audit (step 4 below) — every one of the 162 hardcoded hex values is mapped to a token, and additional tokens are added if a color does not fit the seven above (e.g. danger red `#dc2626`, secondary purple-tint borders `#ddd6fe`, muted text `#6b7280`, scrollbar shades). Any color that genuinely never needs to flip may stay literal, but that must be a deliberate per-color decision recorded in the implementation plan.

## Architecture

### 1. Token layer — `app/globals.css`

Tailwind v4 theme-switching pattern: CSS variables defined in `:root` (light) and `.dark` (dark), exposed as Tailwind utilities via `@theme inline` so the utilities resolve the variable at use-time and therefore flip with the `.dark` class.

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #faf5ff;
  --foreground: #1e1b4b;
  --card: #ffffff;
  --border: #ede9fe;
  --muted: #9ca3af;
  --accent: #7c3aed;
  --accent-pink: #ec4899;
  /* + remaining tokens from the audit */
}

.dark {
  --background: #14151a;
  --foreground: #e5e7eb;
  --card: #1e1f26;
  --border: #2e2f38;
  --muted: #9ca3af;
  --accent: #a78bfa;
  --accent-pink: #f472b6;
  /* + remaining tokens from the audit */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-pink: var(--accent-pink);
  /* + remaining tokens from the audit */
}
```

This produces utilities like `bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-muted`, `bg-accent`, `text-accent-pink`, etc.

The `body` rule and `::-webkit-scrollbar*` rules in `globals.css` are updated to reference the variables instead of literal hex.

### 2. Theme toggle — `components/ThemeToggle.tsx` (new file)

Client component (`'use client'`).

- Renders a button styled to match `RefreshButton` (same size/border/shadow conventions).
- On click: toggles the `dark` class on `document.documentElement`, then writes `localStorage.setItem('theme', 'dark' | 'light')`.
- On mount: reads the current state from the presence of the `dark` class (already set by the no-flash script, see below) to render the correct icon (sun/moon).
- Icon reflects current mode.

### 3. No-flash init script — `app/layout.tsx`

A small inline `<script>` runs before first paint. It reads `localStorage['theme']` and adds the `dark` class to `<html>` when the stored value is `'dark'`. Light is the default, so the script only ever needs to *add* the class, never remove it.

`<html>` already has `suppressHydrationWarning` (added earlier to absorb a browser-extension attribute), which also covers the class mutation this script performs — no extra hydration noise.

### 4. Component migration — 21 files

Audit every hardcoded hex (`#rrggbb`) in `components/**` and `app/**` (`.tsx`/`.css`). For each:

- Map it to a semantic token and replace the literal utility with the token utility — e.g. `bg-[#faf5ff]` → `bg-background`, `text-[#1e1b4b]` → `text-foreground`, `border-[#ede9fe]` → `border-border`.
- If a color is decided to never flip, leave it literal — but record that decision.

Files touched (current hex counts, per the audit grep):

```
app/layout.tsx (1)            app/globals.css (5)
app/executive-summary/page.tsx (2)   app/database/page.tsx (2)
components/ErrorState.tsx (3)        components/KPICard.tsx (4)
components/RefreshButton.tsx (1)     components/Sidebar.tsx (9)
components/database/ExportCSVButton.tsx (1)
components/database/FilterBar.tsx (3)
components/database/SummaryBar.tsx (10)
components/database/TransactionsTable.tsx (13)
components/executive-summary/DailySalesTable.tsx (38)
components/executive-summary/DateFilter.tsx (7)
components/executive-summary/ExecSummaryClient.tsx (7)
components/executive-summary/KPISidebar.tsx (5)
components/executive-summary/LocationPieChart.tsx (6)
components/executive-summary/MachinePerformanceTable.tsx (11)
components/executive-summary/MonthlyRevenueChart.tsx (9)
components/executive-summary/TopProductsTable.tsx (17)
components/executive-summary/WeekdayBarChart.tsx (8)
```

### 5. Recharts

Chart components pass colors as string props (`fill`, `stroke`, grid/axis colors, etc.). Replace literal hex with `var(--color-accent)` / `var(--color-accent-pink)` / etc. SVG `fill` and `stroke` accept `var()` references, so chart colors flip with the theme like everything else. Tooltip / label inline styles likewise use `var()` strings.

## Error handling

- `localStorage` access is wrapped so a disabled-storage environment falls back silently to light mode (no throw).
- No network or data-path changes — this is a presentation-only feature.

## Testing

`tests/` covers pure logic only (CSV parsing, date parsing, filtering, aggregation). Dark mode introduces no new pure logic, so no new unit tests.

Verification:
- Existing test suite (`npm test`) still passes — the migration must not touch `lib/` logic.
- `npm run build` and `npm run lint` succeed.
- Manual visual check of both routes in both modes: toggle works, choice persists across reload, no flash of wrong theme on load, charts readable in dark mode.

## Out of scope (YAGNI)

- OS `prefers-color-scheme` detection.
- A third "auto" mode.
- `<meta name="theme-color">` / browser-chrome theming.
- Per-component theme overrides.
