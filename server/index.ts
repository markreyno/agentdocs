import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
import type { JSONContent } from '@tiptap/core'
import { buildDocTree } from '../src/lib/docTree'
import { DOC_TOOLS, executeDocTool } from '../src/lib/docTools'

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787
const MAX_TOOL_ITERATIONS = 6
const DEMO_RATE_LIMIT = 5

const anthropic = new Anthropic()

const app = express()
app.use(express.json({ limit: '2mb' }))

const demoUsageByIp = new Map<string, number>()

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  }
  return req.socket.remoteAddress || 'unknown'
}

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

  const clientIp = getClientIp(req)
  const usageCount = demoUsageByIp.get(clientIp) ?? 0
  if (usageCount >= DEMO_RATE_LIMIT) {
    res.status(429).json({
      error: 'Demo limit reached. Download the desktop app for unlimited access.',
      remaining: 0,
    })
    return
  }
  demoUsageByIp.set(clientIp, usageCount + 1)

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
