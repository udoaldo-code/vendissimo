# Vendissimo Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Redis-backed override layer that lets the team rename machines, reassign locations, and reorder rows in the Sales Report UI; merged data propagates to all pages and the Wilson daily-report endpoint.

**Architecture:** Upstash Redis stores a single JSON key with override entries; `lib/clickhouse.ts` applies overrides during transaction load; `/api/overrides` POST writes the JSON behind a bcrypt-protected HMAC cookie session; the Sales Report mounts an `EditContext` that toggles inline rename + `@dnd-kit` sortable rows.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, `@upstash/redis`, `@dnd-kit/core` + `@dnd-kit/sortable`, `bcryptjs`, `zod`, Jest.

**Spec:** `docs/superpowers/specs/2026-05-25-vendissimo-overrides-design.md`

---

## File Map

**New:**
- `lib/overrides.ts` — Redis client, getOverrides/setOverrides, merge helpers
- `lib/edit-auth.ts` — bcrypt compare + HMAC cookie session
- `lib/daily-report.ts` — Wilson endpoint aggregation
- `app/api/overrides/route.ts` — GET / POST
- `app/api/edit-login/route.ts` — POST
- `app/api/edit-logout/route.ts` — POST
- `app/api/daily-report/route.ts` — GET (header auth)
- `components/edit-mode/EditContext.tsx`
- `components/edit-mode/EditModeToggle.tsx`
- `components/edit-mode/PasswordModal.tsx`
- `components/edit-mode/EditBanner.tsx`
- `tests/overrides.test.ts`
- `tests/edit-auth.test.ts`
- `tests/aggregate-with-overrides.test.ts`

**Modified:**
- `lib/types.ts` — add `Overrides`, `MachineOverride`, `LocationOverride`
- `lib/clickhouse.ts` — apply overrides in `fetchTransactions`
- `lib/aggregate.ts` — pass through merged names/locations
- `components/executive-summary/DailySalesTable.tsx` — drag-drop + inline rename when `isEditMode`
- `components/executive-summary/ExecSummaryClient.tsx` — wrap with `EditProvider`
- `app/sales-report/page.tsx` — pass `isEditMode` to client
- `.env.local` / Vercel — add `EDIT_PASSWORD_HASH`, `EDIT_SESSION_SECRET`, `HERMES_TOKEN`

---

## Task 1: Install dependencies

**Files:** none (npm only)

- [ ] **Step 1: Install runtime + types**

Run:
```bash
npm install @upstash/redis @dnd-kit/core @dnd-kit/sortable bcryptjs zod
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 2: Verify package.json updated**

Run: `grep -E "@upstash|@dnd-kit|bcryptjs|zod" package.json`
Expected: 5 dependency lines.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add upstash-redis, dnd-kit, bcryptjs, zod for overrides feature"
```

---

## Task 2: Generate env vars + add to .env.local

**Files:** `.env.local` (gitignored)

- [ ] **Step 1: Generate bcrypt hash for password `vends360`**

Run:
```bash
node -e "console.log(require('bcryptjs').hashSync('vends360', 10))"
```
Copy the resulting `$2b$10$…` string.

- [ ] **Step 2: Generate two random secrets**

Run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
First → `EDIT_SESSION_SECRET`. Second → `HERMES_TOKEN`.

- [ ] **Step 3: Append to `.env.local`**

```
EDIT_PASSWORD_HASH=$2b$10$<your-bcrypt-hash>
EDIT_SESSION_SECRET=<first-hex>
HERMES_TOKEN=<second-hex>
```

- [ ] **Step 4: Verify presence**

Run: `grep -E "^(EDIT_|HERMES_)" .env.local | wc -l`
Expected: `3`

- [ ] **Step 5: No commit**

These values are local; do not commit `.env.local`. (Already gitignored.) Production env vars will be set in Vercel UI in Task 18.

---

## Task 3: Add Overrides types to lib/types.ts

**Files:** Modify `lib/types.ts`

- [ ] **Step 1: Append type definitions**

Append to `lib/types.ts`:
```ts
// ─── Overrides layer ──────────────────────────────────────────────
export type MachineOverride = {
  name?: string
  locationKey?: string
  order?: number
}

export type LocationOverride = {
  label?: string
  order?: number
}

export type Overrides = {
  version: 1
  updatedAt: string  // ISO timestamp
  machines: Record<string, MachineOverride>     // keyed by device_id
  locations: Record<string, LocationOverride>   // keyed by locationKey
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "tests/" | head -10`
Expected: no errors from `lib/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add Overrides + MachineOverride + LocationOverride"
```

---

## Task 4: Write tests for lib/overrides.ts merge logic

