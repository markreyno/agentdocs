import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isVercelRuntime } from '../redis.js'
import { MFA_COOKIE, SESSION_COOKIE } from './constants.js'

function requestSecure(req: VercelRequest): boolean {
  if (isVercelRuntime()) return true
  const proto = req.headers['x-forwarded-proto']
  const value = Array.isArray(proto) ? proto[0] : proto
  return value === 'https'
}

function cookieHeader(
  name: string,
  value: string,
  options: { maxAgeSec: number; secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, options.maxAgeSec)}`,
  ]
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

function appendCookie(res: VercelResponse, cookie: string): void {
  const prev = res.getHeader('Set-Cookie')
  if (!prev) {
    res.setHeader('Set-Cookie', cookie)
    return
  }
  const list = Array.isArray(prev) ? prev.map(String) : [String(prev)]
  list.push(cookie)
  res.setHeader('Set-Cookie', list)
}

export function readCookie(req: VercelRequest, name: string): string | undefined {
  const fromParsed = req.cookies?.[name]
  if (typeof fromParsed === 'string' && fromParsed) return fromParsed
  const header = req.headers.cookie
  const raw = Array.isArray(header) ? header.join('; ') : header
  if (!raw) return undefined
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key !== name) continue
    const value = part.slice(idx + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return undefined
}

export function setSessionCookie(req: VercelRequest, res: VercelResponse, token: string, maxAgeSec: number): void {
  appendCookie(res, cookieHeader(SESSION_COOKIE, token, { maxAgeSec, secure: requestSecure(req) }))
}

export function setMfaCookie(req: VercelRequest, res: VercelResponse, token: string, maxAgeSec: number): void {
  appendCookie(res, cookieHeader(MFA_COOKIE, token, { maxAgeSec, secure: requestSecure(req) }))
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse): void {
  appendCookie(res, cookieHeader(SESSION_COOKIE, '', { maxAgeSec: 0, secure: requestSecure(req) }))
}

export function clearMfaCookie(req: VercelRequest, res: VercelResponse): void {
  appendCookie(res, cookieHeader(MFA_COOKIE, '', { maxAgeSec: 0, secure: requestSecure(req) }))
}
