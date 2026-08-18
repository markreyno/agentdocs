export interface StoredPassword {
  alg: 'scrypt'
  n: number
  r: number
  p: number
  keylen: number
  salt: string
  hash: string
}

export interface TotpState {
  secretBase32: string
  enabled: boolean
  enrolledAt: number | null
  pendingSecretBase32?: string
}

export interface UserRecord {
  id: string
  email: string
  emailVerified: boolean
  password: StoredPassword
  createdAt: number
  passwordChangedAt: number
  totp: TotpState | null
  backupCodeHashes: string[]
}

export interface PublicUser {
  id: string
  email: string
  emailVerified: boolean
  mfaEnabled: boolean
  createdAt: number
  passwordChangedAt: number
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: number
  lastSeenAt: number
  idleExpiresAt: number
  absoluteExpiresAt: number
  ip: string
  userAgent: string
}

export interface MfaPending {
  userId: string
  expiresAt: number
  ip: string
}

export type AuthEventType =
  | 'signup'
  | 'signup_duplicate'
  | 'verify_email'
  | 'login_success'
  | 'login_failure'
  | 'login_locked'
  | 'login_unverified'
  | 'mfa_success'
  | 'mfa_failure'
  | 'mfa_enroll'
  | 'mfa_disable'
  | 'logout'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'lockout'
  | 'credential_stuffing_pattern'
  | 'session_expired'

export interface AuthEvent {
  at: number
  type: AuthEventType
  ip: string
  userId?: string
  email?: string
  detail?: string
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    mfaEnabled: Boolean(user.totp?.enabled),
    createdAt: user.createdAt,
    passwordChangedAt: user.passwordChangedAt,
  }
}

export function isStoredPassword(value: unknown): value is StoredPassword {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.alg === 'scrypt' &&
    typeof v.n === 'number' &&
    typeof v.r === 'number' &&
    typeof v.p === 'number' &&
    typeof v.keylen === 'number' &&
    typeof v.salt === 'string' &&
    typeof v.hash === 'string' &&
    v.salt.length > 0 &&
    v.hash.length > 0 &&
    Number.isInteger(v.n) &&
    Number.isInteger(v.r) &&
    Number.isInteger(v.p) &&
    Number.isInteger(v.keylen)
  )
}