**Files:** Create `tests/overrides.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/overrides.test.ts`:
```ts
import {
  defaultOverrides,
  mergeMachineName,
  mergeMachineLocation,
  mergeLocationLabel,
  sortMachines,
} from '@/lib/overrides'
import type { Overrides } from '@/lib/types'

const ov: Overrides = {
  version: 1,
  updatedAt: '2026-05-25T00:00:00Z',
  machines: {
    'dev1': { name: 'V1 — Custom', locationKey: 'airport', order: 0 },
    'dev2': { name: 'V2 — Custom', locationKey: 'university', order: 1 },
  },
  locations: {
    airport: { label: 'Airport', order: 0 },
    university: { label: 'University', order: 1 },
  },
}

describe('defaultOverrides', () => {
  it('returns empty overrides with version 1', () => {
    const d = defaultOverrides()
    expect(d.version).toBe(1)
    expect(d.machines).toEqual({})
    expect(d.locations).toEqual({})
  })
})

describe('mergeMachineName', () => {
  it('returns override name when present', () => {
    expect(mergeMachineName('dev1', 'CH Name', ov)).toBe('V1 — Custom')
  })

  it('falls back to CH name when override missing', () => {
    expect(mergeMachineName('devX', 'CH Name', ov)).toBe('CH Name')
  })

  it('falls back to CH name when override has no name field', () => {
    const ov2: Overrides = { ...ov, machines: { dev1: { locationKey: 'a' } } }
    expect(mergeMachineName('dev1', 'CH Name', ov2)).toBe('CH Name')
  })
})

describe('mergeMachineLocation', () => {
  it('returns override locationKey when present', () => {
    expect(mergeMachineLocation('dev1', 'STATIC', ov)).toBe('airport')
  })

  it('falls back to static map when override missing', () => {
    expect(mergeMachineLocation('devX', 'STATIC', ov)).toBe('STATIC')
  })

  it('falls back to "unassigned" when both missing', () => {
    expect(mergeMachineLocation('devX', undefined, ov)).toBe('unassigned')
  })
})

describe('mergeLocationLabel', () => {
  it('returns override label when present', () => {
    expect(mergeLocationLabel('airport', ov)).toBe('Airport')
  })

  it('falls back to key when override missing', () => {
    expect(mergeLocationLabel('unknown', ov)).toBe('unknown')
  })
})

describe('sortMachines', () => {
  it('sorts by (location.order, machine.order, name)', () => {
    const list = [
      { id: 'dev2', name: 'V2 — Custom', locationKey: 'university', order: 1 },
      { id: 'dev1', name: 'V1 — Custom', locationKey: 'airport', order: 0 },
    ]
    const sorted = sortMachines(list, ov)
    expect(sorted.map(m => m.id)).toEqual(['dev1', 'dev2'])
  })

  it('groups by location order first', () => {
    const list = [
      { id: 'a', name: 'a', locationKey: 'university', order: 0 },
      { id: 'b', name: 'b', locationKey: 'airport', order: 5 },
    ]
    const sorted = sortMachines(list, ov)
    expect(sorted.map(m => m.id)).toEqual(['b', 'a'])
  })
})
```

- [ ] **Step 2: Run test (expect fail — module missing)**

Run: `npx jest tests/overrides.test.ts 2>&1 | tail -10`
Expected: `Cannot find module '@/lib/overrides'`

---

## Task 5: Implement lib/overrides.ts

**Files:** Create `lib/overrides.ts`

- [ ] **Step 1: Write module**

Create `lib/overrides.ts`:
```ts
import { Redis } from '@upstash/redis'
import type { Overrides } from './types'

const KEY = 'vendissimo:overrides'

let _client: Redis | null = null
function client(): Redis {
  if (_client) return _client
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('KV_REST_API_URL/KV_REST_API_TOKEN missing')
  _client = new Redis({ url, token })
  return _client
}

export function defaultOverrides(): Overrides {
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    machines: {},
    locations: {},
  }
}

export async function getOverrides(): Promise<Overrides> {
  try {
    const raw = await client().get<Overrides>(KEY)
    return raw ?? defaultOverrides()
  } catch (e) {
    console.warn('[overrides] redis read failed, falling back to defaults', e)
    return defaultOverrides()
  }
}

export async function setOverrides(o: Overrides): Promise<void> {
  const next: Overrides = { ...o, version: 1, updatedAt: new Date().toISOString() }
  await client().set(KEY, next)
}

// ─── merge helpers ────────────────────────────────────────────────

export function mergeMachineName(
  deviceId: string,
  chName: string,
  overrides: Overrides,
): string {
  return overrides.machines[deviceId]?.name ?? chName
}

export function mergeMachineLocation(
  deviceId: string,
  staticLocation: string | undefined,
  overrides: Overrides,
): string {
  return overrides.machines[deviceId]?.locationKey ?? staticLocation ?? 'unassigned'
}

export function mergeLocationLabel(
  locationKey: string,
  overrides: Overrides,
): string {
  return overrides.locations[locationKey]?.label ?? locationKey
}

export type RankedMachine = {
  id: string
  name: string
  locationKey: string
  order?: number
}

export function sortMachines<T extends RankedMachine>(
  machines: T[],
  overrides: Overrides,
): T[] {
  return [...machines].sort((a, b) => {
    const locA = overrides.locations[a.locationKey]?.order ?? Number.MAX_SAFE_INTEGER
    const locB = overrides.locations[b.locationKey]?.order ?? Number.MAX_SAFE_INTEGER
    if (locA !== locB) return locA - locB
    const ordA = a.order ?? Number.MAX_SAFE_INTEGER
    const ordB = b.order ?? Number.MAX_SAFE_INTEGER
    if (ordA !== ordB) return ordA - ordB
    return a.name.localeCompare(b.name)
  })
}
```

