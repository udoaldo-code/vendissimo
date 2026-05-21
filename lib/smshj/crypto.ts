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
