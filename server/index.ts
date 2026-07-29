import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree } from '../src/lib/docTree'
import { DOC_TOOLS, executeDocTool } from '../src/lib/docTools'

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787
const MAX_TOOL_ITERATIONS = 6
const DEMO_RATE_LIMIT = 5
/** Drop idle IP entries after this TTL (default 24h). */
const DEMO_USAGE_TTL_MS = process.env.DEMO_USAGE_TTL_MS
  ? Number(process.env.DEMO_USAGE_TTL_MS)
  : 24 * 60 * 60 * 1000
const DEMO_USAGE_MAX_ENTRIES = process.env.DEMO_USAGE_MAX_ENTRIES
  ? Number(process.env.DEMO_USAGE_MAX_ENTRIES)
  : 10_000
const DEMO_USAGE_SWEEP_INTERVAL_MS = 60_000

/**
 * Identifies this process's lifetime. The client persists its demo-use count in
 * localStorage across restarts; comparing against this lets it notice the server
 * (and its in-memory usage map) restarted and resync instead of staying stuck at
 * "limit reached" forever.
 */
const SERVER_EPOCH = randomUUID()

const anthropic = new Anthropic()

const app = express()

/**
 * Only honor X-Forwarded-For when the immediate peer is a configured trusted
 * proxy. Unset / "false" → never trust the header (use the socket address).
 * Set TRUST_PROXY to a hop count, IP/CIDR, or Express shortcut ("loopback",
 * "uniquelocal", "linklocal") matching your reverse proxy.
 */
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY))
app.use(express.json({ limit: '2mb' }))

interface DemoUsageEntry {
  count: number
  lastAccessAt: number
}

/** Insertion-ordered map used as an LRU; TTL sweep removes idle entries. */
const demoUsageByIp = new Map<string, DemoUsageEntry>()

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '' || value === 'false') return false
  if (value === 'true') return 1
  const asNum = Number(value)
  if (Number.isInteger(asNum) && asNum >= 0 && String(asNum) === value.trim()) return asNum
  return value
}

function getClientIp(req: express.Request): string {
  // req.ip respects trust proxy; X-Forwarded-For is ignored unless configured.
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function sweepExpiredDemoUsage(now = Date.now()): void {
  const cutoff = now - DEMO_USAGE_TTL_MS
  for (const [ip, entry] of demoUsageByIp) {
    if (entry.lastAccessAt < cutoff) demoUsageByIp.delete(ip)
  }
}

function evictLruOverflow(): void {
  while (demoUsageByIp.size > DEMO_USAGE_MAX_ENTRIES) {
    const oldest = demoUsageByIp.keys().next().value
    if (oldest === undefined) break
    demoUsageByIp.delete(oldest)
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
  evictLruOverflow()
  return entry
}

const demoUsageSweepTimer = setInterval(() => sweepExpiredDemoUsage(), DEMO_USAGE_SWEEP_INTERVAL_MS)
demoUsageSweepTimer.unref?.()

app.get('/api/demo-status', (req, res) => {
  const usageCount = demoUsageByIp.get(getClientIp(req))?.count ?? 0
  res.json({ epoch: SERVER_EPOCH, remaining: Math.max(0, DEMO_RATE_LIMIT - usageCount) })
})

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

app.post('/api/chat', async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined
  const documentJson = req.body?.documentJson as JSONContent | undefined

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array' })
    return
  }

  const usage = getDemoUsage(getClientIp(req))
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

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const stream = anthropic.messages.stream({
        model: 'claude-opus-4-8',
        max_tokens: 4096,
        output_config: { effort: 'medium' },
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
  console.log(`agentdocs API server listening on http://localhost:${PORT}`)
})