- [ ] **Step 2: Run tests (expect pass)**

Run: `npx jest tests/overrides.test.ts`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/overrides.ts tests/overrides.test.ts
git commit -m "feat(overrides): add Redis client + merge helpers + tests"
```

---

## Task 6: Write tests for edit-auth

**Files:** Create `tests/edit-auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/edit-auth.test.ts`:
```ts
import { signSession, verifySession } from '@/lib/edit-auth'

const SECRET = 'a'.repeat(64)

describe('signSession', () => {
  it('produces "<expires>.<hmac>" format', () => {
    const exp = 1000000
    const token = signSession(exp, SECRET)
    expect(token).toMatch(/^1000000\.[a-f0-9]{64}$/)
  })
})

describe('verifySession', () => {
  it('returns true for unexpired, valid HMAC', () => {
    const exp = Date.now() + 60_000
    const token = signSession(exp, SECRET)
    expect(verifySession(token, SECRET, Date.now())).toBe(true)
  })

  it('returns false when expired', () => {
    const exp = Date.now() - 1000
    const token = signSession(exp, SECRET)
    expect(verifySession(token, SECRET, Date.now())).toBe(false)
  })

  it('returns false when HMAC tampered', () => {
    const exp = Date.now() + 60_000
    const token = signSession(exp, SECRET).replace(/.$/, 'x')
    expect(verifySession(token, SECRET, Date.now())).toBe(false)
  })

  it('returns false when secret differs', () => {
    const exp = Date.now() + 60_000
    const token = signSession(exp, SECRET)
    expect(verifySession(token, 'b'.repeat(64), Date.now())).toBe(false)
  })

  it('returns false for malformed token', () => {
    expect(verifySession('garbage', SECRET, Date.now())).toBe(false)
    expect(verifySession('', SECRET, Date.now())).toBe(false)
  })
})
```

- [ ] **Step 2: Run test (expect fail)**

Run: `npx jest tests/edit-auth.test.ts 2>&1 | tail -10`
Expected: `Cannot find module '@/lib/edit-auth'`

---

## Task 7: Implement lib/edit-auth.ts

**Files:** Create `lib/edit-auth.ts`

- [ ] **Step 1: Write module**

Create `lib/edit-auth.ts`:
```ts
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'vendissimo_edit'
const TTL_SECONDS = 60 * 60  // 1 hour

// ─── pure helpers (testable) ──────────────────────────────────────

export function signSession(expiresMs: number, secret: string): string {
  const sig = crypto.createHmac('sha256', secret).update(String(expiresMs)).digest('hex')
  return `${expiresMs}.${sig}`
}

export function verifySession(token: string, secret: string, nowMs: number): boolean {
  if (!token) return false
  const [expStr, sig] = token.split('.')
  if (!expStr || !sig) return false
  const expected = crypto.createHmac('sha256', secret).update(expStr).digest('hex')
  if (sig.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp)) return false
  return exp > nowMs
}

// ─── server-only entry points ─────────────────────────────────────

function getSecret(): string {
  const s = process.env.EDIT_SESSION_SECRET
  if (!s || s.length < 32) throw new Error('EDIT_SESSION_SECRET missing or too short')
  return s
}

export async function login(password: string): Promise<boolean> {
  const hash = process.env.EDIT_PASSWORD_HASH
  if (!hash) throw new Error('EDIT_PASSWORD_HASH missing')
  const ok = await bcrypt.compare(password, hash)
  if (!ok) return false
  const expires = Date.now() + TTL_SECONDS * 1000
  const token = signSession(expires, getSecret())
  ;(await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TTL_SECONDS,
    path: '/',
  })
  return true
}

export async function isEditMode(): Promise<boolean> {
  const c = (await cookies()).get(COOKIE_NAME)
  if (!c) return false
  try {
    return verifySession(c.value, getSecret(), Date.now())
  } catch {
    return false
  }
}

