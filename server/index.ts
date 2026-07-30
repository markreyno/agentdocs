import 'dotenv/config'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree } from '../src/lib/docTree'
import { DOC_TOOLS, executeDocTool } from '../src/lib/docTools'

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787

/** Hard cap on Anthropic output tokens per model call (strict demo budget). */
const DEMO_MAX_TOKENS = process.env.DEMO_MAX_TOKENS ? Number(process.env.DEMO_MAX_TOKENS) : 2048
/** Hard cap on model→tool rounds per /api/chat request (must fit get_story_blocks + insert_blocks). */
const DEMO_MAX_TOOL_ITERATIONS = process.env.DEMO_MAX_TOOL_ITERATIONS
  ? Number(process.env.DEMO_MAX_TOOL_ITERATIONS)
  : 4
/** Max messages accepted in one chat request. */
const DEMO_MAX_MESSAGES = process.env.DEMO_MAX_MESSAGES ? Number(process.env.DEMO_MAX_MESSAGES) : 12
/** Max characters per message content. */
const DEMO_MAX_MESSAGE_CHARS = process.env.DEMO_MAX_MESSAGE_CHARS
  ? Number(process.env.DEMO_MAX_MESSAGE_CHARS)
  : 4_000

const DEMO_RATE_LIMIT = 5
const DEMO_MODEL = process.env.DEMO_MODEL ?? 'claude-haiku-4-5'

/** Ephemeral session lifetime (default 20 minutes). */
const DEMO_SESSION_TTL_MS = process.env.DEMO_SESSION_TTL_MS
  ? Number(process.env.DEMO_SESSION_TTL_MS)
  : 20 * 60 * 1000
const DEMO_SESSION_MAX_ENTRIES = process.env.DEMO_SESSION_MAX_ENTRIES
  ? Number(process.env.DEMO_SESSION_MAX_ENTRIES)
  : 10_000
/** Cap how often an IP can mint sessions (abuse / rotation). */
const DEMO_SESSION_MINT_LIMIT = process.env.DEMO_SESSION_MINT_LIMIT
  ? Number(process.env.DEMO_SESSION_MINT_LIMIT)
  : 20
const DEMO_SESSION_MINT_WINDOW_MS = process.env.DEMO_SESSION_MINT_WINDOW_MS
  ? Number(process.env.DEMO_SESSION_MINT_WINDOW_MS)
  : 60 * 60 * 1000

const DEMO_USAGE_TTL_MS = process.env.DEMO_USAGE_TTL_MS
  ? Number(process.env.DEMO_USAGE_TTL_MS)
  : 24 * 60 * 60 * 1000
const DEMO_USAGE_MAX_ENTRIES = process.env.DEMO_USAGE_MAX_ENTRIES
  ? Number(process.env.DEMO_USAGE_MAX_ENTRIES)
  : 10_000
const SWEEP_INTERVAL_MS = 60_000

/**
 * Comma-separated Origins allowed to call demo APIs.
 * Defaults to local Vite ports only — set DEMO_ALLOWED_ORIGINS in production.
 */
const DEMO_ALLOWED_ORIGINS = parseAllowedOrigins(process.env.DEMO_ALLOWED_ORIGINS)

/**
 * Demo chat stays off unless an Anthropic key is present (fail closed).
 * Ephemeral sessions replace any shared static token.
 */
const DEMO_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY?.trim())

/**
 * Identifies this process's lifetime. The client persists its demo-use count in
 * localStorage across restarts; comparing against this lets it notice the server
 * (and its in-memory usage map) restarted and resync instead of staying stuck at
 * "limit reached" forever.
 */
const SERVER_EPOCH = randomUUID()

const anthropic = DEMO_ENABLED ? new Anthropic() : null

const app = express()

/**
 * Only honor X-Forwarded-For when the immediate peer is a configured trusted
 * proxy. Unset / "false" → never trust the header (use the socket address).
 * Set TRUST_PROXY to a hop count, IP/CIDR, or Express shortcut ("loopback",
 * "uniquelocal", "linklocal") matching your reverse proxy.
 */
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY))
app.use(express.json({ limit: '2mb' }))

app.use((req, res, next) => {
  if (req.method === 'OPTIONS' && req.path.startsWith('/api/')) {
    if (!enforceAllowedOrigin(req, res)) return
    res.status(204).end()
    return
  }
  next()
})

interface DemoUsageEntry {
  count: number
  lastAccessAt: number
}

interface DemoSession {
  token: string
  ip: string
  expiresAt: number
  lastAccessAt: number
}

