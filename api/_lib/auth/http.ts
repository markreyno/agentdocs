import type { VercelRequest, VercelResponse } from '@vercel/node'
import { enforceAllowedOrigin, handleOptions } from '../cors.js'
import { assertStoreAvailable } from '../redis.js'
import { getClientIp } from '../request.js'
import { SESSION_COOKIE } from './constants.js'
import { readCookie } from './cookies.js'
import { getSession, getUserById, touchSession } from './store.js'
import type { SessionRecord, UserRecord } from './types.js'

export function applyAuthHeaders(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}

export function readJsonBody(req: VercelRequest): Record<string, unknown> {
  const body = req.body
  if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed: unknown = JSON.parse(body)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }
  return {}
}

export function readString(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
}

export function userAgentOf(req: VercelRequest): string {
  const header = req.headers['user-agent']
  const value = Array.isArray(header) ? header[0] : header
  return (value ?? '').slice(0, 256)
}

/** Returns true if the handler should return immediately. */
export function beginAuthRoute(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  applyAuthHeaders(res)
  if (handleOptions(req, res)) return true
  if (!methods.includes(req.method ?? '')) {
    res.status(405).json({ error: 'Method not allowed' })
    return true
  }
  if (!enforceAllowedOrigin(req, res)) return true
  const storeError = assertStoreAvailable()
  if (storeError) {
    res.status(503).json({ error: 'Service unavailable' })
    return true
  }
  return false
}

export async function loadSessionUser(
  req: VercelRequest,
): Promise<{ session: SessionRecord; user: UserRecord } | null> {
  const token = readCookie(req, SESSION_COOKIE)
  if (!token) return null
  const session = await getSession(token)
  if (!session) return null
  const touched = await touchSession(session)
  if (!touched) return null
  const user = await getUserById(touched.userId)
  if (!user) return null
  return { session: touched, user }
}

export { getClientIp }
