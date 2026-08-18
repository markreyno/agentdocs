import { describe, expect, it } from 'vitest'
import { isCommonPassword } from './commonPasswords.js'
import { hashPassword, pwnedRangeHit, sha1HexUpper, verifyPassword } from './password.js'
import { normalizeEmail, validatePasswordShape } from './policy.js'
import { generateTotp, randomTotpSecret, verifyTotp } from './totp.js'
import { isStoredPassword } from './types.js'

describe('password policy', () => {
  it('requires 15 characters without MFA and 8 with MFA', () => {
    expect(validatePasswordShape('shortpwd', { mfaEnabled: false })).toMatch(/at least 15/i)
    expect(validatePasswordShape('shortpwd', { mfaEnabled: true })).toBeNull()
    expect(validatePasswordShape('correct horse battery staple', { mfaEnabled: false })).toBeNull()
  })

  it('does not require mixed character classes', () => {
    expect(validatePasswordShape('aaaaaaaaaaaaaaa', { mfaEnabled: false })).toBeNull()
  })

  it('accepts unicode and long passphrases', () => {
    expect(validatePasswordShape('парольдлявходаок', { mfaEnabled: false })).toBeNull()
    expect(validatePasswordShape(`${'a'.repeat(256)}`, { mfaEnabled: false })).toBeNull()
    expect(validatePasswordShape(`${'a'.repeat(257)}`, { mfaEnabled: false })).toMatch(/at most 256/)
  })

  it('rejects passwords that contain the email local part', () => {
    expect(validatePasswordShape('alexisthebestone', { mfaEnabled: false, email: 'alexis@example.com' })).toMatch(
      /email/i,
    )
  })
})

describe('credential storage', () => {
  it('hashes with scrypt and verifies in a typed record', async () => {
    const stored = await hashPassword('correct horse battery staple')
    expect(stored.alg).toBe('scrypt')
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true)
    expect(await verifyPassword('wrong horse battery staple!', stored)).toBe(false)
  })

  it('rejects magic-hash / type-confused stored values', async () => {
    expect(isStoredPassword('0e215962017')).toBe(false)
    expect(isStoredPassword({ alg: 'bcrypt', hash: '0e215962017' })).toBe(false)
    expect(await verifyPassword('password', '0e215962017')).toBe(false)
    expect(await verifyPassword('password', { hash: 0 })).toBe(false)
  })

  it('screens common passwords', () => {
    expect(isCommonPassword('password123')).toBe(true)
    expect(isCommonPassword('correct horse battery staple')).toBe(false)
  })

  it('parses HIBP range responses without sending the password', () => {
    const sha1 = sha1HexUpper('password')
    const suffix = sha1.slice(5)
    expect(pwnedRangeHit(`${suffix}:12345\nAAAAA:1`, suffix)).toBe(true)
    expect(pwnedRangeHit(`BBBBB:2\nCCCCC:3`, suffix)).toBe(false)
  })
})

describe('email normalization', () => {
  it('lowercases and rejects invalid identifiers', () => {
    expect(normalizeEmail('  Alex@Example.COM ')).toBe('alex@example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
  })
})

describe('TOTP', () => {
  it('verifies the current code and a ±1 step window', () => {
    const secret = randomTotpSecret()
    const now = Date.UTC(2026, 7, 12, 12, 0, 0)
    const code = generateTotp(secret, now)
    expect(verifyTotp(secret, code, now)).toBe(true)
    expect(verifyTotp(secret, code, now + 30_000)).toBe(true)
    expect(verifyTotp(secret, '000000', now)).toBe(false)
  })
})
