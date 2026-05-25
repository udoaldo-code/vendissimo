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
