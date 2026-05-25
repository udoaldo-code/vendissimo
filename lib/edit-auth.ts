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
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return false
  } catch {
    return false
  }
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
