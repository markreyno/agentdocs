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
import { DEMO_ENABLED, DEMO_MODEL, DEMO_MAX_TOKENS, DEMO_MAX_TOOL_ITERATIONS, getAllowedOrigins } from '../api/_lib/config.js'
import { getRedis } from '../api/_lib/redis.js'

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const routes: Record<string, ApiHandler> = {
  '/api/demo-status': demoStatus,
  '/api/demo-session': demoSession,
  '/api/chat': chat,
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
      cookies: {},
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
