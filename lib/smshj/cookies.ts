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
