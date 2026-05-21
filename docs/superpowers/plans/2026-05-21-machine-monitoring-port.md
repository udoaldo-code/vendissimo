# Machine-Monitoring Backend Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Go `xg.smshj.com` machine-monitoring backend into the `vendissimo` Next.js app as in-process TypeScript, so `/machine-monitoring` works without a separate process.

**Architecture:** A `lib/smshj/` module reproduces the login/crypto/scrape client. A `lib/machine-monitor/` module runs a singleton poll loop (started from `instrumentation.ts`) and an in-memory SSE hub. The `app/api/machines` and `app/api/stream` route handlers are rewritten to read the monitor cache and stream the hub instead of proxying to `http://localhost:8088`.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript strict, Node `crypto`, Jest (`node` env).

---

## Reference: ported types

These types are created in Task 3 (`lib/smshj/types.ts`) and used by Tasks 4, 6, 7:

```ts
export type Machine = {
  id: string
  code: string
  name: string
  temperature_c: number | null
  online: boolean | null
  scraped_at: string
  breached: boolean
}

export type MachinesPayload = {
  machines: Machine[]
  fetched_at: number | null
  age_seconds: number | null
  breach_count: number
  threshold_c: number
  error: string | null
}
```

---

## Task 1: AES + RSA crypto helpers

**Files:**
- Create: `lib/smshj/crypto.ts`
- Test: `tests/smshj-crypto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/smshj-crypto.test.ts`:

```ts
import crypto from 'node:crypto'
import { genAesKey, encryptPassword, encryptAesKey } from '@/lib/smshj/crypto'

describe('genAesKey', () => {
  it('returns a 16-char string from the allowed alphabet', () => {
    const k = genAesKey()
    expect(k).toHaveLength(16)
    expect(k).toMatch(/^[0-9a-zA-Z]{16}$/)
  })

  it('returns different keys on successive calls', () => {
    expect(genAesKey()).not.toBe(genAesKey())
  })
})

describe('encryptPassword', () => {
  it('produces base64 that decrypts back to the original (AES-128-ECB/PKCS7)', () => {
    const key = 'abcdef0123456789'
    const ct = encryptPassword('Evolve@@360', key)
    const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(key, 'utf8'), null)
    const pt = Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8')
    expect(pt).toBe('Evolve@@360')
  })
})

describe('encryptAesKey', () => {
  it('produces base64 of a 128-byte RSA-1024 block', () => {
    const buf = Buffer.from(encryptAesKey('abcdef0123456789'), 'base64')
    expect(buf).toHaveLength(128)
  })

  it('is non-deterministic (PKCS1 v1.5 random padding)', () => {
    expect(encryptAesKey('abcdef0123456789')).not.toBe(encryptAesKey('abcdef0123456789'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/smshj-crypto.test.ts`
Expected: FAIL — `Cannot find module '@/lib/smshj/crypto'`.

- [ ] **Step 3: Write the implementation**

Create `lib/smshj/crypto.ts`:

```ts
import crypto from 'node:crypto'

const AES_KEY_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

// RSA-1024 SPKI public key (base64 DER), carried verbatim from the Go smshj client.
const PUBLIC_KEY_B64 =
  'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCPN92lYo5y9t+8PwG854tG1Ysg2UuoQTTov' +
  'BmgQjLke4rF3Ie4e0vGgt/C9DgE1ao/MQfm1Fl8DCypP12USizCI6/hso1yz7liGA7y3tNLZg' +
  '0I3YEHYiTyf4UWokeTv5lilqRJ/gQWJ4e4bwPvG3/piQ14H3kGpPzivDUMuBlhBQIDAQAB'

const PUBLIC_KEY_DER = Buffer.from(PUBLIC_KEY_B64, 'base64')

/** 16 random characters — also the raw 16-byte AES-128 key. */
export function genAesKey(): string {
  let out = ''
  for (let i = 0; i < 16; i++) {
    out += AES_KEY_CHARS[crypto.randomInt(AES_KEY_CHARS.length)]
  }
  return out
}

/** AES-128-ECB with PKCS7 padding, base64-encoded. */
export function encryptPassword(password: string, aesKey: string): string {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(aesKey, 'utf8'), null)
  // autoPadding defaults to true = PKCS7
  return Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]).toString('base64')
}

/** RSA-PKCS1v1.5 wrap of the AES key, base64-encoded. */
export function encryptAesKey(aesKey: string): string {
  const enc = crypto.publicEncrypt(
    { key: PUBLIC_KEY_DER, format: 'der', type: 'spki', padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(aesKey, 'utf8'),
  )
  return enc.toString('base64')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/smshj-crypto.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/smshj/crypto.ts tests/smshj-crypto.test.ts
git commit -m "Add smshj AES/RSA crypto helpers"
```

