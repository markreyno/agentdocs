import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAllowedOrigins } from './config'

function requestOrigin(req: VercelRequest): string | undefined {
  const origin = req.headers.origin
  if (typeof origin === 'string') return origin.trim() || undefined
  if (Array.isArray(origin)) return origin[0]?.trim() || undefined
  return undefined
}

/** Reject foreign-origin callers; set CORS headers when allowed. */
export function enforceAllowedOrigin(req: VercelRequest, res: VercelResponse): boolean {
  const origin = requestOrigin(req)
  const allowed = getAllowedOrigins()
  if (!origin || !allowed.has(origin)) {
    res.status(403).json({ error: 'Forbidden origin' })
    return false
  }
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return true
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') return false
  if (!enforceAllowedOrigin(req, res)) return true
  res.status(204).end()
  return true
}
