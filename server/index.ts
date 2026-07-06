import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787

const anthropic = new Anthropic()

const app = express()
app.use(express.json({ limit: '2mb' }))

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

app.post('/api/chat', async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages must be a non-empty array' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const send = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      messages,
    })

    stream.on('text', (delta) => {
      send({ text: delta })
    })

    await stream.finalMessage()
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
