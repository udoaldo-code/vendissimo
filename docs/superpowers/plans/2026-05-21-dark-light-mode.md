# Dark / Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual dark/light theme toggle to the Vendissimo dashboard, replacing 162 hardcoded hex colors with a semantic CSS-variable token system.

**Architecture:** CSS variables defined in `:root` (light) and `.dark` (dark) in `app/globals.css`, exposed as Tailwind utilities via `@theme inline` so utilities resolve the variable at use-time and flip with a `.dark` class on `<html>`. A client `ThemeToggle` component flips the class and persists the choice to `localStorage`. A tiny inline script in the root layout applies the stored theme before first paint to avoid a flash.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, TypeScript strict.

---

## Color Token Map

Every migration task applies this map. **Tailwind class** column = replace the arbitrary-value utility. **CSS var** column = use inside JS color strings, inline `style`, and recharts props.

| Old color | Meaning | Tailwind class | CSS var | Light | Dark |
|-----------|---------|----------------|---------|-------|------|
| `#faf5ff` | page background | `background` | `var(--color-background)` | `#faf5ff` | `#14151a` |
| `#1e1b4b` | primary text | `foreground` | `var(--color-foreground)` | `#1e1b4b` | `#e5e7eb` |
| `bg-white` / `#ffffff` | card / panel surface | `card` | `var(--color-card)` | `#ffffff` | `#1e1f26` |
| `#ede9fe` | borders / dividers | `border` | `var(--color-border)` | `#ede9fe` | `#2e2f38` |
| `#ddd6fe` | hover / strong border | `border-strong` | `var(--color-border-strong)` | `#ddd6fe` | `#3a3b46` |
| `#f5f3ff` | subtle hover surface | `surface-hover` | `var(--color-surface-hover)` | `#f5f3ff` | `#262430` |
| `#9ca3af` | muted text | `muted` | `var(--color-muted)` | `#9ca3af` | `#9ca3af` |
| `#6b7280` | stronger muted text | `muted-strong` | `var(--color-muted-strong)` | `#6b7280` | `#b4b8c2` |
| `#7c3aed` | primary accent (purple) | `accent` | `var(--color-accent)` | `#7c3aed` | `#a78bfa` |
| `#ec4899` | secondary accent (pink) | `accent-pink` | `var(--color-accent-pink)` | `#ec4899` | `#f472b6` |
| `#dc2626` | danger / alert | `danger` | `var(--color-danger)` | `#dc2626` | `#f87171` |

**Usage examples:**
- `bg-[#faf5ff]` → `bg-background`
- `text-[#1e1b4b]` → `text-foreground`
- `bg-white` → `bg-card`
- `border border-[#ede9fe]` → `border border-border`
- `hover:border-[#ddd6fe]` → `hover:border-border-strong`
- `hover:bg-[#f5f3ff]` → `hover:bg-surface-hover`
- `text-[#9ca3af]` → `text-muted`
- `text-[#7c3aed]` → `text-accent`
- inline style `borderLeftColor: '#7c3aed'` → `borderLeftColor: 'var(--color-accent)'`
- recharts `fill: '#6b7280'` → `fill: 'var(--color-muted-strong)'`

### Colors that STAY LITERAL (do not tokenize)

These are data-series colors or always-dark UI bands — they must not flip:

