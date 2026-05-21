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