---

## Task 2: Per-session cookie jar

**Files:**
- Create: `lib/smshj/cookies.ts`
- Test: `tests/smshj-cookies.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/smshj-cookies.test.ts`:

```ts
import { CookieJar } from '@/lib/smshj/cookies'

function resWithCookies(...cookies: string[]): Response {
  const h = new Headers()
  for (const c of cookies) h.append('set-cookie', c)
  return new Response('', { headers: h })
}

describe('CookieJar', () => {
  it('stores cookies from a response and serializes them into a Cookie header', () => {
    const jar = new CookieJar()
    jar.applyFromResponse(resWithCookies('JSESSIONID=abc123; Path=/; HttpOnly', 'foo=bar; Path=/'))
    expect(jar.header()).toBe('JSESSIONID=abc123; foo=bar')
  })

  it('overwrites a cookie when the same name is set again', () => {
    const jar = new CookieJar()
    jar.applyFromResponse(resWithCookies('JSESSIONID=old'))
    jar.applyFromResponse(resWithCookies('JSESSIONID=new'))
    expect(jar.header()).toBe('JSESSIONID=new')
  })

  it('returns an empty string when no cookies are stored', () => {
    expect(new CookieJar().header()).toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/smshj-cookies.test.ts`
Expected: FAIL — `Cannot find module '@/lib/smshj/cookies'`.

- [ ] **Step 3: Write the implementation**

Create `lib/smshj/cookies.ts`:

```ts
/**
 * Minimal per-session cookie store. Node's fetch (undici) keeps no cookie jar,
 * so each smshj session (operator / mobile) owns one of these.
 */
export class CookieJar {
  private store = new Map<string, string>()

  /** Read Set-Cookie headers off a response and store each name=value pair. */
  applyFromResponse(res: Response): void {
    const setCookies = res.headers.getSetCookie?.() ?? []
    for (const sc of setCookies) {
      const pair = sc.split(';', 1)[0]
      const eq = pair.indexOf('=')
      if (eq <= 0) continue
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      this.store.set(name, value)
    }
  }

  /** Serialize stored cookies into a Cookie request-header value. */
  header(): string {
    return [...this.store.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/smshj-cookies.test.ts`
Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/smshj/cookies.ts tests/smshj-cookies.test.ts
git commit -m "Add smshj per-session cookie jar"
```

---

## Task 3: Types + pure HTML scraping

**Files:**
- Create: `lib/smshj/types.ts`
- Create: `lib/smshj/parse.ts`
- Test: `tests/smshj-parse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/smshj-parse.test.ts`:

```ts
import { parseMachineIds, parseMachineDetail } from '@/lib/smshj/parse'

describe('parseMachineIds', () => {
  it('extracts distinct ids in first-seen order', () => {
    const html = `<a href="machine.html?id=12">x</a><a href="machine.html?id=7">y</a><a href="machine.html?id=12">dup</a>`
    expect(parseMachineIds(html)).toEqual(['12', '7'])
  })

  it('returns an empty array when no ids are present', () => {
    expect(parseMachineIds('<html>nothing</html>')).toEqual([])
  })
})