- **`components/executive-summary/TopProductsTable.tsx`** lines 3-11: the `CATEGORY_COLORS` map (`#0ea5e9 #7c3aed #10b981 #f59e0b #8b5cf6 #ec4899 #14b8a6`) — categorical chart colors.
- **`components/executive-summary/LocationPieChart.tsx`** line 6: the `COLORS` array (`#7c3aed #ec4899 #8b5cf6 #f472b6`) — categorical pie colors.
- **`components/executive-summary/DailySalesTable.tsx`** lines 20-33: the `LOCATION_COLORS`, `LOCATION_BG` maps and the `locationColor`/`locationBg` fallbacks (`#dc2626 #1d4ed8 #fee2e2 #dbeafe #7c3aed #f5f3ff`) — data-coded location tinting. (Known minor cosmetic compromise: the light-tint location backgrounds appear bright on the dark surface. Accepted — out of scope to redesign data-row coding.)
- **`components/executive-summary/DailySalesTable.tsx`** the Grand Total row: `bg-[#1e1b4b]`, `text-white`, `border-white/20` (lines ~165-182) — an intentionally always-dark band; leave entirely as-is.
- **`components/executive-summary/WeekdayBarChart.tsx`** line 50: the `Cell` fill `#16a34a` / `#7c3aed` — categorical bar colors.
- **`components/Sidebar.tsx`** line 79: `bg-black` overlay scrim — leave literal.
- Any `text-white` that sits on an accent-filled button or the dark Grand Total row — leave literal.

When in doubt: a color that paints **chrome** (page bg, cards, borders, body text, muted labels) → tokenize. A color that encodes **data** (a chart series, a category) → leave literal.

---

## Task 1: Token layer in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the full contents of `app/globals.css`**

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #faf5ff;
  --foreground: #1e1b4b;
  --card: #ffffff;
  --border: #ede9fe;
  --border-strong: #ddd6fe;
  --surface-hover: #f5f3ff;
  --muted: #9ca3af;
  --muted-strong: #6b7280;
  --accent: #7c3aed;
  --accent-pink: #ec4899;
  --danger: #dc2626;
}

.dark {
  --background: #14151a;
  --foreground: #e5e7eb;
  --card: #1e1f26;
  --border: #2e2f38;
  --border-strong: #3a3b46;
  --surface-hover: #262430;
  --muted: #9ca3af;
  --muted-strong: #b4b8c2;
  --accent: #a78bfa;
  --accent-pink: #f472b6;
  --danger: #f87171;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-surface-hover: var(--surface-hover);
  --color-muted: var(--muted);
  --color-muted-strong: var(--muted-strong);
  --color-accent: var(--accent);
  --color-accent-pink: var(--accent-pink);
  --color-danger: var(--danger);
}

body {
  background-color: var(--background);
  color: var(--foreground);
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
  background: var(--background);
}

::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds. (The new utilities `bg-background`, `text-foreground`, `bg-card`, `border-border`, `border-border-strong`, `bg-surface-hover`, `text-muted`, `text-muted-strong`, `text-accent`, `text-accent-pink`, `text-danger` are not used yet, but defining them must not break the build.)

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Add dark/light color token layer to globals.css"
```

---

## Task 2: Theme toggle component, no-flash script, header wiring

**Files:**
- Create: `components/ThemeToggle.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/executive-summary/page.tsx`
- Modify: `app/database/page.tsx`

- [ ] **Step 1: Create `components/ThemeToggle.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  // The no-flash script (in layout.tsx) has already set the class before
  // hydration; read it on mount so the icon matches.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      // localStorage unavailable (private mode / disabled) — the theme still
      // applies for this session, it just won't persist.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-card border border-border text-muted-strong hover:text-accent hover:border-border-strong shadow-sm transition-colors"
    >
      <span>{isDark ? '☀' : '☾'}</span>
      {isDark ? 'Light' : 'Dark'}
    </button>
  )
}
```

- [ ] **Step 2: Modify `app/layout.tsx`**

Replace the `RootLayout` function body so the `<body>` tag uses the `bg-background` token and a no-flash script runs as the first child of `<body>`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} bg-background`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <Sidebar />
        <div id="page-content" className="pt-14 md:pt-0 md:ml-56">
          {children}
        </div>
      </body>
    </html>
  )
}
```

(Leave the imports, `geist`, and `metadata` export unchanged. `suppressHydrationWarning` is already present and covers the class mutation done by the script.)

- [ ] **Step 3: Modify `app/executive-summary/page.tsx`**

Add the `ThemeToggle` import and render it next to `RefreshButton`. Also migrate the two hex colors (`#1e1b4b`, `#9ca3af`).

Add import:
```tsx
import { ThemeToggle } from '@/components/ThemeToggle'
```

