import type { ProviderStreamFn } from './types.cjs'

export const streamOpenAI: ProviderStreamFn = async ({ apiKey, model, messages, signal, onDelta }) => {
  if (!apiKey) throw new Error('No OpenAI API key configured. Add one in Settings.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''

    for (const chunk of chunks) {
      const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (!dataLine) continue
      const payload = dataLine.slice('data: '.length)
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload)
        const text = parsed?.choices?.[0]?.delta?.content
        if (typeof text === 'string' && text) onDelta(text)
      } catch {
        // ignore malformed frame
      }
    }
  }
}
