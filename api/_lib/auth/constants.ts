export const SESSION_COOKIE = 'agentdocs_session'
export const MFA_COOKIE = 'agentdocs_mfa'

export const SESSION_IDLE_MS = process.env.AUTH_SESSION_IDLE_MS
  ? Number(process.env.AUTH_SESSION_IDLE_MS)
  : 12 * 60 * 60 * 1000
export const SESSION_ABSOLUTE_MS = process.env.AUTH_SESSION_ABSOLUTE_MS
  ? Number(process.env.AUTH_SESSION_ABSOLUTE_MS)
  : 7 * 24 * 60 * 60 * 1000

export const MAX_SESSIONS_PER_USER = 5

export const ACCOUNT_FAIL_LIMIT = 5
export const ACCOUNT_LOCK_MS = 15 * 60 * 1000
export const IP_FAIL_LIMIT = 25
export const IP_FAIL_WINDOW_MS = 10 * 60 * 1000

export const SIGNUP_IP_LIMIT = 10
export const SIGNUP_IP_WINDOW_MS = 60 * 60 * 1000
export const FORGOT_EMAIL_LIMIT = 3
export const FORGOT_EMAIL_WINDOW_MS = 60 * 60 * 1000
export const FORGOT_IP_LIMIT = 10
export const FORGOT_IP_WINDOW_MS = 60 * 60 * 1000

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000
export const MFA_PENDING_TTL_MS = 5 * 60 * 1000

export const GENERIC_LOGIN_ERROR = 'Invalid email or password'
export const GENERIC_SIGNUP_OK =
  'If this email can be used, we sent a verification link. Check your inbox (or the API server log in local development).'
export const GENERIC_FORGOT_OK =
  'If an account exists for that email, we sent a reset link. Check your inbox (or the API server log in local development).'

export const STUFFING_ALERT_THRESHOLD = 20
export const STUFFING_ALERT_WINDOW_MS = 5 * 60 * 1000