interface MintWindow {
  count: number
  windowStart: number
}

/** Insertion-ordered map used as an LRU; TTL sweep removes idle entries. */
const demoUsageByIp = new Map<string, DemoUsageEntry>()
const demoSessionsByToken = new Map<string, DemoSession>()
const sessionMintsByIp = new Map<string, MintWindow>()

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '' || value === 'false') return false
  if (value === 'true') return 1
  const asNum = Number(value)
  if (Number.isInteger(asNum) && asNum >= 0 && String(asNum) === value.trim()) return asNum
  return value
}

function parseAllowedOrigins(value: string | undefined): Set<string> {
  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5183',
    'http://127.0.0.1:5183',
  ]
  const raw = value?.trim() ? value.split(',') : defaults
  return new Set(raw.map((o) => o.trim()).filter(Boolean))
}

function getClientIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function getBearerToken(req: express.Request): string | undefined {
  const header = req.get('authorization')
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  return token || undefined
}

function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function requestOrigin(req: express.Request): string | undefined {
  const origin = req.get('origin')?.trim()
  return origin || undefined
}

/** Reject non-browser / foreign-origin callers; set CORS headers when allowed. */
function enforceAllowedOrigin(req: express.Request, res: express.Response): boolean {
  const origin = requestOrigin(req)
  if (!origin || !DEMO_ALLOWED_ORIGINS.has(origin)) {
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

function evictMapOverflow<T>(map: Map<string, T>, max: number): void {
  while (map.size > max) {
    const oldest = map.keys().next().value
    if (oldest === undefined) break
    map.delete(oldest)
  }
}

function sweepExpiredDemoUsage(now = Date.now()): void {
  const cutoff = now - DEMO_USAGE_TTL_MS
  for (const [ip, entry] of demoUsageByIp) {
    if (entry.lastAccessAt < cutoff) demoUsageByIp.delete(ip)
  }
}

function sweepExpiredSessions(now = Date.now()): void {
  for (const [token, session] of demoSessionsByToken) {
    if (session.expiresAt <= now) demoSessionsByToken.delete(token)
  }
}

function getDemoUsage(ip: string): DemoUsageEntry {
  const now = Date.now()
  const existing = demoUsageByIp.get(ip)
  if (existing) {
    demoUsageByIp.delete(ip)
    existing.lastAccessAt = now
    demoUsageByIp.set(ip, existing)
    return existing
  }
  const entry: DemoUsageEntry = { count: 0, lastAccessAt: now }
  demoUsageByIp.set(ip, entry)
  evictMapOverflow(demoUsageByIp, DEMO_USAGE_MAX_ENTRIES)
  return entry
}

function remainingForIp(ip: string): number {
  const usageCount = demoUsageByIp.get(ip)?.count ?? 0
  return Math.max(0, DEMO_RATE_LIMIT - usageCount)
}

function canMintSession(ip: string, now = Date.now()): boolean {
  const window = sessionMintsByIp.get(ip)
  if (!window || now - window.windowStart >= DEMO_SESSION_MINT_WINDOW_MS) {
    sessionMintsByIp.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (window.count >= DEMO_SESSION_MINT_LIMIT) return false
  window.count += 1
  return true
}

function findReusableSession(ip: string, now = Date.now()): DemoSession | undefined {
  for (const session of demoSessionsByToken.values()) {
    if (session.ip === ip && session.expiresAt > now) {
      session.lastAccessAt = now
      return session
    }
  }
  return undefined
}

function mintSession(ip: string, now = Date.now()): DemoSession | null {
  const reusable = findReusableSession(ip, now)
  if (reusable) return reusable

  if (!canMintSession(ip, now)) return null

  const session: DemoSession = {
    token: randomBytes(32).toString('base64url'),
    ip,
    expiresAt: now + DEMO_SESSION_TTL_MS,
    lastAccessAt: now,
  }
  demoSessionsByToken.set(session.token, session)
  evictMapOverflow(demoSessionsByToken, DEMO_SESSION_MAX_ENTRIES)
  return session
}

function resolveSession(token: string, ip: string, now = Date.now()): DemoSession | null {
  const session = demoSessionsByToken.get(token)
  if (!session) return null
  if (session.expiresAt <= now) {
    demoSessionsByToken.delete(token)
    return null
  }
  if (session.ip !== ip) return null
  // Constant-time compare against stored token (map key already matched; still guard copies).
  if (!tokensEqual(token, session.token)) return null
  session.lastAccessAt = now
  return session
}

const sweepTimer = setInterval(() => {
  const now = Date.now()
  sweepExpiredDemoUsage(now)
  sweepExpiredSessions(now)
}, SWEEP_INTERVAL_MS)
sweepTimer.unref?.()

app.get('/api/demo-status', (req, res) => {
  if (!enforceAllowedOrigin(req, res)) return
  if (!DEMO_ENABLED) {
    res.json({ epoch: SERVER_EPOCH, remaining: 0, enabled: false })
    return
  }
  res.json({
    epoch: SERVER_EPOCH,
    remaining: remainingForIp(getClientIp(req)),
    enabled: true,
  })
})

/** Issues (or reuses) an ephemeral session token for the demo page. Invisible to the user. */
app.post('/api/demo-session', (req, res) => {
  if (!enforceAllowedOrigin(req, res)) return
  if (!DEMO_ENABLED) {
    res.status(503).json({
      error: 'Demo chat is disabled (ANTHROPIC_API_KEY not configured).',
      epoch: SERVER_EPOCH,
      remaining: 0,
      enabled: false,
    })
    return
  }

  const ip = getClientIp(req)
  const session = mintSession(ip)
  if (!session) {
    res.status(429).json({ error: 'Too many demo sessions from this network. Try again later.' })
    return
  }

  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    epoch: SERVER_EPOCH,
    remaining: remainingForIp(ip),
    enabled: true,
  })
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function validateChatMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > DEMO_MAX_MESSAGES) {
    return false
  }
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return false
    if (typeof m.content !== 'string') return false
    if (m.content.length === 0 || m.content.length > DEMO_MAX_MESSAGE_CHARS) return false
  }
  return true
}