export async function logout(): Promise<void> {
  ;(await cookies()).delete(COOKIE_NAME)
}
```

- [ ] **Step 2: Run tests**

Run: `npx jest tests/edit-auth.test.ts`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/edit-auth.ts tests/edit-auth.test.ts
git commit -m "feat(edit-auth): bcrypt password + HMAC-signed cookie session"
```

---

## Task 8: API route GET/POST `/api/overrides`

**Files:** Create `app/api/overrides/route.ts`

- [ ] **Step 1: Write route**

Create `app/api/overrides/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getOverrides, setOverrides } from '@/lib/overrides'
import { isEditMode } from '@/lib/edit-auth'

export const dynamic = 'force-dynamic'

const MachineOverrideSchema = z.object({
  name: z.string().max(80).optional(),
  locationKey: z.string().regex(/^[a-z0-9_-]{1,32}$/).optional(),
  order: z.number().int().min(0).max(999).optional(),
})

const LocationOverrideSchema = z.object({
  label: z.string().max(60).optional(),
  order: z.number().int().min(0).max(999).optional(),
})

const OverridesSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().optional(),
  machines: z.record(z.string().max(64), MachineOverrideSchema).refine(
    (v) => Object.keys(v).length <= 50,
    { message: 'max 50 machines' },
  ),
  locations: z.record(z.string().regex(/^[a-z0-9_-]{1,32}$/), LocationOverrideSchema).refine(
    (v) => Object.keys(v).length <= 20,
    { message: 'max 20 locations' },
  ),
})

export async function GET() {
  const overrides = await getOverrides()
  return NextResponse.json(overrides)
}

export async function POST(req: Request) {
  if (!(await isEditMode())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = OverridesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid overrides', issues: parsed.error.issues }, { status: 400 })
  }
  await setOverrides({ ...parsed.data, version: 1, updatedAt: new Date().toISOString() })
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Smoke test GET**

Run (server must be running):
```bash
curl -s http://localhost:3000/api/overrides
```
Expected: JSON with `version: 1`, empty machines/locations (first run).

- [ ] **Step 3: Smoke test POST without auth**

Run:
```bash
curl -s -X POST http://localhost:3000/api/overrides -H "Content-Type: application/json" -d '{"version":1,"machines":{},"locations":{}}'
```
Expected: `{"error":"Unauthorized"}` 401.

- [ ] **Step 4: Commit**

```bash
git add app/api/overrides/route.ts
git commit -m "feat(api): GET/POST /api/overrides with auth + zod validation"
```

---

## Task 9: API route `/api/edit-login` + `/api/edit-logout`

**Files:** Create `app/api/edit-login/route.ts`, `app/api/edit-logout/route.ts`

- [ ] **Step 1: Write login**

Create `app/api/edit-login/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { login } from '@/lib/edit-auth'

export const dynamic = 'force-dynamic'

const LoginSchema = z.object({ password: z.string().min(1).max(200) })

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const ok = await login(parsed.data.password)
  if (!ok) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write logout**

Create `app/api/edit-logout/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { logout } from '@/lib/edit-auth'

export const dynamic = 'force-dynamic'

export async function POST() {
  await logout()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Smoke test login wrong password**

Run:
```bash
curl -s -X POST http://localhost:3000/api/edit-login -H "Content-Type: application/json" -d '{"password":"wrong"}'
```
Expected: `{"error":"Wrong password"}` 401.

- [ ] **Step 4: Smoke test login correct**

Run:
```bash
curl -s -i -X POST http://localhost:3000/api/edit-login -H "Content-Type: application/json" -d '{"password":"vends360"}'
```
Expected: 200, `Set-Cookie: vendissimo_edit=<token>; HttpOnly; ...`.

- [ ] **Step 5: Commit**

```bash
git add app/api/edit-login/route.ts app/api/edit-logout/route.ts
git commit -m "feat(api): edit-login + edit-logout endpoints"
```

---

## Task 10: Wire overrides into clickhouse fetch (rename only)

**Files:** Modify `lib/clickhouse.ts`

Read the existing `fetchTransactions` first to confirm where `device_name` is resolved per row. The override merge applies the same way: per-row `device_name` becomes the overridden name when present.

- [ ] **Step 1: Add overrides fetch + merge**

In `lib/clickhouse.ts`, locate the section that builds canonical names (e.g. `buildCanonicalNames(rows)`) and the loop that produces `Transaction` rows. Add an overrides fetch in parallel with FX:
```ts
import { getOverrides } from './overrides'
// existing imports stay

