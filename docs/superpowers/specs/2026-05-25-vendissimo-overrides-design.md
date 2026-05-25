# Vendissimo Overrides — Display Name + Location + Order Editing

**Date:** 2026-05-25
**Status:** Approved (in brainstorming session)
**Author:** Brainstormed with user (CC dialog)

## Goal

Allow internal team to edit machine display names, reassign machine locations, and reorder machines/locations directly in the vendissimo UI. Edits propagate to every page (Dashboard, Sales Report, Machine Performance) and to the `/api/daily-report` endpoint consumed by the Hermes Wilson WA agent. ClickHouse data remains untouched — overrides are a thin "buku catatan" layer on top.

## Non-Goals

- Editing transaction/sales numbers
- Modifying ClickHouse data
- Per-user accounts or audit trail
- Real-time multi-user sync (last-write-wins is acceptable)
- COGS / margin editing (separate scope)

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  Vendissimo (Next.js, Vercel)                    │
│                                                  │
│  ClickHouse (read-only) ──┐                      │
│                            ├─► merge ──► UI      │
│  Upstash Redis (overrides)─┘    (display names   │
│                                  + custom order) │
│                                                  │
│  API routes                                      │
│  ─────────                                       │
│  GET  /api/overrides    → return JSON            │
│  POST /api/overrides    → write Redis (auth)     │
│  POST /api/edit-login   → bcrypt + set cookie    │
│  POST /api/edit-logout  → clear cookie           │
│  GET  /api/daily-report → Wilson consumer        │
└──────────────────────────────────────────────────┘
```

- CH = source of truth for sales numbers
- Redis = override layer (machine name, location assignment, ordering)
- Server merges both on every render
- Wilson reads `/api/daily-report` (no CH access, no override duplication)

## Data Model

Single Redis key `vendissimo:overrides` with JSON value:

```jsonc
{
  "version": 1,
  "updatedAt": "2026-05-25T08:30:00Z",

  "machines": {
    "9fl9g4hgn0f243c": {
      "name": "V1 — KHMER House Entrance 1",
      "locationKey": "airport",
      "order": 0
    }
    // ... 8 machines total (current device IDs from lib/locations.ts)
  },

  "locations": {
    "airport":    { "label": "Airport",    "order": 0 },
    "hospital":   { "label": "Hospital",   "order": 1 },
    "university": { "label": "University", "order": 2 }
  }
}
```

### Merge rules (server-side)

```
displayName(deviceId) = overrides.machines[deviceId]?.name
                      ?? canonicalNameFromCH(deviceId)

locationKey(deviceId) = overrides.machines[deviceId]?.locationKey
                      ?? DEVICE_LOCATIONS[deviceId]   // static map
                      ?? 'unassigned'

locationLabel(key)    = overrides.locations[key]?.label ?? key

sortKey(deviceId)     = (location.order, machine.order, name)
```

If Redis is empty or unreachable, fallback to current static map + CH names — identical to today's behavior.

## Storage (Upstash Redis)

**Provisioned:** Upstash Redis via Vercel Marketplace, region Singapore (`sin1`), plan **Free** (500k commands/month, 1 DB).

**Env vars (auto-injected by Vercel):**
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_URL`
- `REDIS_URL`

