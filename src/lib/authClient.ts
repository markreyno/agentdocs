export const PASSWORD_MIN_SOLO = 15
export const PASSWORD_MIN_MFA = 8
export const PASSWORD_MAX = 256

export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
  mfaEnabled: boolean
  createdAt: number
  passwordChangedAt: number
}

export interface AuthSessionInfo {
  createdAt: number
  lastSeenAt: number
  idleExpiresAt: number
  absoluteExpiresAt: number
}

export interface AuthResponse {
  ok?: boolean
  error?: string
  message?: string
  mfaRequired?: boolean
  user?: AuthUser
  session?: AuthSessionInfo
  secret?: string
  otpauthUrl?: string
  backupCodes?: string[]
}

async function readBody(response: Response): Promise<AuthResponse> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object') return body as AuthResponse
  } catch {
    // ignore invalid JSON
  }
  return {}
}

export async function authRequest(path: string, init?: RequestInit): Promise<{ response: Response; body: AuthResponse }> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const body = await readBody(response)
  return { response, body }
}

export function authError(body: AuthResponse, fallback: string): string {
  return body.error || body.message || fallback
}

export async function fetchMe(): Promise<{ user: AuthUser; session: AuthSessionInfo } | null> {
  const { response, body } = await authRequest('/api/auth/me')
  if (!response.ok || !body.user || !body.session) return null
  return { user: body.user, session: body.session }
}

export async function signUp(email: string, password: string): Promise<AuthResponse & { ok: boolean }> {
  const { response, body } = await authRequest('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return { ...body, ok: false, error: authError(body, 'Could not create account.') }
  return { ...body, ok: true }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Invalid email or password') }
  return body
}

export async function completeMfa(code: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/mfa/complete', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Invalid authenticator code.') }
  return body
}

export async function signOut(): Promise<void> {
  await authRequest('/api/auth/logout', { method: 'POST' })
}

export async function verifyEmail(token: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'This verification link is invalid or has expired.') }
  return body
}

export async function forgotPassword(email: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Could not send a reset link.') }
  return body
}

export async function resetPassword(token: string, password: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Could not reset password.') }
  return body
}

export async function changePassword(input: {
  currentPassword: string
  password: string
  totpCode?: string
}): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Could not change password.') }
  return body
}

export async function enrollMfa(): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/mfa/enroll', { method: 'POST' })
  if (!response.ok) return { ...body, error: authError(body, 'Could not start authenticator setup.') }
  return body
}

export async function confirmMfa(code: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/mfa/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Invalid authenticator code.') }
  return body
}

export async function disableMfa(password: string, code: string): Promise<AuthResponse> {
  const { response, body } = await authRequest('/api/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  })
  if (!response.ok) return { ...body, error: authError(body, 'Could not turn off authenticator.') }
  return body
}