app.post('/api/chat', async (req, res) => {
  if (!enforceAllowedOrigin(req, res)) return

  if (!DEMO_ENABLED || !anthropic) {
    res.status(503).json({
      error: 'Demo chat is disabled (ANTHROPIC_API_KEY not configured).',
    })
    return
  }

  const provided = getBearerToken(req)
  const ip = getClientIp(req)
  if (!provided || !resolveSession(provided, ip)) {
    res.status(401).json({ error: 'Invalid or expired demo session' })
    return
  }

  const messages = req.body?.messages
  const documentJson = req.body?.documentJson as JSONContent | undefined

  if (!validateChatMessages(messages)) {
    res.status(400).json({
      error: `messages must be 1–${DEMO_MAX_MESSAGES} items with non-empty content ≤${DEMO_MAX_MESSAGE_CHARS} chars`,
    })
    return
  }

  const usage = getDemoUsage(ip)
  if (usage.count >= DEMO_RATE_LIMIT) {
    res.status(429).json({
      error: 'Demo limit reached. Download the desktop app for unlimited access.',
      remaining: 0,
    })
    return
  }
  usage.count += 1

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const tree = documentJson ? buildDocTree(documentJson) : undefined

  try {
    const convo: MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }))

    for (let iteration = 0; iteration < DEMO_MAX_TOOL_ITERATIONS; iteration++) {
      const stream = anthropic.messages.stream({
        model: DEMO_MODEL,
        max_tokens: DEMO_MAX_TOKENS,
        messages: convo,
        ...(tree ? { tools: [...DOC_TOOLS] } : {}),
      })

      stream.on('text', (delta) => {
        send({ text: delta })
      })

      const finalMessage = await stream.finalMessage()
      convo.push({ role: 'assistant', content: finalMessage.content })

      if (finalMessage.stop_reason !== 'tool_use' || !tree) break

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of finalMessage.content) {
        if (block.type !== 'tool_use') continue
        send({ tool: block.name, input: block.input })
        const result = executeDocTool(tree, block.name, block.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }
      convo.push({ role: 'user', content: toolResults })
    }

    send({ done: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error contacting Claude'
    send({ error: message })
  } finally {
    res.write('data: [DONE]\n\n')
    res.end()
  }
})

app.listen(PORT, () => {
  const origins = [...DEMO_ALLOWED_ORIGINS].join(', ')
  const chatStatus = DEMO_ENABLED
    ? `demo chat enabled (model=${DEMO_MODEL}, max_tokens=${DEMO_MAX_TOKENS}, tool_loops=${DEMO_MAX_TOOL_ITERATIONS})`
    : 'demo chat DISABLED — set ANTHROPIC_API_KEY to enable'
  console.log(`agentdocs API server listening on http://localhost:${PORT}`)
  console.log(`  ${chatStatus}`)
  console.log(`  allowed origins: ${origins}`)
})
