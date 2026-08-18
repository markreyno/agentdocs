import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { isCommonPassword } from './commonPasswords.js'
import { validatePasswordShape } from './policy.js'
import { isStoredPassword, type StoredPassword } from './types.js'

const scryptAsync = promisify(scrypt)

const KEYLEN = 32
const SALT_BYTES = 16

function scryptParamsForNewHashes(): { N: number; r: number; p: number; maxmem: number } {
  const n = process.env.VITEST ? 16 : 16384
  return { N: n, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
}

function plausibleParams(n: number, r: number, p: number, keylen: number): boolean {
  if (!Number.isInteger(n) || n < 16 || n > 1 << 20) return false
  if ((n & (n - 1)) !== 0) return false
  if (!Number.isInteger(r) || r < 1 || r > 32) return false
  if (!Number.isInteger(p) || p < 1 || p > 16) return false
  if (!Number.isInteger(keylen) || keylen < 16 || keylen > 64) return false
  return true
}

export async function hashPassword(password: string): Promise<StoredPassword> {
  const salt = randomBytes(SALT_BYTES)
  const params = scryptParamsForNewHashes()
  const derived = (await scryptAsync(password, salt, KEYLEN, params)) as Buffer
  return {
    alg: 'scrypt',
    n: params.N,
    r: params.r,
    p: params.p,
    keylen: KEYLEN,
    salt: salt.toString('base64url'),
    hash: derived.toString('base64url'),
  }
}

export async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (!isStoredPassword(stored)) return false
  if (!plausibleParams(stored.n, stored.r, stored.p, stored.keylen)) return false
  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(stored.salt, 'base64url')
    expected = Buffer.from(stored.hash, 'base64url')
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length !== stored.keylen) return false
  const derived = (await scryptAsync(password, salt, stored.keylen, {
    N: stored.n,
    r: stored.r,
    p: stored.p,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

let dummyHash: StoredPassword | undefined

/** Hash a dummy password so unknown-user logins take the same time as known users. */
export async function dummyVerify(password: string): Promise<void> {
  if (!dummyHash) dummyHash = await hashPassword('dummy-not-a-real-account')
  await verifyPassword(password, dummyHash)
}

export function sha1HexUpper(value: string): string {
  return createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase()
}

export function pwnedRangeHit(body: string, suffix: string): boolean {
  const target = suffix.toUpperCase()
  for (const line of body.split(/\r?\n/)) {
    const [hashSuffix, count] = line.split(':')
    if (hashSuffix?.trim().toUpperCase() === target && Number(count) > 0) return true
  }
  return false
}

export async function isBreachedPassword(password: string): Promise<boolean> {
  if (isCommonPassword(password)) return true
  if (process.env.AUTH_SKIP_HIBP === '1') return false

  const sha1 = sha1HexUpper(password)
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 4000)
  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: {
        'User-Agent': 'agentdocs-auth',
        'Add-Padding': 'true',
      },
      signal: ac.signal,
    })
    if (!response.ok) return false
    const body = await response.text()
    return pwnedRangeHit(body, suffix)
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function validateNewPassword(
  password: string,
  options: { mfaEnabled: boolean; email?: string },
): Promise<string | null> {
  const shape = validatePasswordShape(password, options)
  if (shape) return shape
  if (await isBreachedPassword(password)) {
    return 'This password appears in known breach lists or is too common. Choose a different passphrase.'
  }
  return null
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('base64url')
}

export function backupCodesMatch(code: string, hashes: string[]): boolean {
  const hashed = Buffer.from(hashBackupCode(code.trim().toLowerCase()))
  for (const stored of hashes) {
    const expected = Buffer.from(stored)
    if (hashed.length === expected.length && timingSafeEqual(hashed, expected)) return true
  }
  return false
}