// Inside fetchTransactions, before opening CH client:
const [fxInfo, overrides] = await Promise.all([
  getFxOrFallback(),
  getOverrides(),
])
```

Then in the row-mapping loop, replace the device-name source:
```ts
// before: const name = canonicalNames[row.device_id] ?? row.device_name
const chName = canonicalNames[row.device_id] ?? row.device_name
const name = overrides.machines[row.device_id]?.name ?? chName
```

And in the location-resolution path (where `DEVICE_LOCATIONS[device_id]` is read), apply override location:
```ts
// before: const location = DEVICE_LOCATIONS[row.device_id] ?? 'Unknown'
const staticLoc = DEVICE_LOCATIONS[row.device_id]
const locationKey = overrides.machines[row.device_id]?.locationKey ?? staticLoc ?? 'unassigned'
const location = overrides.locations[locationKey]?.label ?? staticLoc ?? 'Unassigned'
```

(If `lib/clickhouse.ts` does not directly render locations and that resolution happens in `lib/aggregate.ts` or `lib/transactions.ts` `rowToTransaction`, apply the merge there instead — task is to flow `overrides` to wherever the static map is consumed.)

- [ ] **Step 2: Verify dev compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "lib/clickhouse.ts" | head -5`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Open `http://localhost:3000/sales-report` in the running dev server. Expected: page renders identically to today (overrides are still empty, so fallback wins).

- [ ] **Step 4: Commit**

```bash
git add lib/clickhouse.ts
git commit -m "feat(clickhouse): apply overrides for machine name + location at ingest"
```

---

## Task 11: Tests for aggregate-with-overrides

**Files:** Create `tests/aggregate-with-overrides.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/aggregate-with-overrides.test.ts`:
```ts
import { aggregateTransactions } from '@/lib/aggregate'
import type { Transaction } from '@/lib/types'

const txn = (over: Partial<Transaction>): Transaction => ({
  device_id: 'dev1',
  device_name: 'V1 — Overridden',
  product_name: 'Water',
  amount: 1.5,
  currency: 'USD',
  sales_time: '2026-05-20 10:00:00',
  date_key: '2026-05-20',
  location: 'Airport',
  ...over,
})

describe('aggregateTransactions with overridden names', () => {
  it('groups by overridden machine name', () => {
    const data = aggregateTransactions([
      txn({ device_id: 'dev1', device_name: 'V1 — Overridden' }),
      txn({ device_id: 'dev1', device_name: 'V1 — Overridden' }),
    ], {}, 'USD')
    expect(data.machines.find(m => m.machine === 'V1 — Overridden')).toBeTruthy()
  })

  it('groups by overridden location', () => {
    const data = aggregateTransactions([
      txn({ location: 'Airport' }),
      txn({ device_id: 'dev2', device_name: 'V2', location: 'Airport' }),
    ], {}, 'USD')
    expect(data.dailySales.locationTotals['Airport']).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test**

Run: `npx jest tests/aggregate-with-overrides.test.ts`
Expected: both tests pass (since transactions arrive with already-merged names from clickhouse layer, `aggregateTransactions` just trusts the inputs).

- [ ] **Step 3: Commit**

```bash
git add tests/aggregate-with-overrides.test.ts
git commit -m "test(aggregate): verify aggregator honors merged names/locations"
```

---

## Task 12: EditContext + types

**Files:** Create `components/edit-mode/EditContext.tsx`

- [ ] **Step 1: Write context**

Create `components/edit-mode/EditContext.tsx`:
```tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Overrides } from '@/lib/types'

type EditCtx = {
  isEditMode: boolean
  draft: Overrides
  setDraft: (next: Overrides | ((prev: Overrides) => Overrides)) => void
  enterEditMode: (initialDraft: Overrides) => void
  save: () => Promise<void>
  cancel: () => void
  saving: boolean
  error: string | null
}

const Ctx = createContext<EditCtx | null>(null)

const emptyOverrides: Overrides = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  machines: {},
  locations: {},
}

export function EditProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isEditMode, setEditMode] = useState(false)
  const [draft, setDraftState] = useState<Overrides>(emptyOverrides)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDraft: EditCtx['setDraft'] = useCallback((next) => {
    setDraftState((prev) => typeof next === 'function' ? (next as (p: Overrides) => Overrides)(prev) : next)
  }, [])

  const enterEditMode = useCallback((initialDraft: Overrides) => {
    setDraftState(initialDraft)
    setEditMode(true)
    setError(null)
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setEditMode(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }, [draft, router])

  const cancel = useCallback(() => {
    setDraftState(emptyOverrides)
    setEditMode(false)
    setError(null)
  }, [])

  const value = useMemo<EditCtx>(() => ({
    isEditMode, draft, setDraft, enterEditMode, save, cancel, saving, error,
  }), [isEditMode, draft, setDraft, enterEditMode, save, cancel, saving, error])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEdit(): EditCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEdit outside EditProvider')
  return v
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "edit-mode" | head -5`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add components/edit-mode/EditContext.tsx
git commit -m "feat(edit-mode): EditContext provider for draft override state"
```

---

## Task 13: PasswordModal + EditModeToggle

**Files:** Create `components/edit-mode/PasswordModal.tsx`, `components/edit-mode/EditModeToggle.tsx`

- [ ] **Step 1: Write PasswordModal**

Create `components/edit-mode/PasswordModal.tsx`:
```tsx
'use client'

import { useState, type FormEvent } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function PasswordModal({ open, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/edit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setPassword('')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form onSubmit={submit} className="bg-card border border-border rounded-lg p-6 w-80 shadow-xl">
        <h3 className="text-foreground font-semibold mb-3">Edit Mode Password</h3>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent"
          placeholder="Password"
        />
        {error && <p className="text-danger text-xs mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md border border-border text-muted-strong hover:text-foreground">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="px-3 py-1.5 text-xs rounded-md bg-accent text-white disabled:opacity-60">
            {busy ? 'Checking…' : 'Enter'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Write EditModeToggle**

Create `components/edit-mode/EditModeToggle.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useEdit } from './EditContext'
import { PasswordModal } from './PasswordModal'
import type { Overrides } from '@/lib/types'