Replace the header `<div>` block:
```tsx
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Executive Summary</h1>
          <p className="text-muted text-xs mt-0.5">
            {transactions.length.toLocaleString()} transactions · All figures in USD
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
```

- [ ] **Step 4: Modify `app/database/page.tsx`**

Add import:
```tsx
import { ThemeToggle } from '@/components/ThemeToggle'
```

Replace the header `<div>` block:
```tsx
      <div className="flex items-center justify-between mb-6 pl-10 md:pl-0">
        <div>
          <h1 className="text-foreground text-xl font-bold">Database</h1>
          <p className="text-muted text-xs mt-0.5">
            Vendissimo Daily Sales 2026 · {transactions.length.toLocaleString()} records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <RefreshButton />
        </div>
      </div>
```

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Manual check**

Run `npm run dev`, open `http://localhost:3000/executive-summary`. Confirm: the Dark/Light button appears next to Refresh; clicking it flips the page background and text; reloading keeps the chosen mode; no flash of the wrong theme on reload. Some inner components are not migrated yet, so they will still look light — that is expected at this stage.

- [ ] **Step 7: Commit**

```bash
git add components/ThemeToggle.tsx app/layout.tsx app/executive-summary/page.tsx app/database/page.tsx
git commit -m "Add theme toggle, no-flash script, and header wiring"
```

---

## Task 3: Migrate shared chrome components

Apply the Color Token Map. `bg-white` → `bg-card`. No literal exceptions in these files except `bg-black` in `Sidebar.tsx` (leave it).

**Files:**
- Modify: `components/KPICard.tsx` — hex present: `#7c3aed`, `#ede9fe`, `#9ca3af` ×2; also `bg-white`.
- Modify: `components/ErrorState.tsx` — hex present: `#1e1b4b`, `#6b7280`, `#7c3aed` ×4.
- Modify: `components/RefreshButton.tsx` — hex present: `#ede9fe`, `#6b7280`, `#7c3aed`, `#ddd6fe`; also `bg-white`.
- Modify: `components/Sidebar.tsx` — hex present: `#ede9fe` ×4, `#9ca3af` ×2, `#7c3aed` ×3, `#f5f3ff`, `#6b7280`, `#1e1b4b`, `#faf5ff`; `bg-white` ×2; `bg-black` (leave literal).

- [ ] **Step 1: Migrate `components/KPICard.tsx`**

Replace each hex utility per the map: `bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#9ca3af]` → `text-muted`; `text-[#7c3aed]` → `text-accent`. If `#7c3aed` is used in an inline `style` or as a JS value, use `var(--color-accent)`.

- [ ] **Step 2: Migrate `components/ErrorState.tsx`**

`text-[#1e1b4b]` → `text-foreground`; `text-[#6b7280]` → `text-muted-strong`; `#7c3aed` → `accent` token (`bg-accent` / `text-accent` / `hover:bg-accent` as the existing class dictates).

- [ ] **Step 3: Migrate `components/RefreshButton.tsx`**

`bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#6b7280]` → `text-muted-strong`; `hover:text-[#7c3aed]` → `hover:text-accent`; `hover:border-[#ddd6fe]` → `hover:border-border-strong`.

- [ ] **Step 4: Migrate `components/Sidebar.tsx`**

`bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#9ca3af]` → `text-muted`; `text-[#7c3aed]` / `bg-[#7c3aed]` → `accent` token; `bg-[#f5f3ff]` → `bg-surface-hover`; `text-[#6b7280]` → `text-muted-strong`; `text-[#1e1b4b]` → `text-foreground`; `bg-[#faf5ff]` → `bg-background`. Leave `bg-black` (overlay scrim) literal.

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Verify no stray hex remains in these four files**

Run: `npx grep` is not needed — use the editor search, or run `git grep -nE "#[0-9a-fA-F]{6}|bg-white" -- components/KPICard.tsx components/ErrorState.tsx components/RefreshButton.tsx components/Sidebar.tsx`
Expected: only `bg-black` (Sidebar) remains. No `#rrggbb`, no `bg-white`.

