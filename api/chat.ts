import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { JSONContent } from '@tiptap/core'
import { getAnthropic, runDemoChat, validateChatMessages } from './_lib/chat.js'
import {
  DEMO_ENABLED,
  DEMO_MAX_MESSAGE_CHARS,
  DEMO_MAX_MESSAGES,
} from './_lib/config.js'
import { enforceAllowedOrigin, handleOptions } from './_lib/cors.js'
import { getBearerToken, getClientIp } from './_lib/request.js'
import { assertStoreAvailable } from './_lib/redis.js'
import { resolveSession, tryConsumeDemoUse } from './_lib/store.js'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!enforceAllowedOrigin(req, res)) return

  const storeError = assertStoreAvailable()
  if (storeError) {
    res.status(503).json({ error: storeError })
    return
  }

  const anthropic = getAnthropic()
  if (!DEMO_ENABLED || !anthropic) {
    res.status(503).json({
      error: 'Demo chat is disabled (ANTHROPIC_API_KEY not configured).',
    })
    return
  }

  const provided = getBearerToken(req)
  const ip = getClientIp(req)
  if (!provided || !(await resolveSession(provided, ip))) {
    res.status(401).json({ error: 'Invalid or expired demo session' })
    return
  }

  const body =
    typeof req.body === 'string'
      ? (() => {
          try {
            return JSON.parse(req.body)
          } catch {
            return null
          }
        })()
      : req.body
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }
  const messages = (body as { messages?: unknown }).messages
  const documentJson = (body as { documentJson?: JSONContent }).documentJson

  if (!validateChatMessages(messages)) {
    res.status(400).json({
      error: `messages must be 1–${DEMO_MAX_MESSAGES} items with non-empty content ≤${DEMO_MAX_MESSAGE_CHARS} chars`,
    })
    return
  }

  const remaining = await tryConsumeDemoUse(ip)
  if (remaining === null) {
    res.status(429).json({
      error: 'Demo limit reached. Download the desktop app for unlimited access.',
      remaining: 0,
    })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const controller = new AbortController()
  const onClientGone = () => {
    if (!controller.signal.aborted) controller.abort()
  }
  req.on('close', onClientGone)

  const send = (data: Record<string, unknown>) => {
    if (controller.signal.aborted || res.writableEnded) return
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    await runDemoChat(anthropic, messages, documentJson, {
      send,
      signal: controller.signal,
    })
  } catch (err) {
    if (!controller.signal.aborted) {
      const message = err instanceof Error ? err.message : 'Unknown error contacting Claude'
      send({ error: message })
    }
  } finally {
    req.off('close', onClientGone)
    if (!res.writableEnded) {
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
}
