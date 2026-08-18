import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const STEP_SECONDS = 30
const DIGITS = 6
const WINDOW = 1

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function randomTotpSecret(): string {
  const bytes = randomBytes(20)
  return encodeBase32(bytes)
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

export function decodeBase32(secret: string): Buffer {
  const cleaned = secret.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = BASE32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  const code = bin % 10 ** DIGITS
  return String(code).padStart(DIGITS, '0')
}

export function generateTotp(secretBase32: string, now = Date.now()): string {
  const secret = decodeBase32(secretBase32)
  return hotp(secret, Math.floor(now / 1000 / STEP_SECONDS))
}

export function verifyTotp(secretBase32: string, code: string, now = Date.now()): boolean {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false
  const secret = decodeBase32(secretBase32)
  if (secret.length === 0) return false
  const counter = Math.floor(now / 1000 / STEP_SECONDS)
  const provided = Buffer.from(normalized)
  for (let w = -WINDOW; w <= WINDOW; w++) {
    const expected = Buffer.from(hotp(secret, counter + w))
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return true
  }
  return false
}

export function otpauthUrl(email: string, secretBase32: string, issuer = 'agentdocs'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

export function randomBackupCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(randomBytes(5).toString('hex'))
  }
  return codes
}