type Props = { initialOverrides: Overrides }

export function EditModeToggle({ initialOverrides }: Props) {
  const { isEditMode, save, cancel, saving, error, enterEditMode } = useEdit()
  const [askPwd, setAskPwd] = useState(false)

  if (!isEditMode) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAskPwd(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:border-accent hover:text-accent transition-colors"
          title="Edit machine names + locations"
        >
          ✏️ Edit
        </button>
        <PasswordModal
          open={askPwd}
          onClose={() => setAskPwd(false)}
          onSuccess={() => {
            setAskPwd(false)
            enterEditMode(initialOverrides)
          }}
        />
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-danger text-xs">{error}</span>}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500 text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : '💾 Save'}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={saving}
        className="px-3 py-1.5 text-xs font-medium rounded-md border border-border text-muted-strong"
      >
        ✕ Cancel
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/edit-mode/PasswordModal.tsx components/edit-mode/EditModeToggle.tsx
git commit -m "feat(edit-mode): password modal + toggle button"
```

---

## Task 14: EditBanner

**Files:** Create `components/edit-mode/EditBanner.tsx`

- [ ] **Step 1: Write banner**

Create `components/edit-mode/EditBanner.tsx`:
```tsx
'use client'

import { useEdit } from './EditContext'

export function EditBanner() {
  const { isEditMode } = useEdit()
  if (!isEditMode) return null
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-200 rounded-md px-4 py-2 text-sm">
      🔧 Edit Mode aktif — drag mesin atau ubah nama, lalu klik Save untuk simpan.
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/edit-mode/EditBanner.tsx
git commit -m "feat(edit-mode): banner shown when editing"
```

---

## Task 15: Wire ExecSummaryClient with EditProvider + pass overrides

**Files:** Modify `app/sales-report/page.tsx`, `components/executive-summary/ExecSummaryClient.tsx`, optional new client wrapper.

- [ ] **Step 1: Server fetch overrides + pass to client**

Open `app/sales-report/page.tsx`. After existing transaction/categoryMap fetch, also fetch overrides:
```ts
import { getOverrides } from '@/lib/overrides'
// ...
const overrides = await getOverrides()
// then pass to <SalesReportClient transactions={...} categoryMap={...} overrides={overrides} />
```

If sales-report uses `ExecSummaryClient` directly, pass `overrides` there. Find the actual file (`app/sales-report/page.tsx` was added earlier in the project).

- [ ] **Step 2: Modify client to accept overrides**

In `components/executive-summary/ExecSummaryClient.tsx` (or whichever sales-report client uses `DailySalesTable`), accept `overrides: Overrides` prop and wrap children with `<EditProvider>`:
```tsx
import { EditProvider } from '@/components/edit-mode/EditContext'
import { EditModeToggle } from '@/components/edit-mode/EditModeToggle'
import { EditBanner } from '@/components/edit-mode/EditBanner'
// ...
return (
  <EditProvider>
    <div className="flex items-center justify-between">
      <DateFilter ... />
      <EditModeToggle initialOverrides={overrides} />
    </div>
    <EditBanner />
    {/* existing children including DailySalesTable */}
  </EditProvider>
)
```

- [ ] **Step 3: Smoke test**

Reload `http://localhost:3000/sales-report`. Expected: page still renders. ✏️ Edit button now visible in header. Click → password modal opens. Enter `vends360` → button switches to Save/Cancel + yellow banner appears.

- [ ] **Step 4: Commit**

```bash
git add app/sales-report/page.tsx components/executive-summary/ExecSummaryClient.tsx
git commit -m "feat(sales-report): wire EditProvider + Toggle + Banner"
```

---

## Task 16: Inline rename + drag-drop in DailySalesTable

**Files:** Modify `components/executive-summary/DailySalesTable.tsx`

This is the largest single edit. Read the current file fully before editing — it has 350+ lines already.

- [ ] **Step 1: Import dnd-kit + EditContext**

At top of `DailySalesTable.tsx`:
```tsx
import { useEdit } from '@/components/edit-mode/EditContext'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

- [ ] **Step 2: Read isEditMode + draft inside component**

Inside `DailySalesTable`, near top:
```tsx
const { isEditMode, draft, setDraft } = useEdit()
```

- [ ] **Step 3: Sortable machine row wrapper**

Define a helper component `SortableMachineRow` inside the same file:
```tsx
function SortableMachineRow({ deviceId, children }: { deviceId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deviceId })
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  )
}
```

When `!isEditMode`, render the existing `<tr>` as before. When `isEditMode`, wrap row content in `SortableMachineRow`. Use `m.deviceId` (you may need to expose device_id on machine rows — if it's not there, add it; see lib/aggregate types).

- [ ] **Step 4: Inline rename in first column**

In the machine row, the sticky left cell currently renders `{m.machine}` (or similar name field). Replace with:
```tsx
{isEditMode ? (
  <input
    type="text"
    defaultValue={m.machine}
    onBlur={(e) => {
      const newName = e.target.value.trim()
      setDraft(prev => ({
        ...prev,
        machines: { ...prev.machines, [m.deviceId]: { ...(prev.machines[m.deviceId] ?? {}), name: newName } },
      }))
    }}
    className="bg-background border border-accent rounded px-1.5 py-0.5 text-xs w-full"
  />
) : (
  <span>{m.machine}</span>
)}
```

- [ ] **Step 5: DnD wrapping**

In the parent table body, wrap each location's machine list in:
```tsx
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleMachineDragEnd(e, locKey)}>
  <SortableContext items={byLocation[loc].map(m => m.deviceId)} strategy={verticalListSortingStrategy}>
    {byLocation[loc].map(m => (
      <SortableMachineRow key={m.deviceId} deviceId={m.deviceId}>
        {/* row cells */}
      </SortableMachineRow>
    ))}
  </SortableContext>