describe('parseMachineDetail', () => {
  const SCRAPED = '2026-05-21T00:00:00.000Z'

  it('extracts temperature, name, code, and online status', () => {
    const html = `
      <div>主柜温度: 8.5 ℃</div>
      <input id="new-name" value="Airport A1">
      <script>var x = { sbId: 'abc1234567', y:1 }</script>
      <span>正常售卖</span>`
    expect(parseMachineDetail(html, '42', SCRAPED)).toEqual({
      id: '42', code: 'abc1234567', name: 'Airport A1',
      temperature_c: 8.5, online: true, scraped_at: SCRAPED, breached: false,
    })
  })

  it('handles a negative temperature and the fullwidth colon', () => {
    expect(parseMachineDetail('主柜温度：-3℃', '1', SCRAPED).temperature_c).toBe(-3)
  })

  it('marks online false on a stop-selling page', () => {
    expect(parseMachineDetail('停止售卖', '1', SCRAPED).online).toBe(false)
  })

  it('leaves temperature and online null when absent', () => {
    const m = parseMachineDetail('<html>empty</html>', '1', SCRAPED)
    expect(m.temperature_c).toBeNull()
    expect(m.online).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/smshj-parse.test.ts`
Expected: FAIL — `Cannot find module '@/lib/smshj/parse'`.

- [ ] **Step 3: Write the type definitions**

Create `lib/smshj/types.ts`:

```ts
export type Machine = {
  id: string
  code: string
  name: string
  temperature_c: number | null
  online: boolean | null
  scraped_at: string
  breached: boolean
}

export type MachinesPayload = {
  machines: Machine[]
  fetched_at: number | null
  age_seconds: number | null
  breach_count: number
  threshold_c: number
  error: string | null
}
```

- [ ] **Step 4: Write the parser implementation**

Create `lib/smshj/parse.ts`:

```ts
import type { Machine } from './types'

const RE_MACHINE_ID = /machine\.html\?id=(\d+)/g
const RE_TEMP = /主柜温度[:：]\s*(-?\d+(?:\.\d+)?)\s*℃/
const RE_NAME = /<input[^>]+id=["']new-name["'][^>]*value=["']([^"']+)/
const RE_CODE = /sbId\s*:\s*["']([a-z0-9]{10,30})["']/

/** Distinct machine ids in first-seen order. */
export function parseMachineIds(html: string): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const m of html.matchAll(RE_MACHINE_ID)) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      ids.push(m[1])
    }
  }
  return ids
}

/** Parse one machine-detail page. `scrapedAt` is passed in so this stays pure. */
export function parseMachineDetail(html: string, id: string, scrapedAt: string): Machine {
  const m: Machine = {
    id, code: '', name: '', temperature_c: null, online: null, scraped_at: scrapedAt, breached: false,
  }
  const t = RE_TEMP.exec(html)
  if (t) {
    const n = parseFloat(t[1])
    if (!Number.isNaN(n)) m.temperature_c = n
  }
  const nm = RE_NAME.exec(html)
  if (nm) m.name = nm[1]
  const cd = RE_CODE.exec(html)
  if (cd) m.code = cd[1]
  if (html.includes('正常售卖')) m.online = true
  else if (html.includes('停止售卖') || html.includes('停售')) m.online = false
  return m
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/smshj-parse.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/smshj/types.ts lib/smshj/parse.ts tests/smshj-parse.test.ts
git commit -m "Add smshj types and HTML scraping parsers"
```

---

## Task 4: SmshjClient (login + machine fetch)

**Files:**
- Create: `lib/smshj/client.ts`

No unit test — this is network code, verified end-to-end in Task 7.

- [ ] **Step 1: Write the implementation**

Create `lib/smshj/client.ts`:

```ts
import { genAesKey, encryptPassword, encryptAesKey } from './crypto'
import { CookieJar } from './cookies'
import { parseMachineIds, parseMachineDetail } from './parse'
import type { Machine } from './types'

const BASE = 'https://xg.smshj.com'
const TENANT = 'hbshengma'
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
const TIMEOUT_MS = 20_000

type Session = { jar: CookieJar; ua: string; loginAt: number }

/** Reverse-engineered xg.smshj.com client — ports the Go `smshj` package. */
export class SmshjClient {
  private op: Session = { jar: new CookieJar(), ua: DESKTOP_UA, loginAt: 0 }
  private mb: Session = { jar: new CookieJar(), ua: MOBILE_UA, loginAt: 0 }

  constructor(private msisdn: string, private password: string) {}

  private baseURL(): string {
    return `${BASE}/${TENANT}`
  }

  private async req(session: Session, method: 'GET' | 'POST', url: string, body?: string): Promise<Response> {
    const headers: Record<string, string> = { 'User-Agent': session.ua }
    const cookie = session.jar.header()
    if (cookie) headers['Cookie'] = cookie
    if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
    const res = await fetch(url, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    session.jar.applyFromResponse(res)
    return res
  }

  private async loginSession(
    session: Session,
    loginPage: string,
    loginAction: string,
    extraForm: Record<string, string>,
    expectLoc: string,
  ): Promise<void> {
    const pre = await this.req(session, 'GET', `${this.baseURL()}/${loginPage}`)
    await pre.text()

    const aesKey = genAesKey()
    const form = new URLSearchParams({
      username: this.msisdn,
      password: encryptPassword(this.password, aesKey),
      encryptAesKey: encryptAesKey(aesKey),
      ...extraForm,
    })
    const res = await this.req(session, 'POST', `${this.baseURL()}/${loginAction}`, form.toString())
    await res.text()

    const loc = res.headers.get('location') ?? ''
    if (res.status !== 302 || !loc.includes(expectLoc)) {
      throw new Error(`login failed (${loginPage}): status=${res.status} loc=${loc}`)
    }
    session.loginAt = Date.now()
  }

  /** Authenticate both the operator (desktop) and mobile sessions. */
  async login(): Promise<void> {
    await this.loginSession(this.op, 'login.html', 'user/login.action', { smsCode: '' }, 'operator/index')
    await this.loginSession(this.mb, 'mobile/login.html', 'mobile/mobilelogin.html', { rememberMe: 'true' }, 'mobile/index')
  }

  /** Re-authenticate either session if it is older than maxAgeMs (or never logged in). */
  async reloginIfStale(maxAgeMs: number): Promise<void> {
    const now = Date.now()
    if (this.op.loginAt === 0 || now - this.op.loginAt > maxAgeMs) {
      await this.loginSession(this.op, 'login.html', 'user/login.action', { smsCode: '' }, 'operator/index')
    }
    if (this.mb.loginAt === 0 || now - this.mb.loginAt > maxAgeMs) {
      await this.loginSession(this.mb, 'mobile/login.html', 'mobile/mobilelogin.html', { rememberMe: 'true' }, 'mobile/index')
    }
  }

  private async listMachineIds(maxPages: number): Promise<string[]> {
    const seen = new Set<string>()
    const ids: string[] = []
    for (let pageno = 1; pageno <= maxPages; pageno++) {
      const res = await this.req(this.mb, 'GET', `${this.baseURL()}/mobile/machinelist.html?pageno=${pageno}`)
      const html = await res.text()
      let added = 0
      for (const id of parseMachineIds(html)) {
        if (!seen.has(id)) {
          seen.add(id)
          ids.push(id)
          added++
        }
      }
      if (added === 0) break
    }
    return ids
  }

  private async getMachineDetail(id: string): Promise<Machine> {
    const res = await this.req(this.mb, 'GET', `${this.baseURL()}/mobile/machine.html?id=${id}&pageno=`)
    const html = await res.text()
    return parseMachineDetail(html, id, new Date().toISOString())
  }

  /** Fetch every machine's detail; mark `breached` when temperature exceeds thresholdC. */
  async listAllMachines(thresholdC: number): Promise<Machine[]> {
    const ids = await this.listMachineIds(10)
    const out: Machine[] = []
    for (const id of ids) {
      try {
        const m = await this.getMachineDetail(id)
        if (m.temperature_c != null && m.temperature_c > thresholdC) m.breached = true
        out.push(m)
      } catch {
        // a single machine's fetch failure is skipped, not fatal
      }
    }
    return out
  }
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `npm run build`
Expected: build succeeds (the new module is not imported anywhere yet, but must compile).

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors (a pre-existing `DailySalesEntry` unused warning in `lib/aggregate.ts` is acceptable).

- [ ] **Step 4: Commit**

```bash
git add lib/smshj/client.ts
git commit -m "Add SmshjClient login and machine-fetch"
```

---

## Task 5: In-memory SSE hub

**Files:**
- Create: `lib/machine-monitor/hub.ts`
- Test: `tests/machine-hub.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/machine-hub.test.ts`:

```ts
import { Hub } from '@/lib/machine-monitor/hub'

describe('Hub', () => {
  it('broadcasts a message to every subscriber', () => {
    const hub = new Hub()
    const a: string[] = []
    const b: string[] = []
    hub.subscribe(m => a.push(m))
    hub.subscribe(m => b.push(m))
    hub.broadcast('hello')
    expect(a).toEqual(['hello'])
    expect(b).toEqual(['hello'])
  })

  it('stops delivering to a subscriber after unsubscribe', () => {
    const hub = new Hub()
    const got: string[] = []
    const fn = (m: string) => got.push(m)
    hub.subscribe(fn)
    hub.unsubscribe(fn)
    hub.broadcast('x')
    expect(got).toEqual([])
  })

  it('drops a subscriber whose callback throws', () => {
    const hub = new Hub()
    hub.subscribe(() => { throw new Error('boom') })
    hub.broadcast('x')
    expect(hub.count()).toBe(0)
  })

  it('reports the subscriber count', () => {
    const hub = new Hub()
    expect(hub.count()).toBe(0)
    hub.subscribe(() => {})
    expect(hub.count()).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest tests/machine-hub.test.ts`
Expected: FAIL — `Cannot find module '@/lib/machine-monitor/hub'`.

- [ ] **Step 3: Write the implementation**

Create `lib/machine-monitor/hub.ts`:

```ts
type Subscriber = (msg: string) => void

/** In-memory SSE fan-out: deliver one event string to N subscribers. */
export class Hub {
  private subs = new Set<Subscriber>()

  subscribe(fn: Subscriber): void {
    this.subs.add(fn)
  }

  unsubscribe(fn: Subscriber): void {
    this.subs.delete(fn)
  }

  /** Deliver msg to every subscriber; drop any whose callback throws. */
  broadcast(msg: string): void {
    for (const fn of this.subs) {
      try {
        fn(msg)
      } catch {
        this.subs.delete(fn)
      }
    }
  }

  count(): number {
    return this.subs.size
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/machine-hub.test.ts`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/machine-monitor/hub.ts tests/machine-hub.test.ts
git commit -m "Add in-memory SSE hub"
```

---

## Task 6: Monitor singleton (poll loop + cache)

**Files:**
- Create: `lib/machine-monitor/monitor.ts`

No unit test — this is timer/network orchestration, verified end-to-end in Task 7.

- [ ] **Step 1: Write the implementation**

Create `lib/machine-monitor/monitor.ts`:

```ts
import { SmshjClient } from '@/lib/smshj/client'
import type { Machine, MachinesPayload } from '@/lib/smshj/types'
import { Hub } from './hub'

function envInt(key: string, def: number): number {
  const v = process.env[key]
  if (!v) return def
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? def : n
}

function envFloat(key: string, def: number): number {
  const v = process.env[key]
  if (!v) return def
  const n = parseFloat(v)
  return Number.isNaN(n) ? def : n
}

const THRESHOLD_C = envFloat('TEMP_THRESHOLD', 5)
const REFRESH_SECONDS = envInt('MACHINE_REFRESH_SECONDS', 30)
const SESSION_MAX_AGE_MS = envInt('SESSION_MAX_AGE_MIN', 30) * 60_000

/** SSE hub — subscribed by the /api/stream route. */
export const hub = new Hub()

let started = false
let client: SmshjClient | null = null
let machines: Machine[] = []
let machinesAt = 0 // ms epoch; 0 means never fetched
let machinesErr = ''

/** Format an SSE frame: `event: <event>\ndata: <data>\n\n`. */
export function sseFrame(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`
}

/** Current machine snapshot in the shape the UI expects. */
export function getMachinesPayload(): MachinesPayload {
  let breach = 0
  for (const m of machines) if (m.breached) breach++
  return {
    machines,
    fetched_at: machinesAt ? Math.floor(machinesAt / 1000) : null,
    age_seconds: machinesAt ? (Date.now() - machinesAt) / 1000 : null,
    breach_count: breach,
    threshold_c: THRESHOLD_C,
    error: machinesErr || null,
  }
}

async function refreshMachines(): Promise<void> {
  if (!client) return
  try {
    await client.reloginIfStale(SESSION_MAX_AGE_MS)
    machines = await client.listAllMachines(THRESHOLD_C)
    machinesAt = Date.now()
    machinesErr = ''
  } catch (e) {
    machinesErr = e instanceof Error ? e.message : 'machine refresh failed'
    console.error('[machine-monitor] refresh error:', machinesErr)
    return
  }
  hub.broadcast(sseFrame('machines', JSON.stringify(getMachinesPayload())))
}

/**
 * Start the background poll loop. Idempotent — safe to call from both
 * instrumentation register() and route handlers. Never throws: a login
 * failure is recorded and retried on the next interval.
 */
export function startMonitor(): void {
  if (started) return
  started = true

  const msisdn = process.env.SMSHJ_MSISDN
  const password = process.env.SMSHJ_PASSWORD
  if (!msisdn || !password) {
    machinesErr = 'SMSHJ_MSISDN / SMSHJ_PASSWORD not set'
    console.error('[machine-monitor]', machinesErr)
    return
  }
  client = new SmshjClient(msisdn, password)

  void (async () => {
    try {
      await client!.login()
    } catch (e) {
      machinesErr = e instanceof Error ? e.message : 'login failed'
      console.error('[machine-monitor] login error:', machinesErr)
    }
    await refreshMachines()
  })()

  setInterval(() => {
    void refreshMachines()
  }, REFRESH_SECONDS * 1000)
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: 0 errors (pre-existing `DailySalesEntry` warning acceptable).

- [ ] **Step 4: Commit**

```bash
git add lib/machine-monitor/monitor.ts
git commit -m "Add machine-monitor poll-loop singleton"
```

---

## Task 7: Instrumentation hook, API routes, env files

**Files:**
- Create: `instrumentation.ts`
- Create: `.env.example`
- Create: `.env.local` (NOT committed — gitignored)
- Modify: `app/api/machines/route.ts` (full rewrite — replaces the proxy)
- Modify: `app/api/stream/route.ts` (full rewrite — replaces the proxy)

- [ ] **Step 1: Create the instrumentation hook**

Create `instrumentation.ts` at the repo root (beside `app/`):

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMonitor } = await import('@/lib/machine-monitor/monitor')
    startMonitor()
  }
}
```

- [ ] **Step 2: Rewrite `app/api/machines/route.ts`**

Replace the entire file contents with:

```ts
import { getMachinesPayload, startMonitor } from '@/lib/machine-monitor/monitor'

export const dynamic = 'force-dynamic'

export function GET() {
  startMonitor() // idempotent safety net in case instrumentation has not run
  return Response.json(getMachinesPayload(), {
    headers: { 'cache-control': 'no-store' },
  })
}
```

- [ ] **Step 3: Rewrite `app/api/stream/route.ts`**

Replace the entire file contents with:

```ts
import { hub, getMachinesPayload, sseFrame, startMonitor } from '@/lib/machine-monitor/monitor'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  startMonitor()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder()
      const send = (msg: string) => controller.enqueue(enc.encode(msg))

      // initial snapshot so the client renders immediately
      send(sseFrame('machines', JSON.stringify(getMachinesPayload())))

      const sub = (msg: string) => send(msg)
      hub.subscribe(sub)

      const keepAlive = setInterval(() => {
        try {
          send(': ping\n\n')
        } catch {
          // stream already closed
        }
      }, 20_000)

      const close = () => {
        clearInterval(keepAlive)
        hub.unsubscribe(sub)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
      request.signal.addEventListener('abort', close)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 4: Create `.env.example`**

Create `.env.example` at the repo root:

```
SMSHJ_MSISDN=
SMSHJ_PASSWORD=
TEMP_THRESHOLD=5
MACHINE_REFRESH_SECONDS=30
SESSION_MAX_AGE_MIN=30
```

- [ ] **Step 5: Create `.env.local`**

Create `.env.local` at the repo root (this file is gitignored — never committed):

```
SMSHJ_MSISDN=855977229411
SMSHJ_PASSWORD=Evolve@@360
TEMP_THRESHOLD=5
MACHINE_REFRESH_SECONDS=30
SESSION_MAX_AGE_MIN=30
```

Verify it is ignored: run `git check-ignore .env.local` — expected output: `.env.local`.

- [ ] **Step 6: Verify build and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds; lint reports 0 errors (pre-existing `DailySalesEntry` warning acceptable).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass — the 4 pre-existing dark-mode-era suites plus the 4 new suites (`smshj-crypto`, `smshj-cookies`, `smshj-parse`, `machine-hub`).

- [ ] **Step 8: End-to-end manual verification (Go backend NOT running)**

1. Confirm nothing is on `:8088` — run `netstat -ano | grep 8088` (Git Bash) and confirm no `LISTENING` line.
2. Start vendissimo: `npm run dev`.
3. Watch the dev-server console — expect a `[machine-monitor]` login line, then within ~30s machine data (no `[machine-monitor] login error` / `refresh error`).
4. Open `http://localhost:3000/machine-monitoring`.
5. Confirm: the connection card shows "Connected"; machine cards populate with temperatures; a machine over `TEMP_THRESHOLD` shows a red "BREACH" badge; values refresh on their own roughly every 30s.
6. Open the browser Network tab — confirm `/api/stream` is an open `eventsource`/`text/event-stream` request receiving `machines` events, and `/api/machines` returns JSON with a non-empty `machines` array.

If any step fails, fix the cause before committing.

- [ ] **Step 9: Commit**

```bash
git add instrumentation.ts .env.example app/api/machines/route.ts app/api/stream/route.ts
git commit -m "Run machine monitoring in-process; drop Go backend proxy"
```

(`.env.local` is gitignored and is intentionally not staged.)

---

## Self-Review Notes

- **Spec coverage:** crypto (T1), cookie jar (T2), parse + types (T3), `SmshjClient` (T4), hub (T5), monitor singleton + poll loop (T6), `instrumentation.ts` + both routes + env files (T7). Payload shape and SSE `machines` event name match the spec and the existing `RealtimeMachineMonitoring.tsx`. All spec sections covered.
- **Out of scope, honored:** no sales endpoints; `backend/` and `frontend/` left untouched; no serverless support.
- **Type consistency:** `Machine` / `MachinesPayload` defined once in `lib/smshj/types.ts` (T3), imported unchanged by `client.ts` (T4) and `monitor.ts` (T6). `getMachinesPayload`, `hub`, `sseFrame`, `startMonitor` exported from `monitor.ts` (T6) are the exact names imported by the routes and instrumentation (T7).
- **Known risk:** `Response.headers.getSetCookie()` requires Node 18.14+/20+ — vendissimo targets Node 20 (`@types/node` ^20), so this is satisfied. The `crypto.ts` AES round-trip test proves PKCS7/AES-128-ECB; `encryptAesKey` is verified only by ciphertext length and non-determinism because the RSA private key is not available — final correctness is proven by a successful live login in T7 Step 8.