- [ ] **Step 7: Commit**

```bash
git add components/KPICard.tsx components/ErrorState.tsx components/RefreshButton.tsx components/Sidebar.tsx
git commit -m "Migrate shared chrome components to color tokens"
```

---

## Task 4: Migrate database components

Apply the Color Token Map. `bg-white` → `bg-card`. No literal exceptions in these files.

**Files:**
- Modify: `components/database/FilterBar.tsx` — hex: `#ede9fe` ×3, `#1e1b4b` ×2, `#7c3aed` ×3, `#9ca3af`, `#6b7280`, `#ddd6fe`; `bg-white` ×2.
- Modify: `components/database/SummaryBar.tsx` — hex: `#ede9fe` ×3, `#9ca3af` ×4, `#7c3aed`, `#ec4899`, `#1e1b4b`; `bg-white`.
- Modify: `components/database/TransactionsTable.tsx` — hex: `#9ca3af` ×3, `#7c3aed` ×4, `#6b7280` ×3, `#ede9fe` ×6, `#faf5ff`, `#1e1b4b`, `#f5f3ff` ×2; `bg-white`.
- Modify: `components/database/ExportCSVButton.tsx` — hex: `#7c3aed` ×4 (button accent — `bg-accent` / `hover:bg-accent` / `text-accent` etc. per existing classes).

- [ ] **Step 1: Migrate `components/database/FilterBar.tsx`**

Apply the map: `bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#1e1b4b]` → `text-foreground`; `#7c3aed` → `accent` token; `text-[#9ca3af]` → `text-muted`; `text-[#6b7280]` → `text-muted-strong`; `border-[#ddd6fe]` → `border-border-strong`. For `focus:`/`hover:` variants keep the variant prefix (e.g. `focus:border-[#7c3aed]` → `focus:border-accent`).

- [ ] **Step 2: Migrate `components/database/SummaryBar.tsx`**

`bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#9ca3af]` → `text-muted`; `text-[#7c3aed]` → `text-accent`; `text-[#ec4899]` → `text-accent-pink`; `text-[#1e1b4b]` → `text-foreground`.

- [ ] **Step 3: Migrate `components/database/TransactionsTable.tsx`**

`bg-white` → `bg-card`; `text-[#9ca3af]` → `text-muted`; `#7c3aed` → `accent` token; `text-[#6b7280]` → `text-muted-strong`; `border-[#ede9fe]` → `border-border`; `bg-[#faf5ff]` → `bg-background`; `text-[#1e1b4b]` → `text-foreground`; `bg-[#f5f3ff]` / `hover:bg-[#f5f3ff]` → `bg-surface-hover` / `hover:bg-surface-hover`.

- [ ] **Step 4: Migrate `components/database/ExportCSVButton.tsx`**

Replace each `#7c3aed` with the `accent` token, preserving the existing utility prefix (`bg-`, `hover:bg-`, `text-`, `border-`).

- [ ] **Step 5: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 6: Verify no stray hex remains**

