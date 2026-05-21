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
