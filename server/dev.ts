/**
 * Local API server for Vite dev (proxies /api → :8787).
 * Uses the same Vercel route handlers; falls back to in-memory store when
 * UPSTASH_REDIS_* is unset.
 */
import 'dotenv/config'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import chat from '../api/chat.js'
import demoSession from '../api/demo-session.js'
import demoStatus from '../api/demo-status.js'
import authSignup from '../api/auth/signup.js'
import authLogin from '../api/auth/login.js'
import authLogout from '../api/auth/logout.js'
import authMe from '../api/auth/me.js'
import authVerifyEmail from '../api/auth/verify-email.js'
import authForgotPassword from '../api/auth/forgot-password.js'
import authResetPassword from '../api/auth/reset-password.js'
import authChangePassword from '../api/auth/change-password.js'
import authMfaComplete from '../api/auth/mfa/complete.js'
import authMfaEnroll from '../api/auth/mfa/enroll.js'
import authMfaConfirm from '../api/auth/mfa/confirm.js'
import authMfaDisable from '../api/auth/mfa/disable.js'
import { DEMO_ENABLED, DEMO_MODEL, DEMO_MAX_TOKENS, DEMO_MAX_TOOL_ITERATIONS, getAllowedOrigins } from '../api/_lib/config.js'
import { getRedis } from '../api/_lib/redis.js'

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const routes: Record<string, ApiHandler> = {
  '/api/demo-status': demoStatus,
  '/api/demo-session': demoSession,
  '/api/chat': chat,
  '/api/auth/signup': authSignup,
  '/api/auth/login': authLogin,
  '/api/auth/logout': authLogout,
  '/api/auth/me': authMe,
  '/api/auth/verify-email': authVerifyEmail,
  '/api/auth/forgot-password': authForgotPassword,
  '/api/auth/reset-password': authResetPassword,
  '/api/auth/change-password': authChangePassword,
  '/api/auth/mfa/complete': authMfaComplete,
  '/api/auth/mfa/enroll': authMfaEnroll,
  '/api/auth/mfa/confirm': authMfaConfirm,
  '/api/auth/mfa/disable': authMfaDisable,
}

function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const raw = Array.isArray(header) ? header.join('; ') : header
  const cookies: Record<string, string> = {}
  if (!raw) return cookies
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key) continue
    try {
      cookies[key] = decodeURIComponent(value)
    } catch {
      cookies[key] = value
    }
  }
  return cookies
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  if (chunks.length === 0) return undefined
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function toVercelResponse(res: ServerResponse): VercelResponse {
  const vercelRes = res as VercelResponse
  vercelRes.status = (code: number) => {
    res.statusCode = code
    return vercelRes
  }
  vercelRes.json = (body: unknown) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    res.end(JSON.stringify(body))
    return vercelRes
  }
  vercelRes.send = (body: unknown) => {
    if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
      return vercelRes.json(body)
    }
    res.end(body as string | Buffer)
    return vercelRes
  }
  return vercelRes
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  const handler = routes[url.pathname]
  if (!handler) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  try {
    const body = req.method === 'GET' || req.method === 'OPTIONS' ? undefined : await readBody(req)
    const vercelReq = Object.assign(req, {
      query: Object.fromEntries(url.searchParams),
      body,
      cookies: parseCookies(req.headers.cookie),
    }) as VercelRequest

    await handler(vercelReq, toVercelResponse(res))
  } catch (err) {
    console.error(err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Internal server error' }))
    } else if (!res.writableEnded) {
      res.end()
    }
  }
}).listen(PORT, () => {
  const origins = [...getAllowedOrigins()].join(', ')
  const chatStatus = DEMO_ENABLED
    ? `demo chat enabled (model=${DEMO_MODEL}, max_tokens=${DEMO_MAX_TOKENS}, tool_loops=${DEMO_MAX_TOOL_ITERATIONS})`
    : 'demo chat DISABLED — set ANTHROPIC_API_KEY to enable'
  const store = getRedis() ? 'Upstash Redis' : 'in-memory (set UPSTASH_REDIS_REST_URL/TOKEN for Redis)'
  console.log(`agentdocs API listening on http://localhost:${PORT}`)
  console.log(`  ${chatStatus}`)
  console.log(`  store: ${store}`)
  console.log(`  allowed origins: ${origins}`)
})