Run: `git grep -nE "#[0-9a-fA-F]{6}|bg-white" -- components/database/`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add components/database/FilterBar.tsx components/database/SummaryBar.tsx components/database/TransactionsTable.tsx components/database/ExportCSVButton.tsx
git commit -m "Migrate database components to color tokens"
```

---

## Task 5: Migrate executive-summary non-chart components

Apply the Color Token Map. `bg-white` → `bg-card`. **Honor the literal exceptions** listed in the Color Token Map section.

**Files:**
- Modify: `components/executive-summary/ExecSummaryClient.tsx` — hex: `#7c3aed` ×2, `#ec4899`, `#dc2626`, `#9ca3af` ×2, `#ede9fe`; `bg-white`. The `mobileKpis` array (lines ~41-46) has `accent` properties holding hex JS values — set those to `var(--color-accent)`, `var(--color-accent-pink)`, `var(--color-accent)`, `var(--color-danger)`.
- Modify: `components/executive-summary/KPISidebar.tsx` — hex: `#7c3aed` ×2, `#ec4899` ×2, `#dc2626`. If used in inline `style`/JS, use the `var(--color-*)` form; if in `className`, use the token utility.
- Modify: `components/executive-summary/DateFilter.tsx` — hex: `#7c3aed` ×5, `#6b7280`, `#ede9fe` ×3, `#1e1b4b`, `#9ca3af` ×3; `bg-white` ×3, `text-white` (leave `text-white` literal — it sits on an accent-filled active button).
- Modify: `components/executive-summary/TopProductsTable.tsx` — hex: `#ede9fe`, `#9ca3af` ×2, `#1e1b4b` ×2, `#6b7280` ×2, `#f5f3ff`, `#7c3aed`; `bg-white`; `text-white`. **Leave the `CATEGORY_COLORS` map (lines 3-11) entirely literal.** Leave `text-white` literal. Migrate everything else.
- Modify: `components/executive-summary/MachinePerformanceTable.tsx` — hex: `#ede9fe` ×2, `#9ca3af` ×3, `#7c3aed` ×2, `#faf5ff`, `#6b7280` ×2, `#1e1b4b`; `bg-white`.
- Modify: `components/executive-summary/DailySalesTable.tsx` — hex (many): `#ede9fe`, `#9ca3af`, `#6b7280`, `#1e1b4b`, `#f5f3ff`, `#faf5ff`, `#7c3aed`, plus literal-exception colors. `bg-white` ×2 (lines ~66, ~143) → `bg-card`. **Leave entirely literal:** the `LOCATION_COLORS` / `LOCATION_BG` maps and `locationColor`/`locationBg` fallbacks (lines 20-33), and the Grand Total row block (`bg-[#1e1b4b]`, `text-[#a78bfa]`, `text-white`, `border-white/20`, lines ~165-182). Migrate all *other* `#ede9fe` / `#9ca3af` / `#6b7280` / `#1e1b4b` / `#f5f3ff` / `#faf5ff` / `#7c3aed` occurrences per the map.

- [ ] **Step 1: Migrate `components/executive-summary/ExecSummaryClient.tsx`**

Apply the map to all classNames. For the `mobileKpis` array, change the JS hex values: `'#7c3aed'` → `'var(--color-accent)'`, `'#ec4899'` → `'var(--color-accent-pink)'`, `'#dc2626'` → `'var(--color-danger)'`. These flow into `style={{ borderLeftColor: k.accent }}` and `style={{ color: k.accent }}`, both of which accept `var()`.

- [ ] **Step 2: Migrate `components/executive-summary/KPISidebar.tsx`**

Apply the map. For any hex inside an inline `style` object use the `var(--color-*)` form; for `className` utilities use the token class.

- [ ] **Step 3: Migrate `components/executive-summary/DateFilter.tsx`**

Apply the map: `bg-white` → `bg-card`; `#7c3aed` → `accent` token; `text-[#6b7280]` → `text-muted-strong`; `border-[#ede9fe]` → `border-border`; `text-[#1e1b4b]` → `text-foreground`; `text-[#9ca3af]` → `text-muted`. Leave `text-white` literal.

- [ ] **Step 4: Migrate `components/executive-summary/TopProductsTable.tsx`**

Leave `CATEGORY_COLORS` (lines 3-11) literal. Leave `text-white` literal. Apply the map to everything else: `bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#9ca3af]` → `text-muted`; `text-[#1e1b4b]` → `text-foreground`; `text-[#6b7280]` → `text-muted-strong`; `bg-[#f5f3ff]` → `bg-surface-hover`; `#7c3aed` (non-map use) → `accent` token.

- [ ] **Step 5: Migrate `components/executive-summary/MachinePerformanceTable.tsx`**

Apply the map: `bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#9ca3af]` → `text-muted`; `#7c3aed` → `accent` token; `bg-[#faf5ff]` → `bg-background`; `text-[#6b7280]` → `text-muted-strong`; `text-[#1e1b4b]` → `text-foreground`.

- [ ] **Step 6: Migrate `components/executive-summary/DailySalesTable.tsx`**