</DndContext>
```
Define `sensors` once: `const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))`.

Define `handleMachineDragEnd`:
```ts
function handleMachineDragEnd(e: DragEndEvent, locKey: string) {
  const { active, over } = e
  if (!over || active.id === over.id) return
  const ids = byLocation[locKey].map(m => m.deviceId)
  const oldIdx = ids.indexOf(active.id as string)
  const newIdx = ids.indexOf(over.id as string)
  if (oldIdx < 0 || newIdx < 0) return
  const reordered = [...ids]
  reordered.splice(oldIdx, 1)
  reordered.splice(newIdx, 0, active.id as string)
  setDraft(prev => {
    const nextMachines = { ...prev.machines }
    reordered.forEach((id, i) => {
      nextMachines[id] = { ...(nextMachines[id] ?? {}), order: i, locationKey: locKey }
    })
    return { ...prev, machines: nextMachines }
  })
}
```

- [ ] **Step 6: Smoke test**

Reload `/sales-report`. Enter edit mode. Expected:
- Machine name cells are inputs
- Cursor on hover shows grab/grabbing
- Drag a machine row — it reorders within the location
- Click Save → page refreshes — new order persists across reload

- [ ] **Step 7: Commit**

```bash
git add components/executive-summary/DailySalesTable.tsx
git commit -m "feat(sales-report): inline rename + intra-location drag-drop in edit mode"
```

---

## Task 17: Wilson endpoint `/api/daily-report`

**Files:** Create `lib/daily-report.ts`, `app/api/daily-report/route.ts`

- [ ] **Step 1: Aggregation helper**

Create `lib/daily-report.ts`:
```ts
import { fetchTransactions, getLastSyncTime } from './clickhouse'
import { aggregateTransactions } from './aggregate'
import { getKpiTarget } from './kpi'

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
  topMachines: Array<{ name: string; location: string; qty: number; revenue: number }>
  bottomMachines: Array<{ name: string; location: string; qty: number; revenue: number }>
  perMachine: Array<{ id: string; name: string; location: string; qty: number; revenue: number; kpiStatus: 'met' | 'below' | 'idle' }>
  lastSync: string
  generatedAt: string
}

