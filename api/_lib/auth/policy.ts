/**
 * NIST SP 800-63B Rev. 4 password rules (length over complexity).
 * Server-side is authoritative; the client may mirror these numbers for UX.
 */

export const PASSWORD_MIN_LENGTH_WITH_MFA = 8
export const PASSWORD_MIN_LENGTH_SOLO = 15
export const PASSWORD_MAX_LENGTH = 256

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null
  return trimmed
}

export function minPasswordLength(mfaEnabled: boolean): number {
  return mfaEnabled ? PASSWORD_MIN_LENGTH_WITH_MFA : PASSWORD_MIN_LENGTH_SOLO
}

/** Length + unicode only — no composition rules (NIST prohibits mandating mixed classes). */
export function validatePasswordShape(
  password: string,
  options: { mfaEnabled: boolean; email?: string },
): string | null {
  if (typeof password !== 'string') return 'Invalid email or password'
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`
  }
  const min = minPasswordLength(options.mfaEnabled)
  if (password.length < min) {
    return options.mfaEnabled
      ? `Password must be at least ${min} characters.`
      : `Password must be at least ${min} characters when it is the only factor. A passphrase works well.`
  }
  const local = options.email?.split('@')[0]
  if (local && local.length >= 4 && password.toLowerCase().includes(local.toLowerCase())) {
    return 'Password must not contain your email address.'
  }
  return null
}