Leave the `LOCATION_COLORS` / `LOCATION_BG` / `locationColor` / `locationBg` definitions (lines 20-33) literal. Leave the Grand Total `<tr>` block (lines ~165-182: `bg-[#1e1b4b]`, `text-[#a78bfa]`, `text-white`, `border-white/20`) literal. Apply the map to every other occurrence: `bg-white` → `bg-card`; `border-[#ede9fe]` → `border-border`; `text-[#9ca3af]` → `text-muted`; `text-[#6b7280]` → `text-muted-strong`; `text-[#1e1b4b]` → `text-foreground` (only outside the Grand Total row); `bg-[#f5f3ff]` → `bg-surface-hover`; `bg-[#faf5ff]` → `bg-background`; `#7c3aed` (chrome use) → `accent` token.

- [ ] **Step 7: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 8: Commit**

```bash
git add components/executive-summary/ExecSummaryClient.tsx components/executive-summary/KPISidebar.tsx components/executive-summary/DateFilter.tsx components/executive-summary/TopProductsTable.tsx components/executive-summary/MachinePerformanceTable.tsx components/executive-summary/DailySalesTable.tsx
git commit -m "Migrate executive-summary components to color tokens"
```

---

## Task 6: Migrate executive-summary chart components (recharts)

Recharts color props are JS strings — use the `var(--color-*)` form, not Tailwind classes. Tailwind classes still apply to the surrounding card `<div>`.

**Files:**
- Modify: `components/executive-summary/MonthlyRevenueChart.tsx` — hex: `#ede9fe` ×2, `#9ca3af`, `#6b7280` ×2, `#ffffff`, `#1e1b4b`, `#f5f3ff`, `#7c3aed`; `bg-white`.
- Modify: `components/executive-summary/WeekdayBarChart.tsx` — hex: `#ede9fe` ×2, `#9ca3af`, `#6b7280` ×2, `#ffffff`, `#1e1b4b`, `#f5f3ff`, `#16a34a`, `#7c3aed`; `bg-white`.
- Modify: `components/executive-summary/LocationPieChart.tsx` — hex: `COLORS` array (line 6, **literal**), `#ede9fe`, `#9ca3af`, `#ffffff`, `#1e1b4b`, `#6b7280`; `bg-white`.

- [ ] **Step 1: Migrate `components/executive-summary/MonthlyRevenueChart.tsx`**

- Card `<div>`: `bg-white` → `bg-card`, `border-[#ede9fe]` → `border-border`.
- Label classNames: `text-[#9ca3af]` → `text-muted`.
- Recharts grid/axis props: `#ede9fe` → `var(--color-border)`; `fill: '#6b7280'` → `fill: 'var(--color-muted-strong)'`.
- `Tooltip` `contentStyle`: `background: '#ffffff'` → `background: 'var(--color-card)'`, `border: '1px solid #ede9fe'` → `border: '1px solid var(--color-border)'`.
- `Tooltip` `labelStyle`: `color: '#1e1b4b'` → `color: 'var(--color-foreground)'`.
- `cursor` fill `#f5f3ff` → `var(--color-surface-hover)`.
- The bar/area series fill `#7c3aed` → `var(--color-accent)`.

- [ ] **Step 2: Migrate `components/executive-summary/WeekdayBarChart.tsx`**

- Card `<div>` line 28: `bg-white` → `bg-card`, `border border-[#ede9fe]` → `border border-border`.
- Label line 29: `text-[#9ca3af]` → `text-muted`.
- `XAxis` tick line 34 `fill: '#6b7280'` → `fill: 'var(--color-muted-strong)'`.
- `YAxis` tick line 41 `fill: '#6b7280'` → `fill: 'var(--color-muted-strong)'`.
- `Tooltip` line 43 `contentStyle`: `background: '#ffffff'` → `'var(--color-card)'`, `border: '1px solid #ede9fe'` → `'1px solid var(--color-border)'`.
- `Tooltip` line 44 `labelStyle`: `color: '#1e1b4b'` → `'var(--color-foreground)'`.
- `Tooltip` line 46 `cursor`: `fill: '#f5f3ff'` → `'var(--color-surface-hover)'`.
- Line 50 `Cell` fill `d.revenue === maxRev ? '#16a34a' : '#7c3aed'` → **leave literal** (categorical bar colors).

