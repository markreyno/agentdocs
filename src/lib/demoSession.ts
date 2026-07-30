/**
 * In-memory ephemeral demo session (not shown in the UI).
 * Minted on page load via POST /api/demo-session; used as Bearer on /api/chat.
 */

let sessionToken: string | undefined
let sessionExpiresAt = 0

export function getDemoSessionToken(): string | undefined {
  if (!sessionToken || Date.now() >= sessionExpiresAt) {
    sessionToken = undefined
    sessionExpiresAt = 0
    return undefined
  }
  return sessionToken
}

export function clearDemoSession(): void {
  sessionToken = undefined
  sessionExpiresAt = 0
}

export interface DemoSessionResponse {
  token?: string
  expiresAt?: number
  epoch?: string
  remaining?: number
  enabled?: boolean
  error?: string
}

/** Fetches a fresh (or server-reused) session token. Returns null if minting fails. */
export async function mintDemoSession(): Promise<DemoSessionResponse | null> {
  let response: Response
  try {
    response = await fetch('/api/demo-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    })
  } catch {
    return null
  }

  let body: DemoSessionResponse
  try {
    body = (await response.json()) as DemoSessionResponse
  } catch {
    return null
  }

  if (!response.ok) {
    clearDemoSession()
    return body
  }

  if (typeof body.token === 'string' && typeof body.expiresAt === 'number') {
    sessionToken = body.token
    sessionExpiresAt = body.expiresAt
  } else {
    clearDemoSession()
  }

  return body
}

/**
 * Returns a valid session token, minting one if needed.
 * Retries once after clearing a stale local token.
 */
export async function ensureDemoSessionToken(): Promise<string | null> {
  const existing = getDemoSessionToken()
  if (existing) return existing

  const body = await mintDemoSession()
  if (!body?.token) return null
  return getDemoSessionToken() ?? null
}
