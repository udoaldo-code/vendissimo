# Machine-Monitoring Backend Port — Design Spec

Date: 2026-05-21
Status: Approved

## Goal

Port the standalone Go machine-monitoring backend into the `vendissimo` Next.js app so the `/machine-monitoring` route works without a separate process. After this work, `backend/vending-dashboard.exe` is retired — running `vendissimo` alone is enough.

## Background

Today there are three projects under `Vending Machine Close/`:

- `backend/` — a Go (Fiber) service. On boot it logs into `xg.smshj.com`, polls every 30s for vending-machine temperature/online status, and exposes `GET /api/machines` + an SSE `GET /api/stream`. Listens on `:8088`.
- `frontend/` — a separate Vite React app (the legacy UI). Not in scope; left as-is.
- `vendissimo/` — the Next.js 16 dashboard. Its `/machine-monitoring` page and `app/api/machines` + `app/api/stream` route handlers currently **proxy** to the Go backend at `MACHINE_BACKEND_URL` (default `http://localhost:8088`).

The proxy means two processes must run. This spec removes that: the machine-checking logic moves *into* vendissimo.

## Decisions (from brainstorming)

- **Scope:** machine monitoring only — temperature, breach, online status, SSE. Sales stays on the existing Google Sheets path; the Go sales endpoints are NOT ported.
- **Deployment:** vendissimo runs as a persistent local server (`next dev` / `next start`), never serverless. An in-process poll loop + in-memory SSE hub is therefore valid — this mirrors the Go design directly.
- **Credentials:** stored in `.env.local` (gitignored). No secrets committed.
- **Approach:** full TypeScript port, in-process. No Go, no child process.
- **UI:** unchanged. `app/machine-monitoring/page.tsx` and `components/machine-monitoring/RealtimeMachineMonitoring.tsx` already consume `/api/machines` + `/api/stream` with the `MachinesPayload` shape; the ported routes emit the identical shape.

## Architecture

### File structure (new)

```
vendissimo/
  instrumentation.ts                      # Next.js boot hook — starts the monitor
  lib/smshj/
    crypto.ts                             # AES + RSA encryption helpers
    cookies.ts                            # minimal per-session cookie jar
    parse.ts                              # pure HTML-scraping functions
    client.ts                             # SmshjClient — login + machine fetch
    types.ts                              # Machine, MachinesPayload
  lib/machine-monitor/
    hub.ts                                # in-memory SSE pub/sub
    monitor.ts                            # singleton: client + cache + poll loop
  tests/smshj-parse.test.ts               # unit tests for parse.ts
  .env.example                            # committed; documents required vars
```

Files replaced:
- `app/api/machines/route.ts` — proxy logic replaced with a read of the monitor cache.
- `app/api/stream/route.ts` — proxy logic replaced with a real SSE stream off the hub.

### `lib/smshj/crypto.ts`

Ports the Go `smshj` crypto. The remote login encrypts the password with a per-login random AES key, and wraps that AES key with the server's hardcoded RSA public key.

- `genAesKey(): string` — 16 random characters drawn from `0-9a-zA-Z` (use `crypto.randomInt`). The 16-character ASCII string is also the raw 16-byte AES-128 key.
- `encryptPassword(password: string, aesKey: string): string` — AES-128-ECB with PKCS7 padding via `crypto.createCipheriv('aes-128-ecb', Buffer.from(aesKey), null)` (default `autoPadding` true = PKCS7); output base64.
- `encryptAesKey(aesKey: string): string` — `crypto.publicEncrypt({ key: <DER buffer>, format: 'der', type: 'spki', padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(aesKey))`; output base64. The DER buffer is the base64-decoded hardcoded public key (RSA-1024, SPKI) carried verbatim from the Go source constant `publicKeyB64`.

### `lib/smshj/cookies.ts`

Node's `fetch` (undici) does not persist cookies. The Go client keeps two independent cookie jars (operator + mobile sessions). Provide a minimal `CookieJar`:

- `applyFromResponse(res: Response)` — read `res.headers.getSetCookie()`, store each `name=value`.
- `header(): string` — serialize stored cookies into a `Cookie` request-header value.

One `CookieJar` instance per session.

### `lib/smshj/parse.ts`

Pure functions (string in → data out) so they are unit-testable without network. Ports the Go regexes verbatim.

- `parseMachineIds(html: string): string[]` — extract distinct ids from `machine.html?id=(\d+)` matches, preserving first-seen order.
- `parseMachineDetail(html: string, id: string): Machine` — extract:
  - temperature: regex `主柜温度[:：]\s*(-?\d+(?:\.\d+)?)\s*℃` → `temperature_c` (number) or `null`.
  - name: regex `<input[^>]+id=["']new-name["'][^>]*value=["']([^"']+)`.
  - code: regex `sbId\s*:\s*["']([a-z0-9]{10,30})["']`.
  - online: `正常售卖` → `true`; `停止售卖`/`停售` → `false`; else `null`.
  - `scraped_at`: ISO timestamp set by the caller (passed in or set in client) — keep `parseMachineDetail` pure by taking `scrapedAt` as a parameter.

### `lib/smshj/client.ts`

`SmshjClient` class — ports the Go `Client`. Holds two sessions (operator/desktop UA, mobile UA), each with its own `CookieJar`, and login timestamps.

- `constructor(msisdn, password)`.
- `login()` — `loginOperator()` then `loginMobile()`. Each: GET the login page (collect cookies), POST encrypted credentials form, follow with `redirect: 'manual'`, assert HTTP 302 with the expected `location` substring (`operator/index` / `mobile/index`); record login time.
- `reloginIfStale(maxAgeMs)` — re-login either session older than `maxAgeMs`.
- `listMachineIds(maxPages)` — walk `mobile/machinelist.html?pageno=N` until a page yields no new ids.
- `getMachineDetail(id)` — GET `mobile/machine.html?id=<id>&pageno=`, run `parseMachineDetail`.
- `listAllMachines(thresholdC)` — list ids, fetch each detail, mark `breached = temperature_c != null && temperature_c > thresholdC`. A single machine's fetch failure is skipped, not fatal.

All requests go through `fetch` with the session's UA + `Cookie` header, `redirect: 'manual'`, and a timeout (`AbortSignal.timeout(20000)`).

### `lib/machine-monitor/hub.ts`

In-memory SSE broadcaster — ports Go `hub`.

- `subscribe(): { id, queue }` or a callback registration — returns a handle.
- `unsubscribe(handle)`.
- `broadcast(msg: string)` — push to every subscriber.
- `count()`.

Implementation: a `Set` of subscriber objects, each holding an enqueue callback supplied by the SSE route's `ReadableStream`. `broadcast` calls each enqueue; a failed enqueue (closed stream) triggers unsubscribe.

### `lib/machine-monitor/monitor.ts`

Module-level singleton — ports Go `main.go` orchestration. Persists across requests because the Node server process is long-lived.

State: the `SmshjClient`, the hub, and a cache `{ machines, machinesAt, machinesErr }`.

- `start()` — idempotent (guarded by a "started" flag). Reads config from env, constructs the client, performs initial `login()`, runs `refreshMachines()` once, then schedules `setInterval(refreshMachines, MACHINE_REFRESH_SECONDS * 1000)`. If the initial login throws, it is caught and recorded in `machinesErr`; the interval still runs so a later cycle can recover. **The Next.js server must never crash on a login failure** (unlike the Go `log.Fatal`).
- `refreshMachines()` — `reloginIfStale(SESSION_MAX_AGE_MIN)`, `listAllMachines(TEMP_THRESHOLD)`, update cache, `hub.broadcast(sseFrame('machines', payload))`. On error: store the message in `machinesErr`, keep the last good `machines` cache.
- `getMachinesPayload()` — build the JSON payload (see Payload shape).

### `instrumentation.ts`