**Client:** `@upstash/redis` with manual init (KV_* prefix, not the SDK's default `UPSTASH_REDIS_REST_*`).

**Cache:** `unstable_cache` 30s wrap around `getOverrides()` to absorb traffic bursts. `revalidateTag('overrides')` on every POST.

**Failure mode:** `try/catch` in `getOverrides()` → fallback `defaultOverrides()` if Redis errors. Page must never break due to override layer failure.

## API Routes

| Route | Method | Auth | Action |
|---|---|---|---|
| `/api/overrides` | GET | none | Return current overrides JSON |
| `/api/overrides` | POST | cookie `vendissimo_edit` | Zod-validate body → write Redis → `revalidatePath('/', 'layout')` |
| `/api/edit-login` | POST | none | bcrypt compare → set HttpOnly cookie (1h TTL) |
| `/api/edit-logout` | POST | cookie | Clear cookie |
| `/api/daily-report` | GET | header `X-Hermes-Token` | Return aggregated daily report (uses merged overrides) |

### Validation (Zod)

- Max 50 machines, 20 locations (defensive cap)
- Machine name max 80 chars
- Location key alphanumeric only, max 32 chars
- Location label max 60 chars
- Reject malformed JSON / missing required fields

## Auth (Edit Mode)

- Single shared password: `vends360`, hashed bcrypt cost 10
- Hash stored in env var `EDIT_PASSWORD_HASH`
- Cookie `vendissimo_edit` = `<expiresMs>.<hmacSha256(expiresMs, EDIT_SESSION_SECRET)>`
- Cookie attrs: HttpOnly, Secure, SameSite=lax, path=/, maxAge=3600
- Session TTL: 1 hour (auto-expire mitigates "forgot to logout")

### Env vars (manual setup)

```
EDIT_PASSWORD_HASH=$2b$10$<bcryptHashOf_vends360>
EDIT_SESSION_SECRET=<random 32-byte hex>
HERMES_TOKEN=<random 64-char hex>
```

Generated once and pasted into `.env.local` + Vercel env (Production + Preview + Development).

### Security stance

- HMAC-signed cookie → cannot be forged client-side
- HttpOnly → no JS access (XSS protection)
- Secure → HTTPS only in production
- SameSite=lax → CSRF mitigation for POST (also relies on fetch with credentials)
- No rate limit on `/api/edit-login` for v1 (5-attempts/min Upstash ratelimit is optional follow-up)

## UI Components

### Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` (~30KB)
- `bcryptjs` (server-side only)
- `zod`

### `EditModeToggle` (Sales Report header)

```
Daily Sales by Machine    [✏️ Edit]
                          (klik) → modal password
                          ↓
                          [💾 Save]  [✕ Cancel]
```

### `EditContext` (React Context)

```ts
type EditState = {
  isEditMode: boolean
  draft: Overrides            // mutable local clone
  setDraft: (o: Overrides) => void
  save: () => Promise<void>   // POST /api/overrides + router.refresh()
  cancel: () => void
}
```

Flow:
1. Enter edit mode → clone overrides → store in `draft`
2. User mutations → local `draft` updates (optimistic)
3. Save → POST `/api/overrides` → server `revalidatePath('/', 'layout')` → `router.refresh()`
4. Cancel → discard `draft`, exit mode

### Inline rename

When `isEditMode`:
- Machine name cell becomes `<input>` with `defaultValue`
- `onBlur` mutates `draft.machines[id].name`
- Visual: accent border + pencil icon

### Drag-drop

- Grip handle `⠿` (visible only in edit mode) on each machine row + location header
- Nested `SortableContext`:
  ```
  <DndContext>
    <SortableContext items={locationOrder}>          // location order
      {locations.map(loc =>
        <SortableContext items={machinesIn(loc)}>    // machines within
          ...
        </SortableContext>
      )}
    </SortableContext>
  </DndContext>
  ```
- Drag machine between location groups → mutate `draft.machines[id].locationKey`
- Drag location header → mutate `draft.locations[*].order`

### Visual cues

- Banner: `🔧 Edit Mode active — perubahan belum disimpan`
- Modified cells have a dot indicator
- Date filter disabled while editing (avoids state confusion)

### Page impact

- **Dashboard + Machine Performance**: no edit UI, but rendered names + grouping reflect overrides (via merge layer)
- **Sales Report**: full edit affordance

## Wilson Endpoint `/api/daily-report`

```ts
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const token = req.headers.get('X-Hermes-Token')
  if (token !== process.env.HERMES_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return Response.json(await getDailyReportData())
}
```

Response shape:

```json
{
  "date": "2026-05-25",
  "kpi": {
    "totalQty": 142,
    "totalRevenueUsd": 89.50,
    "targetPerMachine": 21,
    "machinesAchieved": 5,
    "machinesBelow": 3
  },
  "topProducts": [
    { "name": "Hi-Tech Water 500ml", "qty": 28, "revenue": 14.00 }
  ],
  "topMachines": [
    { "name": "V1 — KHMER House Entrance 1", "location": "Airport", "qty": 34, "revenue": 21.50 }
  ],
  "bottomMachines": [
    { "name": "V7 — NPH Surgery Building - Waiting Area", "location": "Hospital", "qty": 4, "revenue": 2.50 }
  ],
  "perMachine": [
    { "id": "9fl9g4hgn0f243c", "name": "V1 — KHMER House Entrance 1", "location": "Airport", "qty": 34, "revenue": 21.50, "kpiStatus": "met" }
  ],
  "lastSync": "2026-05-25 06:00:00",
  "generatedAt": "2026-05-25T08:00:00Z"
}
```

All `name` + `location` fields use merged overrides automatically. Wilson does not need to know about the override layer.

## File Layout

New / modified files:

```
lib/
  overrides.ts          # NEW — Redis client + getOverrides/setOverrides + merge helpers
  edit-auth.ts          # NEW — bcrypt + HMAC cookie session
  daily-report.ts       # NEW — aggregation for Wilson endpoint
  clickhouse.ts         # MODIFY — apply override merge in fetchTransactions
  types.ts              # MODIFY — add Overrides, MachineOverride, LocationOverride types
  locations.ts          # KEEP — fallback static map (used when override missing)

app/
  api/
    overrides/route.ts        # NEW — GET/POST
    edit-login/route.ts       # NEW — POST
    edit-logout/route.ts      # NEW — POST
    daily-report/route.ts     # NEW — GET, header-auth

components/
  edit-mode/
    EditContext.tsx           # NEW — React Context provider
    EditModeToggle.tsx        # NEW — header button + password modal
    EditBanner.tsx            # NEW — "edit active" banner
  executive-summary/
    DailySalesTable.tsx       # MODIFY — drag-drop + inline rename when isEditMode
    MachinePerformanceTable.tsx # MODIFY — render merged names

tests/
  overrides.test.ts           # NEW — merge logic
  edit-auth.test.ts           # NEW — bcrypt + cookie
  aggregate-with-overrides.test.ts # NEW — aggregateTransactions honors overrides
```

## Testing Strategy

### Unit (Jest)

- `overrides.test.ts`: name override > CH name; fallback when missing; location override; ordering by (location.order, machine.order, name); defensive defaults
- `edit-auth.test.ts`: bcrypt compare success/fail; cookie sign/verify; expired token reject; tampered HMAC reject
- `aggregate-with-overrides.test.ts`: aggregator picks override name; bucket by override location

### Manual E2E (localhost)

1. Sales Report renders normally with empty overrides
2. Click Edit → password `vends360` → enter edit mode
3. Rename machine → Save → reload → name persists
4. Drag machine to different location group → Save → reflected
5. Drag location header → Save → location order persists
6. Dashboard + Machine Performance show edited names
7. Cookie expires after 1h → edit button visible but password required again
8. `/api/daily-report` with valid `X-Hermes-Token` → JSON valid; without token → 401

## Rollout

1. Local dev verification (full smoke test)
2. Set env vars in Vercel (`EDIT_PASSWORD_HASH`, `EDIT_SESSION_SECRET`, `HERMES_TOKEN`)
3. Push to GitHub → Vercel auto-deploy
4. First-edit in production: rename V1–V7 + group locations per PPT (Airport / Hospital / University)
5. Cross-device verification (laptop + phone show same names)

## Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Redis down → page error | `try/catch` in `getOverrides()` → fallback static map + CH names |
| Malformed POST corrupts overrides | Zod validation + max length caps + sane defaults |
| Bcrypt slow on Vercel cold start | `bcryptjs` (pure JS) at cost 10 |
| Two users edit simultaneously | Last-write-wins. ETag/If-Match is optional follow-up |
| Drag-drop conflicts with date filter | Disable date filter while in edit mode |
| Override JSON grows | Single key cap 256MB; realistic <10KB |
| Forgot to logout on shared machine | Cookie auto-expires after 1h |
| Brute-force password | Optional Upstash ratelimit (5 attempts/min/IP) — deferred to v1.1 |

## YAGNI / Out of Scope

- Per-user accounts and audit log
- Multi-tenancy
- Version history / undo (can add `vendissimo:overrides:history` list later)
- Real-time multi-user sync (SSE/WebSocket) — `router.refresh()` suffices
- COGS / margin editing
- Mobile drag-drop polish (works via @dnd-kit touch sensors but not optimized)

## Open Questions

(None — all clarified during brainstorming.)
