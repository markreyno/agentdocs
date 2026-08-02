import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest } from '@vercel/node'

/** Client IP behind Vercel / local proxies. */
export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() || 'unknown'
  }
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  return req.socket?.remoteAddress || 'unknown'
}

export function getBearerToken(req: VercelRequest): string | undefined {
  const header = req.headers.authorization
  const value = Array.isArray(header) ? header[0] : header
  if (!value?.startsWith('Bearer ')) return undefined
  const token = value.slice('Bearer '.length).trim()
  return token || undefined
}

export function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