Next.js runs `register()` once per server process on boot. Body:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMonitor } = await import('./lib/machine-monitor/monitor')
    startMonitor()
  }
}
```

The dynamic import keeps the monitor (and Node `crypto`) out of the edge runtime bundle.

### Routes

`app/api/machines/route.ts`:
```
export const dynamic = 'force-dynamic'
GET → ensure monitor started (idempotent start() call as a safety net) → return getMachinesPayload() as JSON, cache-control: no-store.
```

`app/api/stream/route.ts`:
```
export const dynamic = 'force-dynamic'
GET → return a Response wrapping a ReadableStream:
  - on start: subscribe to the hub; immediately enqueue one `event: machines` frame with the current payload.
  - forward every hub broadcast.
  - every 20s enqueue a `: ping` keepalive comment.
  - on `request.signal` abort / stream cancel: unsubscribe, clear the keepalive timer.
Headers: content-type text/event-stream; cache-control no-cache, no-transform; connection keep-alive.
```

SSE frame format (unchanged from Go): `event: machines\ndata: <json>\n\n`. The client listens for the `machines` event — keep that exact event name.

### Payload shape (`MachinesPayload`)

Emitted by `/api/machines` and inside the SSE `machines` event. Field names are fixed by the existing client type in `RealtimeMachineMonitoring.tsx`:

```
machines: Machine[]
fetched_at: number | null      // unix seconds
age_seconds: number | null
breach_count: number
threshold_c: number
error: string | null
```

`Machine`: `{ id, code, name, temperature_c: number|null, online: boolean|null, scraped_at: string, breached: boolean }`.

### Config / env

`.env.local` (gitignored — `.gitignore` already ignores `.env*`):

```
SMSHJ_MSISDN=855977229411
SMSHJ_PASSWORD=Evolve@@360
TEMP_THRESHOLD=5
MACHINE_REFRESH_SECONDS=30
SESSION_MAX_AGE_MIN=30
```

`.env.example` is committed with the same keys and empty values, documenting what is required. `MACHINE_BACKEND_URL` is removed — the proxy is gone. Defaults in code: threshold 5, refresh 30s, session 30 min; `SMSHJ_MSISDN`/`SMSHJ_PASSWORD` have no safe default — if unset, `start()` records an error and serves an empty payload.

## Error handling

- Boot login failure → caught, recorded in `machinesErr`, retried each interval. Server stays up.
- Per-cycle scrape failure → last good cache retained, `machinesErr` surfaced in the payload `error` field; the UI already renders `payload.error`.
- Per-machine detail failure → that machine skipped, others still returned.
- SSE client disconnect → `request.signal` abort handler unsubscribes; no leaked timers or subscribers.

## Testing

`vendissimo` `tests/` runs in the Jest `node` environment and covers pure logic only.

- `tests/smshj-parse.test.ts` — feed saved HTML fixtures to `parseMachineIds` and `parseMachineDetail`; assert extracted ids, temperature, name, code, online status, and the `null` cases (missing temperature, unknown online state). Fixtures are small inline HTML strings capturing the relevant markup patterns.
- Network code (`client.ts`, `monitor.ts`, routes, SSE) is not unit-tested — verified manually.

Manual verification: start `vendissimo` with `.env.local` present, open `/machine-monitoring`, confirm machine cards populate, the connection indicator shows "Connected", values refresh roughly every 30s, and a temperature over threshold shows a "BREACH" badge — all with the Go backend NOT running.

## Migration / cleanup

- Replace the two proxy route files.
- Remove `MACHINE_BACKEND_URL` usage.
- After the port is verified working, `backend/vending-dashboard.exe` no longer needs to run. The `backend/` and `frontend/` directories are left on disk untouched (out of scope to delete).

## Out of scope

- Sales realtime (`/api/sales/*`) — stays on Google Sheets.
- The legacy `frontend/` Vite app.
- Deleting the `backend/` Go project.
- Serverless/Vercel deployment support.