- [ ] **Step 3: Migrate `components/executive-summary/LocationPieChart.tsx`**

- `COLORS` array line 6 → **leave literal**.
- Card `<div>`: `bg-white` → `bg-card`, `border-[#ede9fe]` → `border-border`.
- Label: `text-[#9ca3af]` → `text-muted`.
- `Tooltip` `contentStyle`: `background: '#ffffff'` → `'var(--color-card)'`, `border ... #ede9fe` → `var(--color-border)`.
- Tooltip label / text `#1e1b4b` → `var(--color-foreground)`; `#6b7280` → `var(--color-muted-strong)`.

- [ ] **Step 4: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add components/executive-summary/MonthlyRevenueChart.tsx components/executive-summary/WeekdayBarChart.tsx components/executive-summary/LocationPieChart.tsx
git commit -m "Migrate executive-summary chart components to color tokens"
```

---

## Task 7: Full verification

**Files:** none modified (verification only).

- [ ] **Step 1: Confirm no un-migrated chrome colors remain**

Run: `git grep -nE "#[0-9a-fA-F]{6}|bg-white" -- "components/*" "app/*"`

Expected: the only matches are the documented literal exceptions —
- `components/executive-summary/TopProductsTable.tsx` `CATEGORY_COLORS` map
- `components/executive-summary/LocationPieChart.tsx` `COLORS` array
- `components/executive-summary/DailySalesTable.tsx` `LOCATION_COLORS` / `LOCATION_BG` / fallbacks and the Grand Total row (`#1e1b4b`, `#a78bfa`)
- `components/executive-summary/WeekdayBarChart.tsx` `Cell` fill (`#16a34a`, `#7c3aed`)

Any other `#rrggbb` or `bg-white` is a miss — go back and migrate it.

- [ ] **Step 2: Run the test suite**

Run: `npm test`
Expected: all tests in `tests/` pass. (No `lib/` logic was touched, so the suite must be unchanged and green.)

- [ ] **Step 3: Production build + lint**

Run: `npm run build && npm run lint`
Expected: both succeed with no errors.

- [ ] **Step 4: Manual visual check**

Run `npm run dev`. For **both** `/executive-summary` and `/database`, in **both** light and dark mode, confirm:
- Page background, cards, borders, body text, and muted labels all flip correctly.
- Charts (monthly revenue, weekday, location pie) are readable in dark mode — axes, tooltips, and grid lines are visible against the dark surface.
- The Dark/Light toggle button itself is styled correctly in both modes.
- Toggling, then reloading, preserves the chosen mode.
- No flash of the wrong theme on reload when dark mode is active.
- The Database `TransactionsTable`, `DailySalesTable`, and all KPI cards render with correct contrast.

- [ ] **Step 5: Final commit (if Step 1 or 4 required fixes)**

```bash
git add -A
git commit -m "Fix remaining color-token migration gaps"
```

If Steps 1-4 all passed with no fixes needed, skip this step.

---

## Self-Review Notes

- **Spec coverage:** token layer (Task 1), toggle + placement + persistence + no-flash (Task 2), 21-file migration (Tasks 3-6), recharts (Task 6), verification incl. existing tests green + build + lint + manual (Task 7). All spec sections covered.
- **Palette:** matches the approved spec table; dark accents brightened (`#a78bfa`, `#f472b6`, `#f87171`); `--muted-strong` lightened in dark (`#b4b8c2`) because `#6b7280` is too dark on the dark surface — this is an addition beyond the spec's 7-token starter table, allowed by the spec ("additional tokens are added if a color does not fit").
- **Literal exceptions** are enumerated once in the Color Token Map section and referenced by each task — categorical chart colors and the always-dark Grand Total row.