export async function getDailyReportData(): Promise<DailyReport> {
  const transactions = await fetchTransactions()
  const data = aggregateTransactions(transactions, /* categoryMap */ {}, 'USD')
  const target = getKpiTarget()

  const today = data.dailySales.dates[data.dailySales.dates.length - 1] ?? new Date().toISOString().slice(0, 10)
  const lastSync = await getLastSyncTime()

  const perMachine = data.dailySales.machines.map(m => {
    const last = m.daily[today] ?? { qty: 0, rev: 0 }
    const status: 'met' | 'below' | 'idle' = last.qty <= 0 ? 'idle' : last.qty >= target ? 'met' : 'below'
    return {
      id: m.deviceId ?? m.machine,
      name: m.machine,
      location: m.location,
      qty: last.qty,
      revenue: last.rev,
      kpiStatus: status,
    }
  })

  const topProducts = data.products.slice(0, 5).map(p => ({ name: p.product, qty: p.qty, revenue: p.revenue }))
  const ranked = [...perMachine].sort((a, b) => b.qty - a.qty)
  const topMachines = ranked.slice(0, 3)
  const bottomMachines = ranked.filter(m => m.qty > 0).slice(-3).reverse()

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
    lastSync: lastSync ?? '',
    generatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Route**

Create `app/api/daily-report/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getDailyReportData } from '@/lib/daily-report'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const token = req.headers.get('X-Hermes-Token')
  if (!token || token !== process.env.HERMES_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const data = await getDailyReportData()
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Smoke test no token**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/daily-report
```
Expected: `401`.

- [ ] **Step 4: Smoke test valid token**

Read `HERMES_TOKEN` from `.env.local`. Run:
```bash
curl -s http://localhost:3000/api/daily-report -H "X-Hermes-Token: $(grep HERMES_TOKEN .env.local | cut -d= -f2)" | python -m json.tool | head -30
```
Expected: JSON with `kpi`, `topProducts`, `topMachines`, `perMachine`.

- [ ] **Step 5: Commit**

```bash
git add lib/daily-report.ts app/api/daily-report/route.ts
git commit -m "feat(api): /api/daily-report endpoint for Hermes Wilson agent"
```

---

## Task 18: Production env vars (Vercel) + push

**Files:** none locally — Vercel dashboard only

- [ ] **Step 1: Open Vercel project env vars**

URL: `https://vercel.com/udoaldo-codes-projects/vendissimo/settings/environment-variables`

- [ ] **Step 2: Add three new env vars**

For each, set Environments = Production + Preview + Development:
- `EDIT_PASSWORD_HASH` → bcrypt hash generated in Task 2
- `EDIT_SESSION_SECRET` → first hex generated in Task 2
- `HERMES_TOKEN` → second hex generated in Task 2

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 4: Verify Vercel deploy**

Open `https://vendissimo.linkit360.ai`. Wait for deploy to complete. Smoke test ✏️ Edit button → password → save a tiny override (e.g. rename one machine) → reload → name persists.

- [ ] **Step 5: No commit** (only operational)

---

## Task 19: Manual E2E checklist

Run through every flow once on `https://vendissimo.linkit360.ai`:

- [ ] **Step 1: Sales Report renders normally with empty overrides**
- [ ] **Step 2: Click ✏️ Edit → modal opens → wrong password → 401 + error shown**
- [ ] **Step 3: Correct password `vends360` → button switches to Save/Cancel + yellow banner**
- [ ] **Step 4: Rename V1 → blur → Save → reload → V1 keeps new name**
- [ ] **Step 5: Drag a machine within a location → Save → reload → row order persists**
- [ ] **Step 6: Open Dashboard → renamed V1 visible in High/Low Performers cards**
- [ ] **Step 7: Open Machine Performance → renamed V1 in table**
- [ ] **Step 8: Wait 1h or clear cookie → ✏️ Edit again requires password**
- [ ] **Step 9: `curl -H "X-Hermes-Token: <prod-token>" https://vendissimo.linkit360.ai/api/daily-report` returns JSON**
- [ ] **Step 10: Same curl without header → 401**

If all green, the feature is shipped. Report results to the user.

---

## Self-Review Notes

**Spec coverage:**
- ✅ Override schema (Task 3, 4, 5)
- ✅ Redis storage (Task 1, 5)
- ✅ Merge logic (Task 5, 10)
- ✅ Auth (bcrypt + HMAC cookie) (Task 7)
- ✅ API routes (Task 8, 9, 17)
- ✅ Edit UI (Toggle + Modal + Banner + DnD + inline rename) (Task 12–16)
- ✅ Wilson endpoint (Task 17)
- ✅ Env vars (Task 2, 18)
- ✅ Tests (overrides, edit-auth, aggregate) (Task 4, 6, 11)
- ✅ Rollout (Task 18, 19)

**Open gaps:**
- Inter-location drag (moving a machine from Airport→Hospital) is **not** implemented in Task 16. Intra-location reordering only. Adding cross-list move requires a second `SortableContext` strategy and is a follow-up if user needs it. Spec mentioned both — flagging here so the executing engineer asks before adding.
- Location header reordering is also a follow-up — Task 16 only covers machine rows. Adding location header DnD is a sibling task.

If the user wants those in v1, expand Task 16 into 16a/16b/16c. Otherwise, ship the bite-sized scope and add cross-list move as a v1.1 task.
